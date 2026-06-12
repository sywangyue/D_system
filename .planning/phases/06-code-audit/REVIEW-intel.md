---
phase: 06-code-audit
reviewed: 2026-06-11
depth: deep
files_reviewed: 11
files_reviewed_list:
  - tools/intel/db_query.py
  - tools/intel/qcc_client.py
  - tools/intel/report_writer.py
  - tools/intel/export_prospects.py
  - tools/intel/insert_prospects.py
  - .claude/skills/industry-research/SKILL.md
  - .claude/skills/brand-research/SKILL.md
  - .claude/skills/batch-prospect/SKILL.md
  - .claude/skills/single-prospect/SKILL.md
  - schema/migrations/005_intel_tables.sql
  - tests/（覆盖核查）
findings:
  critical: 1
  high: 3
  medium: 8
  low: 4
  total: 16
status: issues_found
---

# Phase 5 情报后端 · 代码审查报告（REVIEW-intel）

## 概览

审查范围：5 个 tools/intel 脚本、4 个 Claude Code Skills、migration 005_intel_tables.sql，以及 tests/ 覆盖核查。整体判断：**单文件代码质量尚可（全程参数化 SQL、无硬编码密钥、降级模式设计合理），但 skill→tool→DB 的端到端链路存在断裂——batch-prospect 按文档执行必然在导出步骤失败，且企查查结果落库无幂等保障，不可在当前状态上线。**

---

## 发现

### 🔴 Critical

**INTEL-01 · batch-prospect 流程断链：线索与报告永远关联不上，导出步骤必然失败**
- 文件：`.claude/skills/batch-prospect/SKILL.md:74`（第三步）、`:151-160`（第四、五步）；`tools/intel/export_prospects.py:74-78`
- 问题描述：第三步插入 prospects 时 `intel_report_id` 填 `None`（注释写"下一步创建报告后更新"），第四步创建报告获得 report_id，但**全流程没有任何 UPDATE 步骤**回填 `intel_report_id`。第五步用 `export_prospects.py --report-id <report_id>` 导出，`WHERE intel_report_id = ?` 必然命中 0 行 → 抛 ValueError 退出码 1。按文档逐步执行，Excel 永远导不出，线索与报告的关联永久丢失。
- 证据：
  ```python
  # SKILL.md 第三步模板
  "intel_report_id": None,   # 先写 None，下一步创建报告后更新  ← 无人更新
  # export_prospects.py:76
  WHERE intel_report_id = ?  → 0 行 → raise ValueError("未找到符合条件的客户线索记录")
  ```
- 建议修复方向：调整流程顺序为"先建报告拿 report_id，再插 prospects 时直接带上"，或在第四步后补一条 UPDATE 语句。

### 🟠 High

**INTEL-02 · insert_prospects.py 采用"改源码再运行"模式，脆弱且污染仓库**
- 文件：`tools/intel/insert_prospects.py:20-35`；`.claude/skills/batch-prospect/SKILL.md:59`
- 问题描述：工具要求 LLM 每次运行前**编辑仓库内源文件**填入 prospects 列表。后果：(a) 每次执行后工作区变脏，真实企业数据可能被意外 commit；(b) 两次任务并发或中断后残留上次数据，重跑即重复写入；(c) 与"工具只读、数据走参数"的常规约定相悖。
- 证据：
  ```python
  # ── 修改此列表为实际搜索结果 ──
  prospects: list[dict] = []
  ```
- 建议修复方向：改为接受 `--json /tmp/prospects.json` 输入文件参数（接口修正，非新功能），脚本本体保持只读。

**INTEL-03 · customer_prospect 无去重约束、工具无幂等，重复执行产生重复线索**
- 文件：`schema/migrations/005_intel_tables.sql:73-74`；`tools/intel/insert_prospects.py:53-71`
- 问题描述：`idx_prospect_qcc` 是普通索引非 UNIQUE，insert 为裸 INSERT 无 upsert/去重逻辑。同一展会重跑 batch-prospect（或 INTEL-02 的残留数据未清空）即产生重复记录，BD 导出的 Excel 会有重复公司且无法区分。
- 证据：
  ```sql
  CREATE INDEX IF NOT EXISTS idx_prospect_qcc
      ON customer_prospect(qcc_key_no) WHERE qcc_key_no IS NOT NULL;  -- 非 UNIQUE
  ```
- 建议修复方向：对 `(brand_id, qcc_key_no)` 加部分唯一索引 + INSERT OR IGNORE，或插入前按 qcc_key_no/company_name 查重。

