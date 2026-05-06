# MWLAB-2026 · Exhibition Competitive Dashboard

## What This Is

面向中国总经理单机决策场景的展会竞争盘面看板：基于结构化展会品牌与届次数据，在用户选定品类（如机床）与关系/MDS 筛选项下，聚合展示竞争对手、潜在伙伴、新进入者三栏视图及关键汇总指标。数据来源以聚展网（jufair）、cnexpo 等爬虫与人工标注重合为主。

本项目已具备爬虫、Schema、合并引擎、打标 API 与 **Excel 批量打标工具（Phase 3b ✅）**；**当前工程重点**为：
1. **全集采集** — jufair 从 3.4K 扩充至 8.4K，cnexpo 全量探测
2. **前端 UI** — Phase 4（暂缓）

## Core Value

在「我们想进入某个展会市场」这一决策问题时，决策者能在三步点选内看到可信的竞争结构与规模信号（品牌/展商/观众/面积等），且无文字录入负担。

## Completed（Phase 1–3 + Phase 3b 已交付）

| 产出物 | Phase | 说明 |
|--------|-------|------|
| jufair_crawler.py | Phase 1 | 聚展网爬虫，已验证 3.4K 条 |
| cnexpo_crawler.py | Phase 1 | cnexpo 爬虫 |
| scheduler.py | Phase 1 | 定时任务调度器 |
| schema/init_db.sql | Phase 2 | 6 张表完整 Schema |
| merge_engine.py | Phase 2 | 双源合并引擎（含冲突规则） |
| tag_api.py | Phase 2 | 人工打标 API（FastAPI） |
| tools/export_for_tagging.py · import_tags.py | Phase 3b | Excel 批量打标；依赖 `openpyxl`；见 `tests/test_tagging_tools.py` |
| 查询 API（FastAPI） | Phase 3 | Dashboard 数据接口 |
| JWT 用户认证 | Phase 3 | 3 角色，30 人上限 |
| Docker 镜像 | Phase 3 | 容器化部署 |

## Active

- [ ] **Phase 1b**：Jufair 全集补采（国内 122 页 + 国际 300 页，+5K 条）+ cnexpo 全量探测采集
- [ ] **Phase 1b**：全集合并引擎全量跑通
- [ ] **Phase 4**：前端 UI（暂缓；打标工具已就绪）

## Out of Scope

- 上游产业链指数、下游 AI 建议、Gecko 集成、自由文字录入为主交互 — PRD §1
- Phase 4 之前的完整 UI 视觉定型 — §5

## Context

- **客户端**：BD 总监 / 总经理；内部至多约 30 账号。
- **数据约束**：聚展网依赖大陆访问；爬虫与批量任务落在「北京办公室 Mac Mini」等已验证节点。
- **权威参考**：整合 PRD（MWLAB-2026-PRD-v1.1-merged.md）为当前唯一来源；手工 93 条金标准为字段定义基准。

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PRD v1.1 整合版取代 v1.0 + v1.1 两份文档 | 消除不一致，统一引用源 | ✅ 已生成 |
| Phase 1b 追加全集采集 | 原 Phase 1 仅 40% 覆盖率 | ✅ 已规划 |
| Phase 3b 追加打标工具 | 已有 API 但无批量导入界面 | ✅ 已交付（`tools/` + 单测） |
| SQLite 开发与云端存储策略推迟到部署阶段决断 | §6 PRD | Pending |

---

*Last updated: 2026-05-06 · Phase 3b 标为完成*
