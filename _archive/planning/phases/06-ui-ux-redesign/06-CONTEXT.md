# Phase 06: Dashboard UX 重塑 — Context

**Gathered:** 2026-05-08
**Status:** Ready for planning
**Source:** User design feedback (direct input)

<domain>
## Phase Boundary

本 Phase 的目标是简化当前过度复杂的 Dashboard 交互，重塑为：
- **Excel 切片器风格**的行业筛选（L1 行 + L2 可展开面板，不遮挡任何其他控件）
- **PowerBI 基础盘面**：KPI 卡片 + 趋势图 + 行业分布饼图，布局清晰不堆叠
- **MD 品牌 SaaS 设计质感**：微妙阴影、圆角层级、hover 过渡、空状态有插画感
- **Leaflet 地图**：保留为独立地理图层，标记使用 MD 橙色系

**不在本 Phase 范围内：**
- 数据源更新/采集（用户明确：半年一更新，非高优）
- 新的数据分析功能
- 后端 API 改动（现有 API 已满足需求）
</domain>

<decisions>
## Implementation Decisions

### 布局架构
- 4 层 Dashboard 简化为单页滚动 + Tab 切换，或保留 Layer 概念但减少嵌套
- 筛选器区域固定在顶部，不随内容滚动而消失（sticky filter bar）
- 图表卡片使用 CSS Grid 响应式布局，lg 断点以上并排，以下堆叠

### 行业筛选（Excel Slicer 风格）
- L1 行业横向排列为切片器按钮组（类似 Excel Slicer 的视觉风格）
- 选中某个 L1 后，L2 在下方展开为多选标签面板
- 点选 L2 即时过滤全部盘面数据（KPI + 趋势图 + 饼图 + 地图标记）
- 非当前 L1 下的 L2 选项折叠隐藏，不遮挡页面
- 已实现的二级列表（IndustryPieChart 内的 l2ByL1 折叠面板）保留并优化

### KPI 卡片
- 4 卡片横排：总面积 / 总展商 / 总观众 / 主办方数
- 每个卡片带小图标 + 数值 + 同比变化趋势指示
- Hover 时轻微上浮 + 阴影增强（SaaS 质感）

### 图表区域
- 趋势图（BarChart）和行业饼图并排或上下排列
- 饼图改为 Donut 样式，中心显示总数
- 图例改为侧边二级折叠列表（已实现，需微调样式）

### 地图
- 作为独立 Tab/图层存在
- 标记使用 #fe5c00（国内）和 #ff8c00（国际）
- 点击标记显示展会详情 Popup

### SaaS 设计质感
- 卡片使用更柔和的阴影（box-shadow 层级）
- 统一的 border-radius 体系（sm: 6px, md: 8px, lg: 12px）
- 所有交互元素有 hover/active/focus 过渡（transition-colors）
- 空状态统一使用居中图标 + 灰色文字 + 淡色背景
- Loading 骨架屏保持现有风格（animate-pulse + gray-200）

### 数据更新
- 用户半年更新一次数据（手动替换 mwlab.db 即可）
- 不需要数据同步/刷新机制
- 不需要实时数据推送
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 现有实现
- `components/charts/IndustryPieChart.tsx` — 行业饼图 + 二级折叠图例（已实现 l2ByL1 折叠面板）
- `app/dashboard/dashboard-content.tsx` — Dashboard 主页面，4 层 Tab 切换 + 筛选 + 数据获取
- `components/dashboard/KpiCardRow.tsx` — KPI 卡片行
- `components/dashboard/TrendChart.tsx` — 趋势柱状图
- `components/dashboard/LayerTabs.tsx` — 4 层 Tab 切换
- `components/dashboard/SubTabs.tsx` — 子 Tab 切换
- `components/ui/FilterTabs.tsx` — 行业筛选器组件
- `app/map/map-view.tsx` — Leaflet 地图组件
- `app/api/map/markers/route.ts` — 地图标记 API

### 品牌规范
- MD 品牌色板：主色 #fe5c00，浅色背景 #fff3ec，深色文字 #e55300
- 更多品牌上下文：参见 Phase 04 的 04-04-PLAN.md 和 04-CONTEXT.md

### 设计参考
- `.planning/phases/04-frontend-architecture/04-HUMAN-UAT.md` — Phase 4 人工验收结果
</canonical_refs>

<specifics>
## Specific Ideas

用户原话：
> "把Excel的切片做成带设计样式和带地图样式的就够用了"
> "类似PowerBI的基础盘面，但更具有设计质感，更像是一个生态风丰富的SaaS界面"
> "数据源更新的问题可以先不用考虑最高优先级，我可以半年一更新这份数据"

关键洞察：
- 用户不需要复杂的数据分析工作流
- 核心需求是「筛选 → 看数 → 切换视图」的简单循环
- 设计质感是差异化重点（对标生态型 SaaS 而非传统 BI 工具）
- 4 层 Dashboard 架构可能过度设计 — 用户只需要概览 + 明细 + 地图
</specifics>

<deferred>
## Deferred Ideas

- 数据自动更新/同步机制（用户半年手动更新）
- 实时数据推送
- 高级分析功能（热力矩阵、标签摘要等 — 保留 Tab 但标记为开发中）
- 导出功能
- 搜索功能
- 集团分析
</deferred>

---

*Phase: 06-ui-ux-redesign*
*Context gathered: 2026-05-08 via user design feedback*
