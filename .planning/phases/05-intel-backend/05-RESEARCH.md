# Phase 5: 情报后端 (Intelligence Backend) - Research

**Researched:** 2026-06-09
**Domain:** Claude Code Skills + SQLite Schema + 企查查 API + Python 情报引擎
**Confidence:** HIGH（核心技术栈），MEDIUM（企查查 API 细节）

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- D-01: **DB 优先** — 所有展会基础数据必须从 `mwlab.db` 查询，禁止 LLM 虚构展会数据
- D-02: **人工触发** — 所有操作均为人工执行，不做任何自动化调度
- D-03: **结果沉淀** — 每次调研结果必须持久化回 DB（新增专用表）
- D-04: **展会为核心键位** — 所有数据和分析以 `brand_id` / `edition_id` 为主键关联
- D-05: **Python 3.12+** — 与现有代码库保持一致
- D-06: **SQLite / mwlab.db** — 使用现有数据库，新增表
- D-07: **Claude Code Skills** — 每个调研模块封装为 `.claude/skills/` 中的 skill 文件
- D-08: **WebSearch** — 允许使用 Claude Code 内置 WebSearch 扩充 DB 以外的信息
- D-09: **企查查 API** — 批量/单一客户挖掘接入企查查（API Key 后续配置）
- D-10: **Markdown 报告** — 每次调研输出结构化 Markdown 报告文件 + 入库
- D-11: **行业调研输入** — `industry_l1` 或 `industry_l2` 标签（来自 DB）
- D-12: **行业调研输出** — 行业展会地图 + 竞争格局 + 可进入性分析
- D-13: **方法论框架** — TAM/SAM/SOM 估算 + Porter 五力简化版
- D-14: **品牌调研输入** — `brand_id`（通过名称搜索定位）
- D-15: **品牌调研输出** — 历史届次趋势 + 竞争对手对比 + MA 价值评估 + 战略建议
- D-16: **批量挖掘输入** — `brand_id`（竞品展会）+ 企查查搜索关键词
- D-17: **批量挖掘输出** — Excel/CSV 参展商名单 + 企查查扩充字段
- D-18: **单一挖掘输入** — 公司名称 / `brand_id` + 调查目的
- D-19: **单一挖掘输出** — 全息客户画像 Markdown + 风险标注
- D-20: 新增 `intel_report` 表
- D-21: 新增 `customer_prospect` 表
- D-22: 复用现有 `person` + `exhibition_contact` 表
- D-23: **4 个核心 Skill 文件** — industry-research, brand-research, batch-prospect, single-prospect
- D-24: **Skill 输入规范** — 每个 skill 接受 brand_id/industry 参数，优先从 DB 读取
- D-25: **结果追踪** — 每次 skill 执行后写入 `intel_report`

### Claude's Discretion

- 报告 Markdown 模板的具体格式
- 企查查 API 的具体调用封装方式（待 API Key 确认后实现）
- 行业竞争力评分的具体算法权重
- Skill 文件的内部提示词优化（后续迭代）

### Deferred Ideas (OUT OF SCOPE)

- 自动化调度（邮件触发 → 自动执行）
- 前端展示界面
- 多语言报告（中英双语）
- AI 评分模型（竞争力量化）
- Jufair/cnexpo 追加采集（Phase 1b 的工作）

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-01 | 根据品类/行业标签从 DB 聚合该行业展会列表 | DB 查询模式已确认；`industry_l1/l2` 索引已存在 |
| REQ-02 | 结合 WebSearch 补充行业市场趋势 | Skill 的 `allowed-tools: WebSearch` 支持 |
| REQ-03 | 输出行业竞争格局分析：头部玩家、切入点位、TAM 估算 | DB 聚合 + LLM 分析框架（见架构模式） |
| REQ-04 | TAM/SAM/SOM 框架 + Porter 五力校验可进入性 | 框架已明确，见方法论适配说明 |
| REQ-05 | 调研结果沉淀到 DB（industry_research 表） | CONTEXT.md 要求 `intel_report` 表统一存储 |
| REQ-06 | 从 DB 拉取目标品牌完整历史届次数据 | `exhibition_edition JOIN exhibition_brand` 查询 |
| REQ-07 | 分析竞争关系：同行业竞品展会列表、对比 | `exhibition_relation` 表已存在，直接复用 |
| REQ-08 | 调研主办方背景（WebSearch + 企查查 API） | P1 优先级，企查查 API 待接入 |
| REQ-09 | 输出战略评估：是否值得合作/收购/竞争 | MA 相关字段已在 `exhibition_brand` 表 |
| REQ-10 | 调研结果沉淀到 DB（brand_research 表） | 同 REQ-05，`intel_report` 按类型区分 |
| REQ-11 | 从 DB 获取目标竞品展会的参展商名单 | 注意：现有 DB 无参展商明细数据，详见开放问题 |
| REQ-12 | 接入企查查 API 进行参展商信息扩充 | API 签名方式已确认，见企查查 API 章节 |
| REQ-13 | 支持模糊搜索匹配 | 企查查 FuzzySearch/GetList 端点支持 |
| REQ-14 | 批量结果导出（Excel/CSV）供 BD 使用 | 复用 `tools/export_for_tagging.py` 的 openpyxl 模式 |
| REQ-15 | 挖掘结果沉淀到 DB（customer_prospect 表） | 新增表，schema 见下文 |
| REQ-16 | 针对单一目标做深度调研 | single-prospect skill 实现 |
| REQ-17 | 调取目标公司所有相关参展记录 | 跨展会匹配，DB 查询 + 企查查 KeyNo 关联 |
| REQ-18 | 接入企查查 API 获取工商信息 | P1 优先级，同 REQ-12 |
| REQ-19 | 输出客户画像：参与轨迹、潜在需求、风险标注 | Markdown 报告 + `intel_report` 入库 |
| REQ-20 | 调研结果沉淀到 DB（customer_profile 表） | 注意：CONTEXT.md D-22 是复用 `person` 表，而非单独建 customer_profile；需澄清（见开放问题） |
| REQ-21 | 每个调研模块写为 Claude Code skill | SKILL.md 格式已完整确认 |
| REQ-22 | Skill 以展会品牌 (brand_id/edition_id) 为核心输入参数 | `$ARGUMENTS` 或命名参数支持 |
| REQ-23 | 所有展会基础数据必须来自 mwlab.db | DB 优先原则，Skill 中显式加载 DB 数据 |
| REQ-24 | 全部操作为人工触发 | `disable-model-invocation: true` 设置 |
| REQ-25 | 调研报告输出为结构化 Markdown | 每个 skill 包含 Markdown 模板 |

