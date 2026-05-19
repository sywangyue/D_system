# STACK.md · MWLAB-2026

| 层级 | 选择 | 置信度 | 说明 |
|------|------|--------|------|
| 运行时 | Python 3.12+（与仓库一致即可） | 高 | FastAPI/SQLAlchemy/pandas PRD Phase 2 |
| API | FastAPI, Uvicorn | 高 | 已有 `tag_api.py` 模式延伸 |
| 鉴权 | JWT（python-jose 或等价） | 中 | Phase 3 实现用户表 + 登录 |
| DB | SQLite → 可选云上 SQL | 中 | PRD §6 |
| HTTP 客户端爬虫 | requests, bs4 | 高 | 已验证 |

**慎选**：暂不引入重量级消息队列——30 用户 + 爬虫外置可满足；若爬虫频率升高再评估 Celery/APScheduler 独立 Worker。
