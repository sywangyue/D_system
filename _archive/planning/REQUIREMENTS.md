# Requirements: MWLAB-2026 (Exhibition Competitive Dashboard)

**Defined:** 2026-04-29  
**Last updated:** 2026-05-06（Phase 3b 需求收尾）  
**Core Value:** 「三步点选内给出可信的竞争盘面」— 见 `.planning/PROJECT.md`

## v1 Requirements（✅ 全部已完成）

### Data acquisition — DATA

- [x] **DATA-01**: Hermes / Phase 1 交付物可按「品类关键词 + 时间窗口」抓取 jufair 列表/详情并入 `raw_jufair`，在大陆 IP 环境可回归运行  ✅
- [x] **DATA-02**: cnexpo 爬虫与 jufair 结构对齐并写入 `raw_cnexpo`  ✅
- [x] **DATA-03**: `scheduler.py` 实现周一增量、月初全量调度，写入 `crawl_log`，失败重试三次后产生可消费的告警钩子  ✅

### Data merge & lineage — DMG

- [x] **DMG-01**: `merge_engine.py` 应用 PRD §3.2 字段优先级并将结果写入规范化品牌/届次与 `data_provenance`  ✅
- [x] **DMG-02**: 金标准 93 条手工样本跑一次合并：零字段丢失  ✅

### Annotation API — TAG

- [x] **TAG-01**: 人工打标端点：`brand_id + 字段 + 新值` 写入主表与 `manual_tag_history` — `tag_api.py` 已实现并测试  ✅

### Dashboard & auth — DSH · AUT

- [x] **DSH-01**: `GET /api/dashboard`（请求参数：`industry_l2`、`relation`、`mds`）返回三栏聚合 + 四卡片汇总统计  ✅
- [x] **AUT-01**: 邮箱 + 密码登录签发 JWT；角色 `admin` / `manager` / `readonly`；注册用户上限 30  ✅

### Packaging & operations — OPS（Phase 3 强制）

- [x] **OPS-01**: 仓库内 Dockerfile 可 `docker build` 产出可直接运行 API 服务的镜像  ✅
- [x] **OPS-02**: FastAPI OpenAPI：验收时提供 `./openapi.json` 或与 `/openapi.json` 导出一致  ✅
- [x] **OPS-03**: 部署方案对比表：云 VPS+Caddy vs Cloudflare Workers+Pages，三维度评估  ✅

## v2 Requirements（新增）

| ID | 说明 | 状态 |
|----|------|------|
| FULL-CRAWL | Jufair 全集补采（国内 122 页 + 国际 300 页，+5K 条） | ⏳ Pending |
| CNEXPO-FULL | cnexpo 全量探测 + 采集 | ⏳ Pending |
| MERGE-FULL | 全集数据合并引擎全量跑通 | ⏳ Pending |
| EXPORT-TOOL | tools/export_for_tagging.py — Excel 批量导出工具 | ✅ Done |
| IMPORT-TOOL | tools/import_tags.py — Excel 批量导入工具 | ✅ Done |
| UI-POOL | Claude Design Phase 4 正式 UI — PRD §4 暂缓 | ⏸ On Hold |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| DATA-01 — DATA-03 | Phase 1 · 数据采集器 | ✅ Done |
| DMG-01 — DMG-02 | Phase 2 · 清洗与合并 | ✅ Done |
| TAG-01 | Phase 2（打标 API） | ✅ Done |
| DSH-01, AUT-01 | Phase 3 · API 与认证 | ✅ Done |
| OPS-01 — OPS-03 | Phase 3 · 工程整合交付 | ✅ Done |
| FULL-CRAWL, CNEXPO-FULL, MERGE-FULL | Phase 1b · 全集采集 | ⏳ Pending |
| EXPORT-TOOL, IMPORT-TOOL | Phase 3b · 打标工具 | ✅ Done |
| UI-POOL | Phase 4 · 前端 UI | ⏸ On Hold |

**Coverage:** v1 共 12 项 ✅ 全部完成；v2 共 6 项（3 项 Phase 1b 待执行 + 2 项 Phase 3b ✅ + 1 项 Phase 4 On Hold）

---

*Requirements updated: 2026-05-06 · Phase 3b（EXPORT-TOOL / IMPORT-TOOL）已完成*
