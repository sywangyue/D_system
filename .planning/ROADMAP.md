# ROADMAP · MWLAB-2026

**Granularity:** Standard（与 PRD Phase 1–4 对齐）  
**Mode:** YOLO（config）— 仍按客户 **Phase 间人工验收** 闸口执行

## Phases

### Phase 1 · 数据采集器（Hermes）

**Goal:** 两源爬虫工程化 + 调度 + `crawl_log`，稳定输出可合并的 raw 表。

| Maps to | Success criteria（可观察） |
|---------|---------------------------|
| DATA-01, DATA-02, DATA-03 | 机床品类 + 约定时间窗下抓取 **≥100** 条量级样本可供合并；字段覆盖率 PRD §8；调度产生批次 ID；失败后三次重试并有日志 |

### Phase 2 · 清洗、合并与打标 API（Claude Code）

**Goal:** 全量 Schema、migrations、`merge_engine`、`tag_api` 与测试及 93 条金标准对拍。

| Maps to | Success criteria |
|---------|------------------|
| DMG-01, DMG-02, TAG-01 | Merge 跑一次金标准：**零字段丢失**；provenance 可审计；pytest 覆盖率报告存档；REST 打标可走通 |

### Phase 3 · API、认证与工程交付（Cursor · **工程整合者**)

**Goal:** Dashboard + JWT；**镜像 + OpenAPI + 部署对比表**三件套——可上线底座。

| Maps to | Success criteria |
|---------|------------------|
| DSH-01, AUT-01 | Postman/`curl` 可完整演示登录与 dashboard；93 条数据下接口 **p95 在 200ms 以内**（单机合理配置） |
| **OPS-01** | `docker build` 成功后 `docker run` 可拉起 API |
| **OPS-02** | 提交或生成 **OpenAPI 3.x** JSON（与运行实例一致） |
| **OPS-03** | 文档化对比表：**云 VPS + Caddy** vs **Cloudflare Pages + Workers**（或其它 PRD备选），三维度打分/说明 |

**UI hint:** no（本 Phase 以 API/运维为主）

### Phase 4 · UI/UX（Claude Design）— ON HOLD

**Goal:** ≤3 点选控件大屏；依赖 Phase 1–3 **全部**签收。

---

## Requirement coverage check

| Phase | Requirement IDs |
|-------|-----------------|
| 1 | DATA-01 — DATA-03 |
| 2 | DMG-01, DMG-02, TAG-01 |
| 3 | DSH-01, AUT-01, OPS-01 — OPS-03 |

**100% v1 REQ 已映射**

---
*Roadmap created: 2026-04-29*