</phase_requirements>

---

## Summary

Phase 5 构建纯后端的四层展会情报系统，核心是把 Claude Code 的 AI 能力和 mwlab.db 的结构化数据结合起来，通过 4 个 Claude Code Skills 文件封装复用。每个 skill 作为一个可交互的「调研程序」：用户通过 `/skill-name brand_id=EXPO-XXXX` 触发，skill 先从 DB 查询基础数据（避免 LLM 虚构），再通过 WebSearch 和/或企查查 API 补充外部信息，最后生成结构化 Markdown 报告并持久化入库。

技术实现以三条主线为核：(1) **Claude Code Skill 文件**（`.claude/skills/` 目录下的 SKILL.md，通过 `!` 命令注入 DB 查询结果）；(2) **新 DB 表**（`intel_report` 统一存储所有报告，`customer_prospect` 存储批量挖掘结果）；(3) **配套 Python 脚本**（直接操作 sqlite3，不通过 FastAPI，保持工具脚本风格与 `tools/` 目录一致）。

需要特别注意的是：当前 mwlab.db 没有参展商明细数据（`exhibition_edition` 只有聚合数字 `exhibitors_count`，没有展商企业名单），批量客户挖掘模块的输入数据来源需要在规划阶段明确——要么直接通过企查查搜索展会关键词，要么接受手工提供参展商名单。

**Primary recommendation:** 每个 skill 文件用 `!` 命令注入 Python 脚本的 DB 查询输出，这是最简洁的「DB 优先」实现方式，完全不依赖 FastAPI，与现有 `tools/` 模式一致。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 行业展会地图聚合 | DB 查询脚本 | LLM 分析（Skill） | 数量/规模数据来自 DB，分析框架由 LLM 完成 |
| 竞争关系网络 | DB 查询（exhibition_relation） | LLM 解读（Skill） | 关系表已存在，无需外部数据 |
| TAM/SAM/SOM 估算 | LLM 推理（Skill） | WebSearch 补充 | 框架计算由 LLM 完成，数值需外部来源 |
| 历史届次趋势分析 | DB 查询（exhibition_edition） | LLM 分析（Skill） | 所有时序数据在 DB |
| 参展商名单 | 企查查 API | DB 关键词匹配 | DB 无参展商明细，企查查是主要来源 |
| 企业工商信息 | 企查查 API | WebSearch 补充 | 工商注册数据企查查最权威 |
| 客户画像生成 | LLM 合成（Skill） | 企查查 + DB 数据输入 | 跨源数据汇总后由 LLM 生成 |
| 报告持久化 | DB 写入（intel_report 表） | Markdown 文件 | 两路输出，DB 用于查询，文件用于分享 |
| Excel 导出 | Python 脚本（openpyxl） | — | 复用 export_for_tagging.py 模式 |

---

## Standard Stack

### Core（已安装，已验证）

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python | 3.12.8 | 运行时 | 项目约束 D-05 |
| SQLite3 | (stdlib) | DB 读写 | 直连 mwlab.db，无需 ORM |
| openpyxl | 3.1.5 | Excel 导出 | 已用于 export_for_tagging.py |
| pandas | 3.0.2 | 数据处理 | 已安装，表格操作 |
| requests | 2.33.1 | HTTP 调用 | 企查查 API |
| hashlib | (stdlib) | MD5 签名 | 企查查 Token 生成 |
| fastapi | 0.136.1 | (可选) | 若需 API 端点，参考 tag_api.py 模式 |

[VERIFIED: pip3 list on target machine]

