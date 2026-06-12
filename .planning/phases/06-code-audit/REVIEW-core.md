---
phase: 06-code-audit
reviewed: 2026-06-11
depth: deep
scope: core backend (merge_engine / scheduler / research / export_monthly / tools/* / schema/*)
files_reviewed: 17
findings:
  blocker: 3
  high: 6
  medium: 5
  info: 1
  total: 15
status: issues_found
---

# Phase 6 · 核心后端代码审查报告（REVIEW-core）

## 概览

整体判断：**核心合并引擎存在两处可造成生产数据灾难性损坏的 BLOCKER，不可在 5,856 条生产库上再次运行 `merge_engine.py`。**

- `merge_engine.py` 的 `next_brand_id` 与生产库现存的 8 位十六进制 `brand_id`（如 `EXPO-D92BC0D6`）不兼容，会让**本次运行新建的所有品牌全部坍缩并覆盖到 `EXPO-0001`**（实测确认）。
- `upsert_edition` 的 `data_source` 字段在每次重跑时**无限追加**，生产库已被污染成 `jufair/jufair/jufair`、`cnexpo/cnexpo/cnexpo/cnexpo`（实测确认，research.py 已写了去重补丁来掩盖此问题）。
- `normalize_city` 会**截断所有四字城市名**：`呼和浩特→浩特`、`乌鲁木齐→木齐`、`齐齐哈尔→哈尔`（实测确认）。

数据完整性结论：合并引擎**不是幂等的**，且与当前生产库 schema/数据状态不一致。重复打标/回填工具质量尚可但有并发写库与异常吞噬问题。`schema/db.py` 只应用 migration 001，导致用 `init_db()` 新建的库缺少生产已在用的 4 个列。测试覆盖虽在解析函数上较密，但**恰好绕过了所有 BLOCKER 路径**。

---

## 发现

### CORE-01 🔴 BLOCKER — `next_brand_id` 与十六进制 brand_id 不兼容，新建品牌全部坍缩到 EXPO-0001

- **文件**：`merge_engine.py:150-159`
- **问题描述**：`next_brand_id` 用 `ORDER BY brand_id DESC LIMIT 1` 取字典序最大的 ID，再用 `re.match(r'EXPO-(\d+)', ...)` 解析数字。生产库存在 6 条由其它工具写入的十六进制 ID（`EXPO-D92BC0D6` 等），其字典序大于全部 `EXPO-5935` 这类数字 ID。实测：`re.match(r'EXPO-(\d+)','EXPO-D92BC0D6')` 返回 `None` → 回退 `num=1` → 生成 `EXPO-0001`。由于 `EXPO-D9...` 在插入 `EXPO-0001` 后仍是字典序最大，**本次运行创建的每一个新品牌都会得到 `EXPO-0001`**，经 `upsert_brand` 的 `ON CONFLICT(brand_id) DO UPDATE` 反复覆盖同一行，造成大规模数据丢失。
- **证据**：
  ```
  $ EXPO-D92BC0D6 -> match: None      # 回退 EXPO-0001
  $ EXPO-5935     -> match: 5935
  生产库存在 6 条 length(brand_id) > 9 的十六进制 ID
  ```
- **建议修复方向**：改用 `SELECT MAX(CAST(SUBSTR(brand_id,6) AS INTEGER)) FROM exhibition_brand WHERE brand_id GLOB 'EXPO-[0-9]*'`，仅在数字 ID 子集内求最大值；并对 ID 生成上锁/串行化。

### CORE-02 🔴 BLOCKER — `data_source` 每次重跑无限追加，生产数据已污染

- **文件**：`merge_engine.py:341`
- **问题描述**：`ON CONFLICT(edition_id) DO UPDATE SET data_source = excluded.data_source || '/' || data_source` 在每次合并时把来源串拼接一次，引擎**非幂等**。重复运行使 `data_source` 不断膨胀，且无法再准确区分单源/双源。
- **证据**（生产库实测）：
  ```
  jufair/jufair/jufair                          3086
  cnexpo/cnexpo/cnexpo/cnexpo                    1247
  jufair/cnexpo/jufair/cnexpo/jufair/cnexpo       37
  ```
  `research.py:166-167` 已用 `dict.fromkeys(parts)` 去重来掩盖此污染，反向印证 bug 存在。
- **建议修复方向**：改为 `data_source = excluded.data_source`（直接覆盖）或在 upsert 前做集合去重；并写一次性脚本清洗存量列。

### CORE-03 🔴 BLOCKER — `normalize_city` 截断全部四字城市名

- **文件**：`merge_engine.py:131-146`
- **问题描述**：`if len(s)==4: return s[2:]` 把任意 4 字城市名当成"省+市"截断为后两字。实测 `呼和浩特→浩特`、`乌鲁木齐→木齐`、`齐齐哈尔→哈尔`、`西双版纳→版纳`。这些正是 `geo_dict.py` 列出的合法城市，被静默写错入库。
- **证据**：
  ```
  呼和浩特 -> 浩特    乌鲁木齐 -> 木齐    齐齐哈尔 -> 哈尔
  ```
- **建议修复方向**：去掉对 4 字串的盲截断，改为基于已知省份前缀白名单（复用 `geo_dict.CN_PROVINCES`）剥离前缀；或仅在前两字确为省份名时才截断。

### CORE-04 🟠 HIGH — `init_db` 只应用 migration 001，新建库缺 4 个生产在用列

- **文件**：`schema/db.py:33-35`
- **问题描述**：`init_db()` 只读取并执行 `init_db.sql` + `001_initial.sql`，从不应用 `002~005`。因此 `display_ready`、`country_cn`、`city_en`、`is_international_source` 这些迁移新增列在新建库中不存在。`export_monthly.py`（引用 `b.country_cn`）与 `tools/extract_geo.py`（引用 `country_cn/city_en/is_international_source`）在任何由 `init_db()` 新建的库上都会 `no such column` 失败；生产库仅因人工手动跑过迁移才碰巧可用。
- **证据**：`schema/db.py` 仅 `_MIGRATION_001`；生产库 `PRAGMA table_info` 含 `is_international_source / city_en / country_cn / display_ready`，而 `init_db.sql` 无这些列。
- **建议修复方向**：`init_db()` 改为按版本号顺序遍历 `migrations/*.sql` 全量应用，并用 `schema_version` 表防重复。

### CORE-05 🟠 HIGH — 溯源重复膨胀 + 跨源 raw_payload 错配

- **文件**：`merge_engine.py:355-382`、`merge_engine.py:481-488`
- **问题描述**：(1) `insert_provenance` 用 `str(uuid.uuid4())` 作主键再 `INSERT OR IGNORE`，UUID 必然唯一，`OR IGNORE` 永不触发，**每次重跑都为同一 brand/url 追加一条新溯源**，与 CORE-02 一起导致 `data_provenance` 持续膨胀。(2) 双源合并分支在 jufair 循环里对 cnexpo 的 URL 也传入 `raw`（jufair 原始行），导致 `source_site='cnexpo'` 的溯源记录里 `raw_payload` 实为 jufair 数据，溯源失真。
- **证据**：`for url in filter(None, source_urls): site = 'jufair' if 'jufair' in url else 'cnexpo'; insert_provenance(..., raw, ...)` — `raw` 恒为 jufair 行。
- **建议修复方向**：溯源主键改用 `(brand_id, source_url)` 唯一约束 + `INSERT OR IGNORE`/UPSERT；按 url 来源选择对应的原始行作为 payload。

### CORE-06 🟠 HIGH — `match_brand` 模糊匹配阈值偏低，可能合并不同品牌

- **文件**：`merge_engine.py:165-189`
- **问题描述**：精确匹配失败后用 `difflib.SequenceMatcher` 全表扫描取 `ratio>=0.85` 的最优项。中文短名（如"上海机床展" vs "上海机器展"）极易 ≥0.85，会把两个不同展会误并为同一 brand_id，污染届次与溯源。无第二候选差距校验、无行业/城市辅助判别。
- **证据**：`if best_ratio >= MATCH_THRESHOLD: return best_id`，无歧义保护。
- **建议修复方向**：提高阈值并加"最优与次优差距"门限；或要求行业/城市一致方可模糊合并；记录低置信匹配供人工复核。

### CORE-07 🟠 HIGH — `edition_id` 仅按 year，year 缺失=0 导致同品牌多届坍缩

- **文件**：`merge_engine.py:321-322`
- **问题描述**：`year = norm.get('year') or 0; edition_id = f"{brand_id}-{year}"`。同一品牌所有无法解析出年份的届次都得到 `{brand_id}-0`，经 MAX 合并坍缩成一条，丢失多届数据；同品牌同年不同日期的两届也会冲突合并。任务约定的去重键是 `(name_cn, date_start)`，与此实现不一致。
- **证据**：`upsert_edition` 仅以 `{brand_id}-{year}` 为 PK。
- **建议修复方向**：year 缺失时回退用 `date_start`（或其哈希）参与 edition_id；或按 `(brand_id, date_start)` 唯一。

### CORE-08 🟠 HIGH — `parse_date_pair` 跨年区间结束年份错误 / 同月日范围漏解析

- **文件**：`merge_engine.py:99-110`
- **问题描述**：区间正则对结束日期复用开始年份 `y`，"2026.12.30 - 01.02" 会解析为 `date_end=2026-01-02`（早于开始日，年份应为 2027）。同时形如 "2026.05.01-05"（同月仅日范围）既不匹配区间式也不匹配单日式（因 `$` 锚定），直接落空返回 `(None,None)`，静默丢失日期。
- **证据**：区间分支 `return f"{y}-...", f"{y}-{int(em):02d}-{int(ed):02d}"` 结束段无跨年处理。
- **建议修复方向**：当 `em < sm` 时结束年份 `+1`；补充"同月日范围"格式分支。

### CORE-09 🟠 HIGH — `backfill_organizer.py` 伪造 X-Forwarded-For 绕过 IP ACL（安全/合规）

- **文件**：`tools/backfill_organizer.py:54-110`
- **问题描述**：硬编码一组上海电信/联通 IP 作 `X-Forwarded-For` 轮换，注释明确写"bypass jufair CDN IP ACL blacklist"。这是绕过目标站访问控制的抓取手段，存在合规/法律与封禁风险，且伪造 IP 池硬编码在仓库中。`fetch_organizer` 还以裸 `except Exception: return None` 吞掉全部错误，失败原因不可观测。
- **证据**：`XFF_POOL = [...]`、`"-H", f"X-Forwarded-For: {xff}"`、`# ...bypass jufair CDN IP ACL blacklist`。
- **建议修复方向**：移除 ACL 绕过逻辑，改走合规的大陆节点（CLAUDE 约束本就要求北京 Mac Mini 节点）；异常至少记录日志。

### CORE-10 🟡 MEDIUM — `--dry-run` 使用空内存库，统计完全失真

- **文件**：`merge_engine.py:420`
- **问题描述**：`target_conn = init_db(...) if not dry_run else init_db(":memory:")`。dry-run 针对空白内存库做 `match_brand`/`next_brand_id`，结果是所有记录都被判为"新建品牌"、零匹配，统计数字无法反映对真实目标库的实际效果，失去预演价值。
- **证据**：dry-run 分支不读取真实 `target_db`。
- **建议修复方向**：dry-run 也连接真实目标库（只读/不 commit），或把现有目标数据载入内存后再统计。

### CORE-11 🟡 MEDIUM — `extract_geo` 子串/最早位置匹配易误判，且审计记录无意义

- **文件**：`tools/extract_geo.py:90-163`、`228-233`
- **问题描述**：(1) 城市匹配取"在名称中出现位置最早"的词条而非真正语义地点，"上海公司在北京办展"之类会误取"上海"；纯子串匹配也会把"南京"匹配进无关词。(2) 写库后向 `manual_tag_history` 插入 `field_name='geo_fields', new_value='auto_extract'` 的占位记录，不含真实新值，审计无意义。`update_db` 以裸 `except` 静默吞错。
- **证据**：`if pos>=0 and pos<matched_city_pos: matched_city=cp`；`VALUES (?, 'geo_fields', '', 'auto_extract', 'geo_extractor', ?)`。
- **建议修复方向**：加入边界/上下文校验，审计记录写真实字段与新值，异常打日志。

### CORE-12 🟡 MEDIUM — 并发线程写同一 SQLite 易触发 database is locked

- **文件**：`tools/backfill_organizer.py:204-211`、`update_db:119-139`
- **问题描述**：`ThreadPoolExecutor(max_workers=10)`，每个 `process_row` 在 `update_db` 各自 `sqlite3.connect` 后写库。SQLite 单写者模型下多线程并发写同一文件会出现 `database is locked`，当前无重试/超时设置，写失败仅计入 error 计数。
- **建议修复方向**：抓取并发、写库串行（单写线程/队列），或设 `PRAGMA busy_timeout` + 重试。

### CORE-13 🟡 MEDIUM — 多处裸 except 吞异常，失败不可观测

- **文件**：`tools/backfill_organizer.py:109`、`tools/backfill_organizer_local.py:88`、`tools/extract_geo.py:237`
- **问题描述**：`except Exception as e: return None/False` 且不记录 `e`，网络/解析/写库错误被静默吞掉，回填"未找到"与"真实失败"无法区分。
- **建议修复方向**：至少 `log.warning` 记录异常与 url/brand_id。

### CORE-14 🟡 MEDIUM — `export_monthly.py` 连接未托管 + 输入未校验

- **文件**：`export_monthly.py:23-35`、`42-55`
- **问题描述**：`get_month_range` 对 `sys.argv[1]` 直接 `map(int, ym.split('-'))`，非法入参（如 `2026/06`）会抛未捕获异常。`conn` 未置于 `try/finally`，查询异常时连接泄漏。`__main__` 解构 `path,label,count` 依赖 `export` 恒返回三元组（当前满足，但脆弱）。
- **建议修复方向**：校验 `YYYY-MM` 格式并给出友好报错；`with sqlite3.connect(...)` 托管连接。

### CORE-15 🟢 INFO — `geo_dict.py` 重复键与地名歧义

- **文件**：`tools/geo_dict.py`
- **问题描述**：`CN_CITIES` 中 `驻马店`(19,113)、`秦皇岛`(16,125)、`张家口`(24,126) 重复定义（后者覆盖前者，属冗余死代码）；`圣地亚哥`(美国 San Diego) 与 `圣地亚哥(智利)` 并存，纯子串匹配下"圣地亚哥"恒判为美国，存在歧义。
- **建议修复方向**：去重键；对歧义地名加国家上下文校验。

---

## 死代码与重复

1. **`backfill_organizer.py` vs `backfill_organizer_local.py` — 确认近重复（约 60-70% 重叠）**。
   - 重复部分：`update_db`（几乎逐行相同，仅 `changed_by` 取值 `auto_jufair_curl` vs `auto_jufair_opencli`）、CSV 读取、主循环统计、参数 `--dry-run/--delay/--db/--start/--limit`。
   - 真正差异：抓取机制不同（`curl` + 伪造 XFF vs `opencli` 本地 Chrome）。
   - 建议：抽出共享 `update_db`/CSV/循环骨架，抓取层做策略注入。**但这属于改动建议，按 CLAUDE 约束需先与客户确认是否合并**，本审查仅标注，不擅自重构。

2. **`scheduler.py` — 设计漂移（需客户决策，勿擅删）**。项目当前声称所有采集为手动触发（任务背景），而 `scheduler.py` 的 `--cron`（周一增量 / 每月 1 日全量）调度逻辑可能已废弃。此外其 `get_incremental_months` 对 1 月份存在记录在案的"不跨年"行为（1 月仅返回 `[1]`），与"最近 3 个月"语义不符。**这是文档/设计漂移，是否保留属客户决策，不建议在本阶段删除。**

3. **`import_tags.py` 的 `--tagger` 兼容参数（`tools/import_tags.py:103,107-112`）**。明确标注"兼容旧参数"，与 CLAUDE.md "不写兼容性代码，除非明确要求" 约束相悖。标注为约束漂移，是否移除请客户确认。

4. **`geo_dict.INFERENCE_RULES = {}`（655 行附近）为空字典 + `extract_geo` import 了它但仅在 `infer_country` 外未真正使用**——预留未启用逻辑，属约束 #2（最小代码）下的投机性预留，建议标注。

---

## 测试覆盖评估

**整体：解析层覆盖较好，但所有 BLOCKER 路径均未被测试触及。**

覆盖良好：
- `parse_numeric` / `parse_date_pair` / `merge_two_sources` 单元测试较充分（万单位、全角逗号、前缀标签、双源取最大、organizer 拼接等）。
- `schema` 约束测试（CHECK/NOT NULL/FK）到位。
- 打标导出/导入有端到端测试（`test_tagging_tools.py`）。

关键缺口（建议补测）：
- **CORE-01 未覆盖**：`test_next_brand_id_*` 只在纯数字、空库场景验证；无"库中存在十六进制 brand_id"用例。93 条集成测试用全新空库，永远命中不了该坍缩 bug。
- **CORE-02 未覆盖**：无"对同一目标库重复运行 `run_merge` 两次"的幂等性断言；现有集成测试只跑一次，看不到 `data_source` 追加与溯源膨胀。
- **CORE-03 未覆盖**：`TestNormalizeCity` 仅测 `上海上海/湖北武汉`（恰好是 2+2 真前缀），未含 `呼和浩特/乌鲁木齐` 等 4 字真城市，正好绕开截断 bug。
- **CORE-04 未覆盖**：`test_schema.py` 只断言 `init_db.sql` 基础列，不校验 migration 002-005 列，掩盖了 `init_db()` 不应用后续迁移的问题。
- **CORE-08 未覆盖**：日期测试无跨年区间、无"同月仅日范围"用例。
- **零覆盖模块**：`scheduler.py`、`research.py`、`export_monthly.py`、`extract_geo.py`、`backfill_organizer*.py`、`gen_briefing_doc.py` 无任何测试。

建议优先补：重复运行幂等性测试（覆盖 CORE-01/02/05）、4 字城市归一化测试（CORE-03）、migration 全量应用测试（CORE-04）。

---

_审查者：Claude (gsd-code-reviewer) · 深度：deep · 仅审查，未修改任何源文件_
