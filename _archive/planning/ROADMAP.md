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

### Phase 4 · 前端架构全面迁移（FastAPI JWT + MD Brand + 4-Layer Dashboard + SQLite BFF）

**Goal:** 实现 MD Corporate Design 品牌规范的 4 层 Dashboard + 简化 Leaflet 地图 + 日历 + 设置；FastAPI JWT 认证（替代 Supabase）；SQLite BFF 直连（替代 PostgreSQL）；科技感 UI + 真实 mwlab.db 数据验证。

**Agent assignments:** CC（全栈架构 + API 重写 + 验证）

**Plans:** 7 plans in 4 waves

| Wave | Plan | Objective |
|------|------|-----------|
| 0 | 04-01 | 基础设施：auth_api.py (FastAPI JWT) + lib/db.ts (better-sqlite3) + lib/auth.ts + Python 依赖 |
| 0 | 04-04 | MD 品牌重塑：globals.css (橙色系) + KpiCard/FilterTabs/TrendBadge/PieChart 颜色替换 |
| 1 | 04-02 | 认证 + 布局重写：middleware (JWT) + page.tsx + Sidebar + AppShell + types 清理 |
| 1 | 04-03 | API 路由重写：dashboard/map/calendar/brands/users/status 全部 Supabase → better-sqlite3 |
| 2 | 04-05 | 4 层 Dashboard：LayerTabs + SubTabs + KpiCardRow + TrendChart + BrandTable + 页面重构 |
| 2 | 04-06 | 页面整合：登录页 (JWT 流程) + 日历/地图/设置 (MD 品牌色) |
| 3 | 04-07 | 数据验证：KPI 准确性 + 过滤联动 + 地图聚合 + 绿色/Supabase 残留清理 |

---

## Requirement coverage check

| Phase | Requirement IDs | Status |
|-------|-----------------|--------|
| 1 | DATA-01 — DATA-03 | ✅ Done |
| 2 | DMG-01, DMG-02, TAG-01 | ✅ Done |
| 3 | DSH-01, AUT-01, OPS-01 — OPS-03 | ✅ Done |
| 1b | FULL-CRAWL, CNEXPO-FULL, MERGE-FULL | ⏳ Pending |
| 3b | EXPORT-TOOL, IMPORT-TOOL | ✅ Done |
| 4 | UI-POOL | ✅ 7 plans replaced (2026-05-07 replan) |
| 5 | CLEAN-BRAND | ✅ 2 plans created |
| 6 | UI-SLICER, UI-DASHBOARD, UI-MAP, UI-SAAS | ✅ 4 plans created |

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

### Phase 6 · Dashboard UX 重塑（Excel Slicer + PowerBI 盘面 + SaaS 质感）

**Goal:** 简化当前过度复杂的 Dashboard 交互，重塑为 Excel 切片器风格 + PowerBI 基础盘面 + MD 品牌 SaaS 设计质感。核心原则：数据点选同步、二级行业列表不遮挡、地图为独立图层、设计质感对标生态型 SaaS。

| Maps to | Success criteria |
|---------|------------------|
| UI-SLICER | 行业筛选改为 Excel 切片器风格（L1 行 + L2 展开面板），点选即时同步全盘面 |
| UI-DASHBOARD | PowerBI 风格四卡片 + 趋势图 + 饼图，布局响应式不堆叠 |
| UI-MAP | Leaflet 地图保留且独立为地理图层，标记 MD 橙色 |
| UI-SAAS | 全局 SaaS 质感：微妙阴影、圆角层级、hover 过渡、空状态插画感 |

**Agent assignment:** Claude Code

**Plans:** 4 plans in 2 waves

| Wave | Plan | Autonomous | Objective |
|------|------|------------|-----------|
| 1 | 06-01 | yes | Design Tokens (shadow/radius CSS) + SlicerBar 组件 |
| 1 | 06-02 | yes | KpiCard 图标 + IndustryPieChart Donut 中心总数 |
| 1 | 06-03 | yes | EmptyState 组件 + TrendChart 质感更新 |
| 2 | 06-04 | yes | Dashboard 布局重写 + LayerTabs/SubTabs 移除 + 全局 EmptyState 应用 |

---

*Roadmap updated: 2026-05-09 · Phase 6 plans created (4 plans in 2 waves)*