### Supporting（无需额外安装）

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| json | (stdlib) | 报告序列化 | intel_report.params_json 字段 |
| datetime | (stdlib) | 时间戳生成 | 企查查 Timespan + 报告创建时间 |
| pathlib | (stdlib) | 文件路径 | Markdown 报告文件输出 |
| argparse | (stdlib) | CLI 参数 | Python 脚本命令行接口 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 直连 sqlite3 | FastAPI + SQLAlchemy | 情报脚本无需 API 层，直连更简单，与 tools/ 模式一致 |
| openpyxl 导出 | CSV 导出 | openpyxl 支持格式和数据校验，BD 需求优先 Excel |
| 企查查 API | 天眼查/启信宝 API | 客户指定企查查，不做替换 |

**Installation:** 无需安装新依赖，所有包已在环境中 [VERIFIED]

---

## Architecture Patterns

### System Architecture Diagram

```
用户输入 (brand_id / industry_tag / company_name)
    │
    ▼
.claude/skills/<skill-name>/SKILL.md
    │
    ├── !`python3 tools/intel/db_query.py --brand_id $0`  ← DB 数据注入
    │       │
    │       └── mwlab.db
    │           ├── exhibition_brand (品牌基础信息)
    │           ├── exhibition_edition (历史届次)
    │           ├── exhibition_relation (竞争/合作关系)
    │           └── person / exhibition_contact (联系人)
    │
    ├── WebSearch (行业趋势 / 主办方背景) ← 由 LLM 在 skill 执行中调用
    │
    ├── 企查查 API (可选: 工商信息扩充)
    │   └── https://api.qichacha.com/FuzzySearch/GetList
    │
    ▼
LLM 分析生成 (Claude Code 内)
    │
    ├── Markdown 报告 → reports/<type>/<date>-<id>.md
    │
    └── DB 写入
        ├── intel_report (所有报告统一存储)
        └── customer_prospect (批量挖掘结果)
```

### Recommended Project Structure

```
.claude/skills/
├── industry-research/
│   └── SKILL.md              # 行业调研 skill
├── brand-research/
│   └── SKILL.md              # 品牌展会调研 skill
├── batch-prospect/
│   └── SKILL.md              # 批量客户挖掘 skill
└── single-prospect/
    └── SKILL.md              # 单一客户挖掘 skill

tools/intel/
├── db_query.py               # DB 聚合查询（供 skill !命令调用）
├── qcc_client.py             # 企查查 API 封装
├── report_writer.py          # 报告写入 DB + 文件
└── export_prospects.py       # Excel/CSV 导出（复用 export_for_tagging 模式）

schema/
└── phase5_tables.sql         # intel_report + customer_prospect DDL

reports/
├── industry/                 # 行业调研 Markdown 文件
├── brand/                    # 品牌调研 Markdown 文件
└── customer/                 # 客户画像 Markdown 文件
```

### Pattern 1: Claude Code Skill 结构（DB 优先注入模式）

**What:** 每个 SKILL.md 用 `!` 命令在 Claude 读取 skill 前运行 Python 脚本，把 DB 数据注入到 prompt 上下文，LLM 分析时基于真实数据而非虚构。

**When to use:** 所有需要 DB 数据的 skill，尤其 REQ-23 要求禁止 LLM 虚构。

```yaml
# .claude/skills/brand-research/SKILL.md
---
name: brand-research
description: 对目标展会品牌进行完整调研分析。输入 brand_id 或品牌名称，输出历史届次趋势、竞争网络、MA 价值评估和战略建议。
argument-hint: "[brand_id 或品牌名称]"
disable-model-invocation: true
allowed-tools: Bash WebSearch Read Write
---

## 输入参数

目标品牌: $ARGUMENTS

## DB 数据（自动注入，禁止修改）

!`python3 tools/intel/db_query.py brand-research "$ARGUMENTS"`

## 分析任务

基于以上 DB 数据，按以下框架输出品牌调研报告（Markdown 格式）：

1. 基本信息摘要
2. 历史届次趋势（数据必须来自上方 DB 数据）
3. 竞争关系网络（基于 exhibition_relation 表数据）
4. MA 价值评估（综合 ma_potential、strategic_relevance、规模趋势）
5. 战略建议（不超过 500 字）

完成后执行：
\`\`\`bash
python3 tools/intel/report_writer.py --type brand_research --input_id "$ARGUMENTS" --content "$(cat /tmp/report_output.md)"
\`\`\`
```

[VERIFIED: claude.ai/docs/skills 官方文档，`!` 命令语法确认]

### Pattern 2: DB 查询脚本结构

**What:** `tools/intel/db_query.py` 作为 skill 的数据获取后端，直接操作 sqlite3，输出格式化文本供 LLM 读取。

**When to use:** 所有 skill 的 DB 数据加载阶段。

