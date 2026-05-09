# Research SUMMARY · MWLAB-2026

**合成说明**：当前环境未安装 `gsd-sdk`，未并行跑四研究者 Agent；本节由 PRD + 仓库现状压缩而成，供路线与 REQUIREMENTS 使用。

## Stack（结论）

- **API**：FastAPI + Uvicorn；鉴权 JWT（Phase 3）；Pydantic 模型对齐 OpenAPI 自动生成。
- **数据**：SQLite（`mwlab.db` / 演进中）；生产可迁托管 PG/MySQL — 取决于 Phase 3 部署对比结论。
- **采集**：requests + BeautifulSoup（见 `AGENTS.md`）；爬虫与调度与 API 进程分离（爬虫节点大陆 IP）。
- **容器**：多阶段 Dockerfile（Python slim），单镜像含 API；卷挂载 DB 或启动时挂载持久化路径。

## Table Stakes（表里）

- 登录与会话（邮箱/密码/JWT）；角色简化三档。
- Dashboard 聚合端点：`GET /api/dashboard?...` — 筛选 + 三张清单 + 四卡片统计。
- 健康检查、日志、基本错误 JSON。

## Differentiators（PRD）

- 双源合并 + provenance / 冲突可解释。
- 「无键盘」点选漏斗 + MDS / 竞争关系标签体系。

## Anti-patterns / Pitfalls（摘要）

- 在港澳台/境外跑 jufair 批量爬虫（403）。
- 把爬虫与读写 API 同进程强耦合 — 扩容与排障困难。
- 无 OpenAPI/无镜像 — 「代码好但上不了线」—— Phase 3 显式收口。