**INTEL-04 · Skill 参数语法从未被解析：l1/l2 组合与"公司名+目的"组合直接导致零命中**
- 文件：`.claude/skills/industry-research/SKILL.md:4,20`；`.claude/skills/single-prospect/SKILL.md:4,20`；`tools/intel/db_query.py:258`
- 问题描述：industry-research 的 argument-hint 宣称支持 `机械和设备/机床`，但第一步直接 `db_query.py industry-research "$ARGUMENTS"`——整串（含斜杠）作为 industry_l1 查询，必然返回"该行业暂无数据"；`--l2` 参数在所有 skill 中从未被使用（死参数）。同理 single-prospect 提示可输入"公司名 + 调查目的"，整串进入 `LIKE '%上海精密机床 代理商资质排查%'`，必然零命中。`!`命令`` 在 skill 预处理阶段自动执行，LLM 没有机会先拆参——这是确定性失败，不是概率问题。
- 证据：
  ```
  argument-hint: "[industry_l1 或 industry_l1/industry_l2，例: 机械和设备/机床]"
  !`python3 tools/intel/db_query.py industry-research "$ARGUMENTS"`   ← 整串传入，无拆分
  ```
- 建议修复方向：要么 db_query.py 在脚本内解析 `l1/l2` 斜杠语法，要么收紧 argument-hint 只接受单一值并由 skill 正文指导二次查询。

### 🟡 Medium

**INTEL-05 · brand_research 模糊匹配多命中时静默返回任意一条**
- 文件：`tools/intel/db_query.py:39-42`
- 问题描述：`WHERE brand_id = ? OR name_cn LIKE ?` + `fetchone()`，无 ORDER BY 无消歧。实测 `%机床%` 命中 47 个品牌，返回哪一条由 SQLite 内部顺序决定，整份调研报告可能建立在错误品牌之上且用户无感知。
- 证据：`sqlite3 mwlab.db "SELECT COUNT(*) FROM exhibition_brand WHERE name_cn LIKE '%机床%'"` → 47
- 建议修复方向：多命中时列出候选清单让用户选择，至少加确定性排序（精确名优先 + scale_score DESC）并在输出中提示"另有 N 条匹配"。

**INTEL-06 · qcc_client 将企查查 Status=201（查询无结果）当错误处理，且无余额/限频特判**
- 文件：`tools/intel/qcc_client.py:120-125,140`
- 问题描述：企查查 API 惯例 `200`=成功、`201`=查询无结果（正常空结果）、`101/102`=Key 无效/余额不足。当前 `Status != "200"` 一律走错误分支，201 会显示"[企查查错误]"误导 LLM 在报告中写成"查询失败"而非"无此企业"；102 余额耗尽与网络错误混为一谈，批量场景下会带着空结果烧完 50 次调用而无人察觉。
- 证据：
  ```python
  if data.get("Status") != "200":
      return {"Status": ..., "Message": ..., "Result": []}   # 201 也落入此分支
  ```
- 建议修复方向：201 映射为正常空结果；101/102 给出明确"停止批量、检查配额"提示。

**INTEL-07 · 所有写入连接未开 PRAGMA foreign_keys=ON，REFERENCES 形同虚设**
- 文件：`tools/intel/report_writer.py:110`；`tools/intel/insert_prospects.py:44`；配合 `.claude/skills/brand-research/SKILL.md:151`
- 问题描述：SQLite 外键默认关闭，migration 里的 `PRAGMA foreign_keys = ON` 只对迁移会话生效。brand-research 第四步用 `--brand-id "$ARGUMENTS"` 写报告，当用户输入的是品牌中文名时（skill 仅靠一行"注意"提醒 LLM 替换），无效 brand_id 会被静默写入 intel_report，产生孤儿引用。
- 证据：`report_writer.py` 中 `sqlite3.connect()` 后直接 INSERT，无 PRAGMA。
- 建议修复方向：写入工具的 `_connect` 统一执行 `PRAGMA foreign_keys=ON`，让坏 brand_id 当场报错。

**INTEL-08 · openpyxl 缺失于 requirements.txt，而 xlsx 是导出默认格式**
- 文件：`requirements.txt`（仅 requests + beautifulsoup4）；`tools/intel/export_prospects.py:103,175`
- 问题描述：默认 `--format xlsx` 依赖 openpyxl，依赖清单未声明。新环境部署后 batch-prospect 第五步即失败（虽有友好报错，但流程中断）。
- 证据：`requirements.txt` 全文：`requests>=2.31.0`、`beautifulsoup4>=4.12.0`。
- 建议修复方向：requirements.txt 增加 `openpyxl`。