```python
# tools/intel/db_query.py
#!/usr/bin/env python3
"""
Skill DB 数据注入脚本 — 供 Claude Code skill 的 !`command` 调用
用法: python3 tools/intel/db_query.py brand-research "EXPO-0001"
      python3 tools/intel/db_query.py industry-research "机械和设备"
"""
import sys
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "mwlab.db"

def brand_research(identifier: str) -> str:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    # 先尝试 brand_id，再尝试 name_cn 模糊匹配
    row = conn.execute(
        "SELECT * FROM exhibition_brand WHERE brand_id = ? OR name_cn LIKE ?",
        (identifier, f"%{identifier}%")
    ).fetchone()
    if not row:
        return f"错误: 未找到品牌 '{identifier}'"
    
    editions = conn.execute(
        "SELECT year, area_sqm, exhibitors_count, visitors_count, city, status "
        "FROM exhibition_edition WHERE brand_id = ? ORDER BY year DESC LIMIT 10",
        (row["brand_id"],)
    ).fetchall()
    
    relations = conn.execute(
        "SELECT b.name_cn, b.brand_id, r.relation_type, r.notes "
        "FROM exhibition_relation r "
        "JOIN exhibition_brand b ON b.brand_id = r.to_brand_id "
        "WHERE r.from_brand_id = ?",
        (row["brand_id"],)
    ).fetchall()
    
    # 格式化输出（供 LLM 读取）
    output = [
        f"### 品牌基本信息",
        f"- brand_id: {row['brand_id']}",
        f"- 中文名: {row['name_cn']}",
        f"- 英文名: {row['name_en']}",
        f"- 主办方: {row['organizer']}",
        f"- 行业: {row['industry_l1']} / {row['industry_l2']}",
        f"- MA潜力: {row['ma_potential']} / 战略相关性: {row['strategic_relevance']}",
        f"- 规模评分: {row['scale_score']}",
        "",
        f"### 历史届次数据（最近10届）",
    ]
    for e in editions:
        output.append(
            f"- {e['year']}: 面积={e['area_sqm']}m², "
            f"展商={e['exhibitors_count']}, 观众={e['visitors_count']}, "
            f"城市={e['city']}, 状态={e['status']}"
        )
    output.append("")
    output.append("### 竞争关系网络")
    for r in relations:
        output.append(f"- [{r['relation_type']}] {r['name_cn']} ({r['brand_id']}): {r['notes'] or ''}")
    
    conn.close()
    return "\n".join(output)

# Source: 基于项目现有 tools/export_for_tagging.py 模式
```

### Pattern 3: 企查查 API 封装

**What:** `tools/intel/qcc_client.py` 封装企查查签名认证和模糊搜索。

```python
# tools/intel/qcc_client.py
import hashlib
import time
import requests
import os

QCC_BASE_URL = "https://api.qichacha.com"

def _make_token(app_key: str, secret_key: str) -> tuple[str, str]:
    timespan = str(int(time.time()))
    raw = f"{app_key}{timespan}{secret_key}"
    token = hashlib.md5(raw.encode()).hexdigest().upper()
    return token, timespan

def fuzzy_search(keyword: str, page_index: int = 1, page_size: int = 10) -> dict:
    """
    企查查模糊搜索。API Key 从环境变量读取。
    """
    app_key = os.environ.get("QCC_APP_KEY", "PLACEHOLDER_KEY")
    secret_key = os.environ.get("QCC_SECRET_KEY", "PLACEHOLDER_SECRET")
    
    token, timespan = _make_token(app_key, secret_key)
    headers = {"Token": token, "Timespan": timespan}
    params = {
        "key": app_key,
        "searchKey": keyword,
        "pageIndex": str(page_index),
        "pageSize": str(page_size),
    }
    resp = requests.get(
        f"{QCC_BASE_URL}/FuzzySearch/GetList",
        headers=headers,
        params=params,
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()

# 注意：API Key 未配置时返回占位符数据，不抛出异常
# Source: [CITED: https://blog.csdn.net/zhensherlock/article/details/147142249]
```

### Anti-Patterns to Avoid

- **LLM 虚构展会数据：** skill 中必须通过 `!` 命令先注入 DB 数据，再让 LLM 分析，禁止直接让 LLM 描述展会情况。
- **在 skill 里直接写 SQL：** 查询逻辑集中在 `tools/intel/db_query.py`，skill 只调用脚本，避免 SQL 散落在 SKILL.md 中。
- **在 skill 里硬编码 API Key：** 企查查凭证通过环境变量注入，脚本有占位符降级模式。
- **FastAPI 封装情报脚本：** 这是人工触发的 CLI 工具，不是 Web 服务，无需 HTTP 层。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Excel 导出 | 自定义 Excel 生成 | openpyxl（参考 export_for_tagging.py） | 已有完整实现，含数据校验和格式 |
| HTTP 请求 + 重试 | 自定义 HTTP 客户端 | requests（已安装） | 处理 SSL、重定向、超时 |
| MD5 签名 | 自定义签名 | hashlib（stdlib） | 一行实现，无需第三方 |
| DB 连接管理 | 自定义连接池 | sqlite3（stdlib） + context manager | 单用户工具，无并发需求 |
| Markdown 渲染 | 自定义渲染器 | 直接输出 Markdown 字符串 | Claude Code 原生显示 Markdown |

