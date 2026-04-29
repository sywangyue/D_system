# MWLAB-2026 · Exhibition Competitive Dashboard

## What This Is

面向中国总经理单机决策场景的展会竞争盘面看板：基于结构化展会品牌与届次数据，在用户选定品类（如机床）与关系/MDS 筛选项下，聚合展示竞争对手、潜在伙伴、新进入者三栏视图及关键汇总指标。数据来源以聚展网（jufair）、cnexpo 等爬虫与人工标注重合为主。

本项目仓库已具备爬虫、Schema、合并引擎与人工打标 API 等后端代码（brownfield）；**当前工程重点是按 PRD 将能力收敛为可上线形态**——含容器化交付、契约化 API（OpenAPI）与可执行的部署选型。

## Core Value

在「我们想进入某个展会市场」这一决策问题时，决策者能在三步点选内看到可信的竞争结构与规模信号（品牌/展商/观众/面积等），且无文字录入负担。

## Requirements

### Validated（代码层面已存在雏形，需在 Phase 收尾验收）

- ✓ `crawlers/jufair_crawler.py`、`crawlers/cnexpo_crawler.py` — 数据源采集脚本存在 — 需在目标环境验证字段与稳定性
- ✓ `schema/init_db.sql` / migrations — SQLite 结构与 PRD §3 对齐在推进中 — 以对齐 checklist 为准
- ✓ `merge_engine.py` — 双源合并逻辑已实现 — 需 93 条金标准验收
- ✓ `tag_api.py` — 人工打标 REST（FastAPI）— 需在合并后联调 mwlab.db
- ✓ `scheduler.py` — 调度占位 — 需接入 crawl_log / 告警策略

### Active

- [ ] Phase 1 验收：两类爬虫 + 调度在**大陆 IP** 节点稳定跑出可用样本（机床品类与时间窗），字段覆盖率达标
- [ ] Phase 2 验收：合并引擎在金标准数据集上字段零丢失；`data_provenance` / 冲突规则可审计
- [ ] Phase 3 验收：**仪表盘查询 API + JWT 用户体系**；93 条样本下响应时间需在 200ms 内（PRD）；**(1) 可构建并运行的 Docker 镜像 (2) 导出/提供 OpenAPI 规范 (3) 部署方案对比表（成本 / 维护难度 / 扩展性）**
- [ ] Phase 4：`[暂缓]` Claude Design — 大屏点选前端（≤3 控件），待 Phase 1–3 全部签核

### Out of Scope

- 上游产业链指数、下游 AI 建议、Gecko 集成、自由文字录入为主交互 — PRD §1
- Phase 4 之前的完整 UI 视觉定型 — §5

## Context

- **客户端**：BD 总监 / 总经理；内部至多约 30 账号。
- **数据约束**：聚展网依赖大陆访问；爬虫与批量任务落在「北京办公室 Mac Mini」等已验证节点；PRD 双源冲突规则须在合并层硬编码。
- **与本仓库**：`CLAUDE.md` / `AGENTS.md` 为爬虫字段与数据源说明；权威业务字段以 PRD §3 与手工 93 条金标准为准。

## Constraints

- **Tech**：PRD Phase 2 约束合并引擎侧依赖：`FastAPI`、`SQLAlchemy`、`pandas` — 不打乱前提下扩展 Phase 3
- **IP / 合规**：不向境外节点假造中国大陆可访问数据源
- **交互**：仪表盘层无文字输入、不超过 3 个点选控件（§5）
- **交付**：Phase 3 结束必须同时具备容器可运行制品、OpenAPI、部署多维对比 — 与客户验收 §8 一致

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 采用 PRD Phase 对齐（Hermes → Claude Code → Cursor → Design） | 客户已定义的验收节奏与责任边界 | — Pending Phase 签名 |
| Cursor 定位为工程整合者 | 补全 Claude Code 少覆盖的运维与交付物 | — Pending |
| SQLite 开发与云端存储策略推迟到部署阶段决断 | §6 PRD | — Pending |
| 本初始化未使用 `gsd-sdk`（环境未安装）；`.planning` 为手工对齐 GSD 产物 | 可后续安装 CLI 补上 `generate-claude-md` 等自动化 | ⚠️ Revisit |

## Evolution

本文件随 Phase / 里程碑演进：需求在验证后挪动「Validated」，作废则移入 Out of Scope 并注明原因；Key Decisions 随架构与部署选型更新。

---
*Last updated: 2026-04-29 after `/gsd-new-project` initialization（PRD v1 + 工程整合者角色）*