**INTEL-09 · company_history 语义错位：查的是主办方，标注成"参展轨迹"**
- 文件：`tools/intel/db_query.py:188-199`；`.claude/skills/single-prospect/SKILL.md:77-91`
- 问题描述：查询匹配 `b.organizer LIKE ? OR b.name_cn LIKE ?`——命中的是该公司**主办/冠名**的展会，而非其作为展商的参展记录（DB 本就无展商明细）。但 single-prospect 报告模板将结果写入"二、展会参与轨迹 / 参展历史摘要 / 参展明细"，BD 会把"主办过 3 个展"误读为"参展 3 次"，得出错误的客户画像结论。skill 尾注虽提到局限，但报告正文标题直接误导。
- 证据：
  ```python
  "WHERE b.organizer LIKE ? OR b.name_cn LIKE ? "   # 主办方匹配
  # SKILL.md: "## 二、展会参与轨迹（来自 mwlab.db）"
  ```
- 建议修复方向：将该节统一改名为"展会关联记录（主办/冠名维度）"，并在 db_query 输出首行注明匹配字段。

**INTEL-10 · $ARGUMENTS 直接内插进 shell 命令，存在命令注入面**
- 文件：四个 SKILL.md 的所有 `!`...`` 与 bash 代码块（如 `.claude/skills/industry-research/SKILL.md:20,125-128`）
- 问题描述：`$ARGUMENTS` 是文本替换后交 shell 执行，输入含 `"` 即可破坏引号结构、含 `$( )` 即可执行任意命令。本项目为内部手动触发工具、操作者即机器所有者，故降级为 Medium，但这是 db_query.py 这类"注入脚本"的真实注入面，且粘贴的外部参展商名单（batch-prospect 输入源）可能天然含引号。
- 证据：`!`python3 tools/intel/db_query.py industry-research "$ARGUMENTS"``
- 建议修复方向：skill 正文先把 $ARGUMENTS 写入 /tmp 文件（Write 工具），命令统一从文件读参。

**INTEL-11 · batch-prospect SKILL 内嵌一份与真实工具不一致的脚本副本（双源漂移）**
- 文件：`.claude/skills/batch-prospect/SKILL.md:61-112` vs `tools/intel/insert_prospects.py`
- 问题描述：skill 第三步贴了完整脚本模板，但与仓库内真实工具有三处差异：`DB_PATH = Path("mwlab.db")` 是相对路径（cwd 不在仓库根时写错库/建新空库）、缺 company_name 校验、缺 try/finally。LLM 可能照模板覆盖真实工具，引入相对路径 bug。
- 证据：`DB_PATH = Path("mwlab.db")`（skill 内）vs `Path(__file__).resolve().parent.parent.parent / "mwlab.db"`（工具内）。
- 建议修复方向：skill 中删除内嵌脚本，只保留"编辑 tools/intel/insert_prospects.py 的 prospects 列表"指引（若采纳 INTEL-02 则改为生成 JSON 文件）。

**INTEL-12 · migration 编号冲突：两个 005**
- 文件：`schema/migrations/005_intel_tables.sql`、`schema/migrations/005_people.sql`
- 问题描述：同一序号两份迁移，依赖 schema_version 表的迁移机制无法区分执行顺序与状态，未来回放/重建库时存在漏执行风险。
- 证据：`ls schema/migrations/` → `005_intel_tables.sql`、`005_people.sql` 并存。
- 建议修复方向：将 intel 迁移重编号为 006（文件改名 + schema_version 记录核对）。

### 🟢 Low

**INTEL-13 · db_query.py 未使用的 import sys；_slugify 中 `一-鿿` 范围冗余**
- 文件：`tools/intel/db_query.py:18`；`tools/intel/report_writer.py:42`
- 问题描述：`sys` 导入后从未使用；`\w` 在 Python3 默认 Unicode 模式下已含中文，`一-鿿` 冗余（无害）。
- 建议修复方向：删除无用 import；正则可简化（顺手时再做）。

**INTEL-14 · industry_research 的"总品牌数"在 --l2 过滤时仍统计 L1 全量**
- 文件：`tools/intel/db_query.py:153-156,169`
- 问题描述：标题显示"L1 / L2"但"总品牌数"只按 L1 计数，报告中 TAM/SAM 估算若引用此数会偏大。
- 建议修复方向：COUNT 查询与列表查询使用相同的 WHERE 条件。