**Key insight:** 情报工具是单用户 CLI 脚本，不是服务，复杂度应比 FastAPI 低一档。

---

## DB Schema 设计

### 新增表：intel_report（统一报告存储）

```sql
-- schema/phase5_tables.sql
CREATE TABLE IF NOT EXISTS intel_report (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type     TEXT    NOT NULL
                        CHECK (report_type IN (
                            'industry_research',
                            'brand_research',
                            'batch_prospect',
                            'single_prospect'
                        )),
    -- 输入参数（根据类型填写）
    brand_id        TEXT    REFERENCES exhibition_brand(brand_id) ON DELETE SET NULL,
    industry_l1     TEXT,
    industry_l2     TEXT,
    target_company  TEXT,   -- 单一客户挖掘时的目标公司名
    params_json     TEXT    NOT NULL DEFAULT '{}',  -- 完整输入参数 JSON
    -- 输出
    report_md       TEXT    NOT NULL DEFAULT '',    -- Markdown 报告正文
    report_file     TEXT    NOT NULL DEFAULT '',    -- 文件路径（相对项目根）
    -- 元数据
    status          TEXT    NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'archived')),
    created_by      TEXT    NOT NULL DEFAULT 'claude-code',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_intel_report_type
    ON intel_report(report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_report_brand
    ON intel_report(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intel_report_industry
    ON intel_report(industry_l1, industry_l2) WHERE industry_l1 IS NOT NULL;
```

**设计决策：**
- `intel_report` 统一所有报告类型（D-20 要求 `industry_research` 表，CONTEXT.md D-20/D-10 都存入此表），通过 `report_type` 区分。REQUIREMENTS.md REQ-05/REQ-10 的 `industry_research`/`brand_research` 表可用视图替代，或计划中明确为 `intel_report` 的不同 `report_type`。
- `report_md` 直接存储 Markdown 文本，便于历史对比和全文检索。
- `report_file` 记录文件路径，便于外部工具读取。

### 新增表：customer_prospect（批量挖掘结果）

```sql
CREATE TABLE IF NOT EXISTS customer_prospect (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 关联
    intel_report_id     INTEGER REFERENCES intel_report(id) ON DELETE SET NULL,
    brand_id            TEXT    REFERENCES exhibition_brand(brand_id) ON DELETE SET NULL,
    -- 来源信息
    source_type         TEXT    NOT NULL
                            CHECK (source_type IN ('qcc_search', 'manual', 'db_match')),
    -- 企查查字段
    qcc_key_no          TEXT,   -- 企查查唯一标识（KeyNo）
    company_name        TEXT    NOT NULL,
    credit_code         TEXT,   -- 统一社会信用代码
    oper_name           TEXT,   -- 法定代表人
    start_date          TEXT,   -- 成立日期
    company_status      TEXT,   -- 企业状态
    reg_no              TEXT,   -- 注册号
    address             TEXT,
    -- BD 评估字段
    prospect_score      INTEGER CHECK (prospect_score IS NULL OR prospect_score BETWEEN 1 AND 5),
    contact_status      TEXT    NOT NULL DEFAULT ''
                            CHECK (contact_status IN ('未接触', '已接触', '谈判中', '合作中', '放弃', '')),
    notes               TEXT    NOT NULL DEFAULT '',
    -- 元数据
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_prospect_brand
    ON customer_prospect(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_company
    ON customer_prospect(company_name);
CREATE INDEX IF NOT EXISTS idx_prospect_qcc
    ON customer_prospect(qcc_key_no) WHERE qcc_key_no IS NOT NULL;
```

---

## 企查查 API 详情

### 认证方式

