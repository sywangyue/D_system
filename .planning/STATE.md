# MWLAB-2026 — Project State

**Last Updated:** 2026-06-10  
**Current Phase:** Phase 5 (Complete)  
**Status:** All 7 plans executed

## Phase Status

| Phase | Name | Status | Plans | Notes |
|-------|------|--------|-------|-------|
| 1 | 数据采集器 | ✅ Complete | — | |
| 1b | 全集采集 | ⏳ In Progress | — | Jufair 8.4K 目标 |
| 2 | Schema + 合并引擎 | ✅ Complete | — | |
| 3 | Dashboard 查询 API | ✅ Complete | — | |
| 3b | 打标批量工具 | ✅ Complete | — | |
| 4 | 前端 UI | ⏸ Paused | — | 待定 |
| **5** | **情报后端** | **✅ Complete** | 7 | 4 Skills + 5 工具脚本 + DB迁移 |

## Key Decisions

- 数据库：SQLite (mwlab.db)，5,856 brands，6,129 editions
- 分类系统：8 大类 L1 + 多个 L2，100% 覆盖
- API 框架：Next.js API Routes + JWT (middleware.ts 验签)
- 部署：阿里云（北京节点，IP 限制）
- 后端语言：Python 3.12+

## Constraints

- Jufair 爬虫必须在大陆 IP 执行
- 企查查 API 待接入（密钥 TBD）
- 全部调研操作人工触发，不做自动化调度
- 禁止 LLM 虚构展会数据