**INTEL-15 · report_writer 先写文件后写 DB，且 skill 用 --content "$(cat ...)" 传大报告**
- 文件：`tools/intel/report_writer.py:102-110`；各 SKILL.md 第四/五步
- 问题描述：DB 插入失败时留下孤儿 .md 文件；报告经命令行单参数传递，Linux 单参上限约 128KB（MAX_ARG_STRLEN），长报告会 E2BIG 失败——工具已有 `--content-file` 却没被任何 skill 使用。
- 建议修复方向：四个 skill 统一改用 `--content-file /tmp/xxx_report.md`。

**INTEL-16 · export --out 与 --format 不联动；skill frontmatter allowed-tools 空格分隔写法需核验**
- 文件：`tools/intel/export_prospects.py:175-179`；四个 SKILL.md frontmatter
- 问题描述：`--out leads.csv` + 默认 xlsx 会把 xlsx 二进制写进 .csv 文件名；`allowed-tools: Bash WebSearch Read Write` 为空格分隔，Claude Code 惯例为逗号分隔，若解析失败工具白名单将不生效。
- 建议修复方向：按 --out 扩展名推断格式或冲突时报错；frontmatter 改逗号分隔并实测。

---

## 企查查接入路径评估（最优路径？）

**结论：需调整**（架构方向正确，落库链路必须修复后才可上线；无需重构）。

**做对了的（合理保留）：**
1. **鉴权签名正确**：`Token = MD5(AppKey + Timespan + SecretKey).upper()`，Header 传 Token/Timespan、query 传 key，符合企查查官方 API 规范；每次请求实时生成不缓存，正确。
2. **密钥管理合格**：QCC_APP_KEY/QCC_SECRET_KEY 走环境变量，无硬编码、不打印密钥、错误信息不回显密钥；占位符降级模式让未配置时全链路可演练，是好设计。
3. **错误模型适配 LLM 调用方**：所有异常收敛为 `{"Status", "Message", "Result"}` 结构化返回而非抛栈，配合 skill 的降级说明，符合"工具供 skill 调用"的定位。
4. **模糊匹配人在回路**：FuzzySearch 取 top 3-5 → LLM/BD 人工核验，对"参展商名单→工商记录"这类天然含歧义的匹配，人工核验比自动打分更稳妥，且符合"人工触发、禁止自动化"约束。**没有**做缓存层、重试队列、异步并发——在每月手动几十次调用的量级下这是正确的克制，不是欠工程。

**必须调整的（按优先级）：**
1. **结果持久化链路断裂**（INTEL-01/02/03）：搜索本身没问题，但"结果→customer_prospect→报告→Excel"的后半程按文档执行会失败。这是接入路径上最大的洞。
2. **状态码语义**（INTEL-06）：201 当错误、102 余额不足无特判。按次计费的 API，"余额烧完仍继续批量循环"是真实的资损路径，至少要在 102 时输出明确停止信号。
3. **轻微欠工程一项**：批量循环对单关键词失败（超时/限频）无区分地继续，50 个关键词的批次没有任何调用次数汇总输出，BD 无法对账 API 消耗。在现有输出末尾加一行成功/失败计数即可，不需要新表新功能。

**明确不建议做的（避免过度工程）**：重试装饰器、本地结果缓存、QPS 限速器、调用记录表——当前手动低频场景下均属投机性复杂度，违反项目 Simplicity First 约束。

---

## 测试覆盖

- **现有**：`tests/` 含 conftest.py、test_schema.py、test_merge_engine.py、test_clean_brands.py、test_tagging_tools.py、middleware.test.ts——grep 确认**无任何文件引用 intel / prospect / qcc**。
- **缺失**（按价值排序）：
  1. `tools/intel/*` 五个脚本零测试。最该补的三个：db_query 四种查询的存在/不存在/多命中路径；report_writer 的 DB+文件双写与非法 report_type；export_prospects 的三种过滤 + 空结果。
  2. test_schema.py 未覆盖 intel_report / customer_prospect 的 CHECK 约束（report_type、source_type、prospect_score 边界）。
  3. qcc_client 可用 mock 响应测 201/102/超时分支（无需真实 Key）——这是上线前最便宜的回归保障。
- 四个 SKILL.md 属 prompt 资产，无法单测，但 INTEL-01/04 这类流程断链恰恰说明需要一次**端到端演练**（占位符降级模式下全流程跑通一遍）作为验收门槛。

---

_Reviewed: 2026-06-11_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
