# Phase 4: UI/UX 全面重新架构 - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning (replan — 替代 2026-05-06 版 CONTEXT.md)

<domain>
## Phase Boundary

本 Phase 交付完整的 UI/UX 重新架构：基于 Messe Düsseldorf Corporate Design Manual 品牌规范，实现 4 层 Dashboard + 简化地图 + 科技感 UI，所有界面与现有 mwlab.db 数据关联验证。

Phase 1b（全集采集）和 Phase 3b（打标工具）与本 Phase 并行推进，不构成前端启动的前置阻塞。

</domain>

<decisions>
## Implementation Decisions

### MD 品牌规范集成（NEW — 2026-05-07 replan）

- **D-01:** 品牌色彩体系 → 严格遵循 Messe Düsseldorf Corporate Design Manual（`3_Messe Düsseldorf_Corporate Design Manual.pdf`）中的官方色板，包括主色（MD Blue）、辅色、强调色，建立 CSS 变量体系（`--md-blue`, `--md-*`）
- **D-02:** 品牌字体 → 遵循 CD Manual 字体规范（DIN / Arial 体系），建立 Tailwind fontFamily token
- **D-03:** Logo 与品牌标识 → 登录页 + Dashboard 全局导航栏使用 MD 官方 Logo，遵循 CD Manual 中 Logo 安全距离和最小尺寸规范
- **D-04:** 布局网格 → 遵循 CD Manual 定义的网格系统和间距规范

### Dashboard 分层架构（NEW）

- **D-05:** Dashboard 至少 4 层，每层 4-6 个标签栏 →
  - **Layer 1（概览层）**：KPI 总览卡片（展览面积 / 展商数量 / 观众数量 / 展览集团 / 年比趋势）
  - **Layer 2（分析层）**：行业分布（industry_l1/l2 饼图/柱状图）、竞争关系分布（竞争对手/潜在伙伴/新进入者）
  - **Layer 3（地理层）**：城市/场馆分布热力、国内外展会对比
  - **Layer 4（明细层）**：品牌/展会列表 + 排序/搜索/过滤
  - 每层内部有 4-6 个可切换的 Tab/标签栏，用于切换不同的数据视角
- **D-06:** 导航结构 → 左侧边栏或顶部导航栏（以 MD 品牌规范为准），支持 4 层 Dashboard 快速跳转

### 地图模块（CHANGED）

- **D-07:** 地图方案 → **不再使用**过度精确的全球地图 + 标记线方案。改用 **Leaflet + OpenStreetMap 瓦片**（类似 openstreetmap.org 结构），仅做城市级聚合标注，不做热力密度 / 路径线
- **D-08:** 地图功能范围 → 按 `city` 聚合展会数量，显示城市标记点，点击显示展会列表。不做路径动画 / 飞线 / 复杂热力图层

### UI/UX 样式方向（NEW）

- **D-09:** 整体风格 → **科技感 + 非技术人员友好**：深色主题可选、高对比度数据卡片、大号数字、清晰的层级导航。参考：现代数据大屏（但不做 3D / WebGL 过度效果）
- **D-10:** 点选交互 → 过滤/筛选控件使用 Pill/Tag 风格（圆角胶囊），选中态使用 MD 品牌主色，hover 有微动效。三步点选内到达目标数据（符合 PRD 核心目标）
- **D-11:** 响应式 → 桌面端大屏优先（1920×1080 基准），移动端做基本可读适配（不作为本 Phase 重点）

### 数据接入验证（NEW）

- **D-12:** 所有 UI 组件必须连接真实 mwlab.db 数据进行验证，不能使用 mock 数据
- **D-13:** 验证清单：KPI 卡片数字准确、过滤联动正确、地图聚合数量与实际一致

### 技术栈（保留）

- **D-14:** 前端框架 → Next.js（React 生态，SSR/SSG 均可）
- **D-15:** 数据库 → SQLite（mwlab.db 直连，开发阶段）/ 可选 Supabase PostgreSQL
- **D-16:** 认证 → 保留现有 JWT 3 角色体系（admin / manager / readonly）
- **D-17:** 后端 API → 保留现有 FastAPI Dashboard API（Phase 3 已交付），前端通过 REST API 调用

### 自治执行方案

- **D-18:** 执行方式 → Ralph 自治循环（用户离开 6 小时），GSD 规划 + Superpowers 执行 + gstack UI/UX 审核
- **D-19:** 时间预算 → 2-8 小时，覆盖规划→执行→审核→修复全流程

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 品牌规范

- `3_Messe Düsseldorf_Corporate Design Manual.pdf` — MD 官方品牌手册（颜色、字体、Logo、网格）

### PRD & 需求

- `MWLAB-2026-PRD-v1.1-merged.md` §5 — 前端约束（3 个点选控件定义，严格遵守）
- `MWLAB-2026-PRD-v1.1-merged.md` §3 — 数据架构（6 张表字段定义）
- `MWLAB-2026-PRD-v1.1-merged.md` §7 Phase 4 — UI/UX 范围定义

### 数据架构

- `schema/init_db.sql` — 当前 SQLite Schema（6 张表）
- `AGENTS.md` — 数据字段定义权威来源、文件索引

### 现有实现

- `tag_api.py` — 打标 API
- `merge_engine.py` — 合并引擎
- Phase 3 Dashboard API — 现有查询端点

### 状态

- `.planning/STATE.md` — 当前 Phase 状态
- `.planning/ROADMAP.md` — Phase 定义和顺序

</canonical_refs>

<specifics>
## Specific Ideas

- **MD 品牌色板**：从 CD Manual PDF 提取官方色值（MD Blue 主色 + 辅色系统），建立 design token
- **4 层 Dashboard 导航**：考虑 Tab Bar 或 Sidebar 内部嵌套方案，确保每层切换 < 1 秒
- **地图简化**：Leaflet + OSM 瓦片，仅做城市级 Marker 聚合（MarkerCluster 插件），不引入 D3/Deck.gl 等重型库
- **深色/浅色主题**：优先交付浅色主题（符合 MD 品牌规范），深色作为可选增强
- **科技感元素**：微妙的玻璃态卡片、微动效过渡、数据加载骨架屏

</specifics>

<deferred>
## Deferred Ideas

- **打标前端界面** → Phase 5 或 Phase 3b 扩展
- **AI 推荐功能** → 永久排除
- **移动端深度适配** → 当前仅做基本可读
- **3D 地球 / WebGL 大屏效果** → 过度，不做

</deferred>

---

*Phase: 04-frontend-architecture*
*Context gathered: 2026-05-07 · replan (替代 2026-05-06 版)*
