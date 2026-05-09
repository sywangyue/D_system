# ARCHITECTURE.md · MWLAB-2026

```
[大陆节点] Crawlers / Scheduler ──► raw_* / crawl_log
                                         │
[应用区]    merge_engine ◄────────────────┘
                 │
                 ▼
         exhibition_* + data_provenance
                 │
                 ▼
         FastAPI（tag_api + dashboard + auth）
                 │
      [HTTPS]  ──┴──  未来静态前端 SPA（Phase 4）
```

**构建顺序**：保证 Schema ↔ 爬虫 ↔ 合并 ↔ 标注 API ↔ 查询 API ↔ 运维封装；爬虫与 OLTP API **进程分离**以降低互相拖死风险。
