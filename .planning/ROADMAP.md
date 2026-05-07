# ROADMAP · MWLAB-2026

**Granularity:** Standard（与 PRD Phase 1–4 对齐）  
**Mode:** YOLO（config）— 仍按客户 Phase 间人工验收闸口执行

## ✅ 已完成的 Phases

### Phase 1 · 数据采集器（Hermes）

**Goal:** 两源爬虫工程化 + 调度 + `crawl_log`，稳定输出可合并的 raw 表。

| Maps to | Result |
|---------|--------|
| DATA-01, DATA-02, DATA-03 | ✅ 爬虫已验证可跑，3.4K 条数据入库，调度器实现 |

### Phase 2 · 清洗、合并与打标 API（Claude Code）

**Goal:** 全量 Schema、migrations、`merge_engine`、`tag_api` 与测试及 93 条金标准对拍。

| Maps to | Result |
|---------|--------|
| DMG-01, DMG-02, TAG-01 | ✅ merge_engine 跑通金标准（零字段丢失）；打标 API 可用；pytest 覆盖 |

### Phase 3 · API、认证与工程交付（Cursor · 工程整合者）

**Goal:** Dashboard + JWT；镜像 + OpenAPI + 部署对比表三件套。

| Maps to | Result |
|---------|--------|
| DSH-01, AUT-01, OPS-01, OPS-02, OPS-03 | ✅ Dashboard API + JWT 认证 + Docker 镜像 + OpenAPI + 部署对比表 |

### Phase 3b · 打标工具（新增 — 基于 Adjustment v1.1）

**Goal:** Excel 批量导出/导入，补全打标工作流。

| Maps to | Result |
|---------|--------|
| EXPORT-TOOL | ✅ `tools/export_for_tagging.py` — 按 `industry_l2` 导出，含下拉验证 |
| IMPORT-TOOL | ✅ `tools/import_tags.py` — 读取 Excel → `exhibition_brand` + `manual_tag_history` |

**Agent assignment:** Cursor — 已完成（`tests/test_tagging_tools.py`）

---

## 📋 待执行的 Phases

### Phase 1b · 全集采集（新增 — 基于 Adjustment v1.1）

**Goal:** Jufair 从 3.4K 扩至 8.4K（国内 122 页 + 国际 300 页）+ cnexpo 全量探测采集 + 全量合并。

| Maps to | Success criteria |
|---------|------------------|
| FULL-CRAWL | Jufair 全量补采完成，新增约 5K 条，总量约 8.4K |
| CNEXPO-FULL | cnexpo 全量探测 + 采集完成，字段覆盖率矩阵报告 |
| MERGE-FULL | 全集合并跑通，双源冲突条目数量报告 |

**Agent assignment:** Hermes（3 个串行子任务）

### Phase 4 · 前端架构全面迁移（Next.js + Supabase + Cloudflare）

**Goal:** Next.js 15 + Supabase PostgreSQL 全栈项目；实现 Login/Dashboard/Calendar/Map/Setting 五个模块；部署至 Cloudflare Workers。

**Agent assignments:** CC（架构层)+ Cursor（UI 组件）+ Claude Design（UI 规范已完成）

**Plans:** 7 plans in 4 waves

| Wave | Plan | Agent | Objective |
|------|------|-------|-----------|
| 1 | 04-01 | CC | Next.js 项目初始化 + 全部依赖 + 测试框架 |
| 2 | 04-02 | CC | DB Schema 迁移 + Supabase Auth + 路由守卫 middleware |
| 2 | 04-03 | Cursor | 根布局 layout + Sidebar + KPI 卡片 + FilterTabs + PieChart 共享组件 |
| 3 | 04-04 | CC | API Routes（Dashboard/Brands/Tags/Users）+ seed-users + 部署配置 |
| 3 | 04-05 | Cursor | 登录页 + Dashboard 主页（FilterTabs + KPI 卡片 + PieChart） |
| 3 | 04-06 | Cursor | Calendar 日历 + Map 地图 + Setting 系统设置 |
| 4 | 04-07 | CC | SQLite→Supabase 数据迁移 + 全量测试 + Cloudflare 部署验证 |

---

## Requirement coverage check

| Phase | Requirement IDs | Status |
|-------|-----------------|--------|
| 1 | DATA-01 — DATA-03 | ✅ Done |
| 2 | DMG-01, DMG-02, TAG-01 | ✅ Done |
| 3 | DSH-01, AUT-01, OPS-01 — OPS-03 | ✅ Done |
| 1b | FULL-CRAWL, CNEXPO-FULL, MERGE-FULL | ⏳ Pending |
| 3b | EXPORT-TOOL, IMPORT-TOOL | ✅ Done |
| 4 | UI-POOL | ✅ 7 plans created |
| 5 | CLEAN-BRAND | ✅ 2 plans created |

---

## 📋 待执行的 Phases

### Phase 5 · 数据清洗 — 品牌表深化

**Goal:** exhibition_brand 表数据规范化：英文名称标准化（缺失按中文翻译补充）、一级行业标签对齐 MD 六大类别、MD 自有品牌标记与缺失展会补充、聚展二级行业分类爬取与模糊匹配标注。

| Maps to | Success criteria |
|---------|------------------|
| CLEAN-NAME-EN | 英文名称：1,946 条缺失 + 中文名全部翻译为 "英文缩写 EXPO" 格式 |
| CLEAN-INDUSTRY | 一级行业标签对齐 6 个 MD 类别（机械和设备/休闲/生活方式/科技+/医疗和健康/零售贸易和服务） |
| CLEAN-MDS | MD 自有品牌标记：Excel 中展会匹配并标 mds_related=1，缺失展会补充入库 |
| CLEAN-JUFAIR-L2 | 爬取 jufair.com 二级分类 → 模糊匹配 exhibition_brand → 标注 industry_l1 + industry_l2 |

**Agent assignment:** Claude Code

**Plans:** 2 plans in 2 waves

| Wave | Plan | Autonomous | Objective |
|------|------|------------|-----------|
| 1 | 05-01 | yes | 脚本框架 + name-en + industry 子命令 + 测试 |
| 2 | 05-02 | no (checkpoint) | mds + jufair-l2 子命令 + 爬虫模块 + 测试 |

---

*Roadmap updated: 2026-05-07 · Phase 5 规划完成（2 plans in 2 waves）*
