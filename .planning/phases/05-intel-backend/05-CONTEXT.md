# Phase 5: 情报后端 (Intelligence Backend) — Context

**Gathered:** 2026-06-09  
**Status:** Ready for planning  
**Source:** BD 客户需求 (Messe Düsseldorf China)

<domain>
## Phase Boundary

本 Phase 构建纯后端的四层展会情报系统，供 BD 团队人工操作使用。

**在 scope 内：**
- 行业调研引擎（DB 聚合 + WebSearch）
- 品牌展会调研引擎（历史届次分析 + 竞争网络）
- 批量客户挖掘（企查查 API + 参展商模糊匹配）
- 单一客户深度挖掘（全息客户画像）
- Claude Code Skills 封装（可复用 + 可迭代）
- 新 DB 表（存储调研结果和客户 prospect）

**不在 scope 内：**
- 任何前端 UI（React/Next.js/HTML）
- 自动化调度（不做 cron/定时触发）
- 爬虫改造（爬虫已完成）
- 历史数据迁移

</domain>

<decisions>
## Implementation Decisions

### 核心原则（LOCKED）
- D-01: **DB 优先** — 所有展会基础数据必须从 `mwlab.db` 查询，禁止 LLM 虚构展会数据
- D-02: **人工触发** — 所有操作均为人工执行，不做任何自动化调度
- D-03: **结果沉淀** — 每次调研结果必须持久化回 DB（新增专用表）
- D-04: **展会为核心键位** — 所有数据和分析以 `brand_id` / `edition_id` 为主键关联

### 技术栈（LOCKED）
- D-05: **Python 3.12+** — 与现有代码库保持一致
- D-06: **SQLite / mwlab.db** — 使用现有数据库，新增表
- D-07: **Claude Code Skills** — 每个调研模块封装为 `.claude/skills/` 中的 skill 文件
- D-08: **WebSearch** — 允许使用 Claude Code 内置 WebSearch 扩充 DB 以外的信息
- D-09: **企查查 API** — 批量/单一客户挖掘接入企查查（API Key 后续配置）
- D-10: **Markdown 报告** — 每次调研输出结构化 Markdown 报告文件 + 入库

### 调研模块设计（LOCKED）
- D-11: **行业调研输入** — `industry_l1` 或 `industry_l2` 标签（来自 DB）
- D-12: **行业调研输出** — 行业展会地图（数量/规模分布）+ 竞争格局 + 可进入性分析
- D-13: **方法论框架** — TAM/SAM/SOM 估算 + Porter 五力简化版（适配展会行业）
- D-14: **品牌调研输入** — `brand_id`（通过名称搜索定位）
- D-15: **品牌调研输出** — 历史届次趋势 + 竞争对手对比 + MA 价值评估 + 战略建议
- D-16: **批量挖掘输入** — `brand_id`（竞品展会）+ 企查查搜索关键词
- D-17: **批量挖掘输出** — Excel/CSV 参展商名单 + 企查查扩充字段
- D-18: **单一挖掘输入** — 公司名称 / `brand_id` + 调查目的（客户/代理/协会/违规排查）
- D-19: **单一挖掘输出** — 全息客户画像 Markdown + 风险标注

### DB 扩展（LOCKED）
- D-20: 新增 `intel_report` 表 — 存储所有调研报告（类型、输入参数、报告内容、状态）
- D-21: 新增 `customer_prospect` 表 — 存储批量挖掘结果（参展商 + 企查查扩充信息）
- D-22: 复用现有 `person` + `exhibition_contact` 表 存储单一客户联系人信息

### Skill 系统设计（LOCKED）
- D-23: **4 个核心 Skill 文件** — industry-research, brand-research, batch-prospect, single-prospect
- D-24: **Skill 输入规范** — 每个 skill 接受 brand_id/industry 参数，优先从 DB 读取
- D-25: **结果追踪** — 每次 skill 执行后写入 `intel_report`（可追溯、可对比历史版本）

### Claude's Discretion
- 报告 Markdown 模板的具体格式
- 企查查 API 的具体调用封装方式（待 API Key 确认后实现）
- 行业竞争力评分的具体算法权重
- Skill 文件的内部提示词优化（后续迭代）

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 数据库 Schema
- `schema/init_db.sql` — 现有 6 表完整 DDL
- `mwlab.db` — 当前数据：5,856 brands, 6,129 editions, 8 个 L1 行业分类

### 现有代码模式
- `tag_api.py` — FastAPI + JWT 认证模式（参考 API 编写规范）
- `tools/export_for_tagging.py` — SQLite 查询 + pandas + openpyxl 导出模式
- `tools/import_tags.py` — 数据写回 + manual_tag_history 模式

### 项目约束
- `CLAUDE.md` — 项目行为规则（snake_case、禁止兼容代码等）
- `AGENTS.md` — 数据架构 + 技术约束（Jufair 大陆 IP 限制）

</canonical_refs>

<specifics>
## Specific Ideas

### 现有 DB 关系表（已可用）
- `exhibition_relation` — 品牌间关系（竞争/合作/母子/收购目标/参考标杆/同主办方）
- `person` + `exhibition_contact` — 联系人与展会的关联
- `contact_relation` — 人际关系网络

这些表已存在，品牌调研和单一客户挖掘模块应直接复用。

### 行业分布（已知）
- 机械和设备: 2,573 个品牌（最大行业）
- 生活方式: 1,259
- 休闲: 678
- 科技+: 519
- 化工与能源: 300
- 医疗和健康: 263
- 零售贸易和服务: 154
- 农业与畜牧: 110

### 企查查 API 说明
- 仅针对**国内参展企业**
- 模糊搜索为主（公司名 → 工商信息）
- API Key 由客户后续提供，代码需预留接口占位符

</specifics>

<deferred>
## Deferred Ideas

- 自动化调度（邮件触发 → 自动执行）— 显式要求人工操作，不做
- 前端展示界面 — Phase 4 暂缓，与本 Phase 无关
- 多语言报告（中英双语）— 先做中文版
- AI 评分模型（竞争力量化）— 先用规则，后期可升级
- Jufair/cnexpo 追加采集 — 这是 Phase 1b 的工作

</deferred>

---

*Phase: 05-intel-backend*  
*Context gathered: 2026-06-09 by BD client (杜塞展览)*