[CITED: https://blog.csdn.net/zhensherlock/article/details/147142249]

```
Token = MD5(AppKey + Timespan + SecretKey).upper()  # 32位大写
```

请求头：`Token: <token>`, `Timespan: <unix_timestamp_秒>`

### 主要端点

| 端点 | 路径 | 用途 |
|------|------|------|
| 企业模糊搜索 | `GET /FuzzySearch/GetList` | 根据关键词搜索企业列表 |
| 企业详情 | `GET /ECIV4/GetBasicDetailsByName` | 根据公司名获取详情（另计费） |

**模糊搜索参数：**
- `key`: AppKey
- `searchKey`: 搜索关键词（企业名、人名等）
- `pageSize`: 每页数量（默认10，最大20）
- `pageIndex`: 页码（默认1）

**响应结构：**
```json
{
  "Status": "200",
  "Result": [
    {
      "KeyNo": "企查查内部唯一ID",
      "Name": "企业名称",
      "CreditCode": "统一社会信用代码",
      "StartDate": "YYYY-MM-DD",
      "OperName": "法定代表人",
      "Status": "存续（在营、开业、在册）",
      "No": "注册号",
      "Address": "注册地址"
    }
  ]
}
```

**计费：** 约 ¥0.10/次（20次免费测试）[MEDIUM 置信度 - CITED: CSDN 博客，非官方定价页]

**API Key 状态：** 待客户提供（D-09）。代码需预留占位符模式。

---

## 现有 DB 数据分析

### 可直接使用的数据

[VERIFIED: sqlite3 查询]

- `exhibition_brand`: 5,856 条品牌，字段完整（industry_l1/l2 100% 覆盖，ma_potential/strategic_relevance 部分填写）
- `exhibition_edition`: 6,129 条届次，含 area_sqm、exhibitors_count、visitors_count
- `exhibition_relation`: 0 条（表存在但无数据 — 竞争关系打标尚未执行）
- `person` + `exhibition_contact`: 0 条（表存在但无数据）
- `exhibition_timeline`: 表存在，无数据

**关键发现：** `exhibition_relation`、`person`、`exhibition_contact` 三张表虽已建立，但当前均为空。品牌调研的竞争关系分析（REQ-07）需要从 `exhibition_brand` 的 `industry_l1/l2` 字段做同行业对比，而不能依赖 `exhibition_relation` 表的现有数据。

### 参展商数据缺口（高风险）

当前 `exhibition_edition` 表只存储**聚合数字**（`exhibitors_count`），没有参展企业的名单明细。这意味着：

- REQ-11「从 DB 获取目标竞品展会的参展商名单」无法直接从 DB 实现
- 批量客户挖掘（REQ-11～REQ-15）的实际输入来源是：(a) 手工提供参展商名单，或 (b) 直接用企查查搜索展会关键词，或 (c) 将来通过爬虫补充参展商明细表

这是规划阶段需要明确的最重要约束。

### 行业分布（用于行业调研 skill）

```
机械和设备: 2,573 品牌（44%）
生活方式:   1,259 品牌（21%）
休闲:         678 品牌（12%）
科技+:        519 品牌（9%）
化工与能源:   300 品牌（5%）
医疗和健康:   263 品牌（4%）
零售贸易:     154 品牌（3%）
农业与畜牧:   110 品牌（2%）
```

---

## Claude Code Skill 规范（完整确认）

[VERIFIED: code.claude.com/docs/en/skills]

### 关键 Frontmatter 字段

```yaml
---
name: display-name           # 可选，显示名称（不影响调用命令）
description: 使用场景描述    # 推荐，Claude 用于自动加载判断
argument-hint: "[brand_id]"  # 参数提示
disable-model-invocation: true  # 必填：防止 Claude 自动触发（人工触发原则 D-02）
allowed-tools: Bash WebSearch Read Write  # 工具白名单
---
```

### 动态上下文注入（DB 优先的关键机制）

```markdown
## DB 数据
!`python3 tools/intel/db_query.py brand-research "$ARGUMENTS"`
```

`!` 命令在 Claude 读取 skill 内容之前执行，输出替换这一行，LLM 看到的是真实 DB 数据。

### 参数传递

```bash
/brand-research EXPO-0001           # $ARGUMENTS = "EXPO-0001"
/industry-research 机械和设备        # $ARGUMENTS = "机械和设备"
```

### 存储位置

| 位置 | 路径 | 作用域 |
|------|------|--------|
| 项目级 skill | `.claude/skills/<name>/SKILL.md` | 仅本项目（推荐，与代码库一起提交） |
| 个人级 skill | `~/.claude/skills/<name>/SKILL.md` | 跨项目可用 |

**决策：** 情报 skill 放在项目级 `.claude/skills/`，因为它们依赖特定 DB 结构。

---

## TAM/SAM/SOM 框架在展会行业的适配

[ASSUMED] 以下是框架适配展会行业的方法论设计，基于训练知识，非外部文献验证。

### Porter 五力简化版（展会行业）

| 五力 | 展会行业映射 | 在 Skill 中的数据来源 |
|------|------------|-------------------|
| 新进入者威胁 | 同行业近3年新增展会数量、进入门槛（面积/展商数要求） | DB: exhibition_edition 年份分布 |
| 替代品威胁 | 线上展会/垂直电商是否替代展位 | WebSearch |
| 买方议价 | 参展商集中度、大展商占比 | DB: exhibitors_count 分布 |
| 供方议价 | 场馆稀缺性、主办方议价能力 | DB: venue/city 分布 |
| 竞争强度 | 同行业展会数量、头部集中度 | DB: exhibition_brand count by industry |

### TAM/SAM/SOM 估算方法

```
TAM（全球展会市场）= WebSearch 补充（UFI 统计等）
SAM（目标行业中国展会）= DB: COUNT(brand_id) WHERE industry_l1 = X × 平均展会收入估算
SOM（MDS 可实际进入份额）= SAM × 可接触比例（基于城市分布、is_international 字段）
```

---

## Common Pitfalls

### Pitfall 1: exhibition_relation 表为空
**What goes wrong:** skill 调用 `SELECT * FROM exhibition_relation WHERE from_brand_id = ?` 返回空结果，LLM 报告「无竞争关系数据」，让 BD 误以为没有竞争对手。
**Why it happens:** 关系表虽存在，但竞争关系打标尚未执行（当前 0 条）。
**How to avoid:** brand-research skill 的竞争分析必须双轨：(1) 先查 `exhibition_relation`；(2) 若为空，fallback 到 `SELECT brand_id, name_cn FROM exhibition_brand WHERE industry_l1 = :target_l1`，给出同行业展会列表作为竞争参考。
**Warning signs:** db_query.py 输出「竞争关系网络: （无数据）」时触发 fallback。

### Pitfall 2: 企查查 Token 过期（时间戳精度）
**What goes wrong:** 请求返回 401 或签名错误，企业搜索失败。
**Why it happens:** Token 基于 Unix 时间戳，每次请求需重新生成，不能复用。
**How to avoid:** `_make_token()` 在每次 HTTP 调用前实时生成，不缓存。
**Warning signs:** 响应 `Status != "200"` 时打印完整错误信息，包括 Timespan。

### Pitfall 3: Skill !`command` 输出过大
**What goes wrong:** db_query.py 输出数千行数据，撑满 LLM 上下文窗口，导致分析质量下降或请求失败。
**Why it happens:** `exhibition_edition` 某些品牌有数十年历史届次。
**How to avoid:** db_query.py 始终限制输出行数（`LIMIT 10`），并只输出关键字段，不输出 raw_payload。
**Warning signs:** 单次 DB 查询输出超过 200 行时发出警告。

### Pitfall 4: 报告入库时 Markdown 内含特殊字符
**What goes wrong:** `INSERT INTO intel_report (report_md) VALUES (?)` 失败，因报告中含有单引号或特殊 SQLite 字符。
**Why it happens:** Markdown 报告可能包含 SQL 保留字符。
**How to avoid:** 始终使用参数化查询（`conn.execute("...", (report_md,))`），永远不做字符串拼接 SQL。

### Pitfall 5: 批量挖掘无参展商明细数据
**What goes wrong:** batch-prospect skill 执行时无法从 DB 获取参展商名单，整个模块失效。
**Why it happens:** DB 只有聚合数字，无参展商企业名单。
**How to avoid:** 在 batch-prospect skill 中明确输入方式：接受手工提供的参展商关键词列表，或直接用展会名称+行业词在企查查搜索。

---

## Code Examples

### DB 查询：同行业展会列表

```python
# Source: 项目 tools/export_for_tagging.py 模式
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "mwlab.db"

def get_industry_brands(industry_l1: str) -> list[dict]:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT brand_id, name_cn, organizer, city, scale_score, "
        "       ma_potential, strategic_relevance, is_ufi_certified "
        "FROM exhibition_brand "
        "WHERE industry_l1 = ? "
        "ORDER BY scale_score DESC NULLS LAST",
        (industry_l1,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
```

### 报告写入 DB

```python
# tools/intel/report_writer.py
import sqlite3
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "mwlab.db"
REPORTS_DIR = Path(__file__).resolve().parent.parent.parent / "reports"

def write_report(
    report_type: str,
    params: dict,
    content_md: str,
    brand_id: str | None = None,
) -> int:
    """写入 intel_report 并保存 Markdown 文件，返回 report.id"""
    # 保存文件
    subdir = REPORTS_DIR / report_type
    subdir.mkdir(parents=True, exist_ok=True)
    date_str = datetime.now().strftime("%Y%m%d-%H%M%S")
    file_name = f"{date_str}-{brand_id or params.get('industry_l1', 'unknown')}.md"
    file_path = subdir / file_name
    file_path.write_text(content_md, encoding="utf-8")
    
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.execute(
        "INSERT INTO intel_report "
        "(report_type, brand_id, params_json, report_md, report_file, created_by) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (report_type, brand_id, json.dumps(params, ensure_ascii=False),
         content_md, str(file_path.relative_to(DB_PATH.parent)), "claude-code")
    )
    conn.commit()
    report_id = cur.lastrowid
    conn.close()
    return report_id
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` Markdown 文件 | `.claude/skills/<name>/SKILL.md` 目录结构 | Claude Code 近期版本 | 支持 supporting files + frontmatter |
| 手动参数传递 | `$ARGUMENTS` / `$N` / 命名参数占位符 | Agent Skills v1.0 规范 | Skill 可以接受 CLI 风格参数 |
| 固定工具权限 | `allowed-tools` frontmatter | 当前版本 | 细粒度工具授权，无需每次确认 |

**Deprecated/outdated:**
- `.claude/commands/` 目录：仍然有效，但 `.claude/skills/` 是推荐新标准，支持更多特性

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Porter 五力框架适配展会行业的字段映射方式 | TAM/SAM/SOM 框架 | 方法论不适用，需要 BD 团队明确框架要求 |
| A2 | intel_report 一张表满足 REQ-05（industry_research）和 REQ-10（brand_research）的存储需求 | DB Schema | REQUIREMENTS.md 提到单独表名，若需严格分表则需额外 DDL |
| A3 | REQ-20 的 customer_profile 表和 CONTEXT.md D-22 的「复用 person 表」是同一需求的不同表述 | Phase Requirements | 若需单独 customer_profile 表，schema 需扩充 |
| A4 | 企查查 API 价格约 ¥0.10/次 | 企查查 API 详情 | 定价可能已变，需查阅官方最新报价 |
| A5 | 批量挖掘的输入是手工提供参展商关键词（因 DB 无明细） | 现有 DB 数据分析 | 若 BD 期望直接从 DB 获取参展商名单，需要先执行参展商数据采集 |

---

## Open Questions (RESOLVED)

1. **REQ-11 参展商名单来源** ✅ 已解决
   - What we know: `exhibition_edition` 只有 `exhibitors_count`（聚合数字），无展商企业名单
   - **Decision (adopted in 05-06-PLAN.md):** batch-prospect 采用「用户提供关键词 + 企查查搜索」模式。用户提供参展商关键词列表（可来自展会行业关键词），Skill 通过企查查 FuzzySearch 扩展候选企业。DB 无参展商明细这一限制在 Skill 中明确告知用户。

2. **REQ-05 vs D-20: industry_research 表还是 intel_report 表** ✅ 已解决
   - What we know: REQUIREMENTS.md REQ-05 提到「沉淀到 industry_research 表」，CONTEXT.md D-20 要求「intel_report 表统一存储」
   - **Decision (adopted in 05-01-PLAN.md):** 采用 `intel_report` 统一表 + `report_type` 字段区分。REQ-05 的 `industry_research` 表、REQ-10 的 `brand_research` 表均通过 `report_type='industry_research'` / `'brand_research'` 实现，不分别建表。

3. **REQ-20 customer_profile 表 vs D-22 复用 person 表** ✅ 已解决
   - What we know: REQ-20 要求「customer_profile 表」，D-22 说「复用 person + exhibition_contact 表」
   - **Decision (adopted in 05-07-PLAN.md):** 深度画像报告入 `intel_report`（`report_type='single_prospect'`），联系人信息写入 `person` + `exhibition_contact` 表（符合 D-22 和 D-25 要求），不另建 `customer_profile` 表。

4. **exhibition_relation 表当前为空** ✅ 已解决
   - What we know: 0 条数据，brand-research skill 的竞争网络分析会退化为同行业列表
   - **Decision (adopted in 05-02-PLAN.md, 05-05-PLAN.md):** 双轨 fallback——有关系数据时用 `exhibition_relation` 表，无数据时 fallback 到同 `industry_l1` 展会聚合列表。Skill 在报告中明确说明数据来源，不阻塞 Phase 5 执行。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Python 3.12+ | 所有脚本 | ✓ | 3.12.8 | — |
| sqlite3 | DB 查询 | ✓ | stdlib | — |
| requests | 企查查 API | ✓ | 2.33.1 | — |
| openpyxl | Excel 导出 | ✓ | 3.1.5 | — |
| pandas | 数据处理 | ✓ | 3.0.2 | — |
| hashlib | MD5 签名 | ✓ | stdlib | — |
| 企查查 API Key | 企业查询 | ✗ | — | 代码占位符，功能降级（仅 DB 模式） |

**Missing dependencies with no fallback:** 无（本地运行所需工具全部已安装）

**Missing dependencies with fallback:**
- 企查查 API Key: 缺失时降级到「仅 DB 查询」模式，批量/单一客户挖掘模块的外部扩充功能不可用但不阻塞脚本执行

---

## Project Constraints (from CLAUDE.md)

- **不写兼容性代码**，除非明确要求
- **命名**：snake_case 文件名，snake_case 字段名（所有新 DB 表字段遵循）
- **API 端点**：`/api/资源-名/动作`，小写连字符（若本 Phase 需要 FastAPI 端点）
- **数据库表**：snake_case 单数命名（新增表：`intel_report`，`customer_prospect`）
- **改动超过三个文件时，先拆分任务**（情报系统分4个模块，每模块独立波次）
- **禁止使用 `mcp__claude-in-chrome__*` 工具**
- **WebSearch 通过 Claude Code 内置工具**，不通过 gstack `/browse`（情报 skill 中使用 `WebSearch` 工具直接调用）

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: code.claude.com/docs/en/skills] — SKILL.md 完整规范，frontmatter 字段，`!` 命令语法，参数替换
- [VERIFIED: sqlite3 mwlab.db 直接查询] — 表结构、数据量、现有字段、relation 表为空确认
- [VERIFIED: pip3 list] — Python 包版本，所有依赖已安装

### Secondary (MEDIUM confidence)
- [CITED: blog.csdn.net/zhensherlock/article/details/147142249] — 企查查 FuzzySearch API 端点、签名方式、响应结构
- [CITED: openapi.qcc.com] — 企查查开放平台主要 API 分类

### Tertiary (LOW confidence)
- [ASSUMED] TAM/SAM/SOM + Porter 五力在展会行业的具体字段映射（训练知识，未找到展会行业专属文献）

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — 所有包已验证安装
- Architecture: HIGH — Skill 文档来自官方，DB 结构直接查询确认
- 企查查 API: MEDIUM — 端点和签名方式经第三方博客验证，价格和 Rate Limit 未获官方数据
- Pitfalls: HIGH — 大部分基于 DB 实际数据（如 exhibition_relation 为空）
- 方法论框架: LOW — 训练知识，未外部验证

**Research date:** 2026-06-09
**Valid until:** 2026-07-09（企查查 API 细节可能变化较快）
