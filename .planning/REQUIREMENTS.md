# Requirements: MWLAB-2026 (Exhibition Competitive Dashboard)

**Defined:** 2026-04-29  
**Core Value:** 「三步点选内给出可信的竞争盘面」— 见 `.planning/PROJECT.md`

## v1 Requirements

### Data acquisition — DATA

- [ ] **DATA-01**: Hermes / Phase 1 交付物可按「品类关键词 + 时间窗口」抓取 jufair 列表/详情并入 `raw_jufair`（或等价表），在大陆 IP 环境可回归运行  
- [ ] **DATA-02**: cnexpo 爬虫与 jufair 结构对齐并写入 `raw_cnexpo`  
- [ ] **DATA-03**: `scheduler.py` 实现周一增量、月初全量调度，写入 `crawl_log`，失败重试三次后产生可消费的告警钩子  

### Data merge & lineage — DMG

- [ ] **DMG-01**: `merge_engine.py`（或接替实现）应用 PRD §3.2 字段优先级并将结果写入规范化品牌/届次与 `data_provenance`  
- [ ] **DMG-02**: 金标准 **93** 条手工样本跑一次合并：**零字段丢失**（BD 签收）  

### Annotation API — TAG

- [ ] **TAG-01**: 人工打标端点：`brand_id + 字段 + 新值` 写入主表与 `manual_tag_history` — 已存在 `tag_api.py`；需对齐最终 Schema 并完成测试覆盖报告（PRD Phase 2）  

### Dashboard & auth — DSH · AUT

- [ ] **DSH-01**: `GET /api/dashboard`（请求参数：`industry_l2`、`relation`、`mds` — 与 PRD 一致）返回三栏聚合 + **四卡片**汇总统计  
- [ ] **AUT-01**: 邮箱 + 密码登录签发 JWT；角色 `admin` / `manager` / `readonly`；注册用户上限 **30**  

### Packaging & operations — OPS（Phase 3 强制）

- [ ] **OPS-01**: 仓库内 Dockerfile（或多阶段）可被 `docker build` 产出**可直接运行 API 服务**的镜像（SQLite 挂载或镜像内初始化策略文档化）  
- [ ] **OPS-02**: FastAPI **OpenAPI**：验收时提供 `./openapi.json` 或与 `/openapi.json` 导出一致的路径说明  
- [ ] **OPS-03**: **部署方案对比表**：至少对比 **云服务器+Caddy（或等价反向代理）** 与 **Cloudflare Workers + Pages（或等价边缘方案）**，三维度：**成本 / 维护难度 / 扩展性**，供 Phase 结尾二选一  

## v2 Requirements

| ID | 说明 |
|----|------|
| UI-POOL | Claude Design Phase 4 正式 UI — PRD §4 暂缓 |
| AUTH-EMAIL | 邮件验证、找回密码 — 若 v1 仅内网账号可推迟 |

## Out of Scope

| Feature | Reason |
|---------|--------|
| 产业链指数、AI 建议、Gecko、文字为主交互 | PRD §1 |
| 复杂 RBAC、无限账户 | PRD §6 |
| 在境外节点模拟大陆数据源 | 合规与数据真实性 |

## Traceability

| Requirement | Phase | Status |
|---------------|-------|--------|
| DATA-01 — DATA-03 | Phase 1 · 数据采集器 | Pending |
| DMG-01 — DMG-02 | Phase 2 · 清洗与合并 | Pending |
| TAG-01 | Phase 2（收尾联调 may roll to 3） | Pending |
| DSH-01, AUT-01 | Phase 3 · API 与认证 | Pending |
| OPS-01 — OPS-03 | Phase 3 · 工程整合交付 | Pending |

**Coverage:** v1 共 12 项；全部映射至 PRD Phase 1–3。

---
*Requirements defined: 2026-04-29*
