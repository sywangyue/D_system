# PITFALLS.md · MWLAB-2026

| 风险信号 | 预防 | Phase |
|-----------|------|-------|
| 403/反爬暴增 | IP 与国内节点策略；退避；batch 告警 | 1 |
| 两源字段全空但仍 merge | merge 守卫 + provenance notes | 2 |
| JWT 泄密/弱密码 | HTTPS 终止、轮转、速率限制 | 3 |
| 单容器既跑爬又跑 API | 分拆或至少分进程/分镜像 | 3 |
| 「能跑 demo」但无镜像/契约 | Phase 3 DoD：Docker + openapi.json | 3 |
