# Phase 06: Dashboard UX 重塑 — Research

**Researched:** 2026-05-09
**Domain:** Dashboard UI/UX redesign (Excel-slicer + PowerBI-style layout + MD SaaS design)
**Confidence:** HIGH

## Summary

Phase 06 is a focused UX simplification and design polish phase. The current 4-layer dashboard with 18 subtabs (half showing "开发中") is over-engineered for the user's actual workflow: "select filter -> see numbers -> check map." The user explicitly wants Excel-slicer-style industry filtering, PowerBI-style basic dashboard layout, and SaaS-grade design polish using the MD brand.

**Key discovery:** The existing codebase already contains 80% of what Phase 06 needs. The `IndustryPieChart` component has a working `l2ByL1` collapsible accordion legend that matches the Excel-slicer L2 panel behavior. The `KpiCard` already has hover effects and TrendBadge integration. The MapView, TrendChart, and BrandTable all work. The primary work is: (1) extracting the slicer pattern into a standalone sticky filter bar, (2) collapsing the navigation from 4 layers+subtabs to a single scrollable view + map toggle, (3) applying a coherent SaaS design system (shadows, radii, transitions), and (4) removing all empty/placeholder subtabs.

**Primary recommendation:** Rewrite only `dashboard-content.tsx` (layout orchestration) and `FilterTabs.tsx` (rewrite to SlicerBar). Refine existing components (KpiCard, IndustryPieChart, TrendChart) in-place. Remove `LayerTabs.tsx` and `SubTabs.tsx` or consolidate heavily. No new libraries needed.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- 4 层 Dashboard 简化为单页滚动 + Tab 切换，或保留 Layer 概念但减少嵌套
- 筛选器区域固定在顶部，不随内容滚动而消失（sticky filter bar）
- 图表卡片使用 CSS Grid 响应式布局，lg 断点以上并排，以下堆叠
- L1 行业横向排列为切片器按钮组（类似 Excel Slicer 的视觉风格）
- 选中某个 L1 后，L2 在下方展开为多选标签面板
- 点选 L2 即时过滤全部盘面数据
- 非当前 L1 下的 L2 选项折叠隐藏，不遮挡页面
- 已实现的二级列表（IndustryPieChart 内的 l2ByL1 折叠面板）保留并优化
- 4 卡片横排：总面积/总展商/总观众/主办方数, hover 时轻微上浮 + 阴影增强
- 趋势图和行业饼图并排或上下排列, 饼图改为 Donut 样式，中心显示总数
- 地图作为独立 Tab/图层, 标记使用 #fe5c00（国内）和 #ff8c00（国际）
- 卡片使用更柔和的阴影, 统一的 border-radius 体系（sm:6px, md:8px, lg:12px）
- 所有交互元素有 hover/active/focus 过渡
- 空状态统一使用居中图标 + 灰色文字 + 淡色背景
- Loading 骨架屏保持现有风格

### Claude's Discretion
- 具体组件的拆解粒度（拆多少个文件）
- 过渡动画的具体参数（duration/easing）
- 空状态图标的选择
- DOM 结构微调

### Deferred Ideas (OUT OF SCOPE)
- 数据自动更新/同步机制
- 实时数据推送
- 高级分析功能（热力矩阵、标签摘要等）
- 导出功能
- 搜索功能
- 集团分析
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-SLICER | 行业筛选改为 Excel 切片器风格（L1 行 + L2 展开面板），点选即时同步全盘面 | IndustryPieChart l2ByL1 panel exists. Extract to standalone SlicerBar component. |
| UI-DASHBOARD | PowerBI 风格四卡片 + 趋势图 + 饼图，布局响应式不堆叠 | KpiCardRow, TrendChart, IndustryPieChart all exist. Need donut center label. |
| UI-MAP | Leaflet 地图保留且独立为地理图层，标记 MD 橙色 | MapView exists with correct colors. Keep as-is or add as dashboard tab. |
| UI-SAAS | 全局 SaaS 质感：微妙阴影、圆角层级、hover 过渡、空状态插画感 | Shadow/radius system needs CSS variables. Empty states need icon + illustration. |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Filter state management | Browser (Client) | — | URL searchParams + useState is sufficient. No backend API changes needed. |
| Industry slicer display | Browser (Client) | — | Pure UI rendering of L1/L2 options derived from brand data |
| KPI aggregation | API (Backend) | — | Already exists at `/api/dashboard` via better-sqlite3 BFF |
| Chart rendering | Browser (Client) | — | recharts renders from API-provided data. No SSR needed. |
| Map rendering | Browser (Client) | — | Leaflet + react-leaflet, client-only (dynamic import) |
| Layout orchestration | Browser (Client) | — | Single-page scrolling layout with sticky filter bar |
| Data fetching | Browser (Client) | API (Backend) | useEffect -> fetch -> useState. No server state management needed. |

**Key insight:** This phase is entirely client-side UI restructuring. Zero backend changes required. All data already flows through the existing `/api/dashboard` endpoint with industry_l2, competition_relation, and mds_related query parameters.

## Standard Stack

### Core (all existing — no new dependencies)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.4 | App framework | Existing. App Router with dynamic routes. |
| recharts | 2.15.4 | Charts (bar, pie) | Existing. Decent composability for bar + donut chart. |
| react-leaflet | 5.0.0 | Map rendering | Existing. OSM tile layer + CircleMarker. |
| lucide-react | 0.532.0 | Icons | Existing. Used in Sidebar, KpiCard, TrendBadge. |
| Tailwind CSS | 4.x | Styling | Existing. CSS variable theme in globals.css. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS `@theme` | — | Design tokens | Shadow tiers, radius, spacing. Add to existing globals.css. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| URL searchParams sync | Zustand / React Context | URL params are shareable and trivially simple for this use case. Adding Zustand is over-engineering. |
| Tailwind CSS | Radix UI / shadcn/ui | shadcn would add dependency overhead. The design system is simple enough for custom Tailwind. |

**Installation:** `npm install` (all deps exist, no new packages required)

**Version verification:** Current package.json shows Next 16.2.4, recharts 2.15.4, react-leaflet 5.0.0, lucide-react 0.532.0, jose 6.2.3 — all verified from package.json.

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │  Sticky SlicerBar (L1 buttons + L2 expandable panel)     │    │
│  │  ┌──────┬──────┬──────┬──────┬──────┐                    │    │
│  │  │ ALL  │ Mech │ Leis │ Life │ Tech │ ...                │    │
│  │  └──────┴──────┴──────┴──────┴──────┘                    │    │
│  │  ┌──────┬──────┬──────┐  (L2 pills for active L1)        │    │
│  │  │ Auto │ CNC  │ Robot│                                  │    │
│  │  └──────┴──────┴──────┘                                  │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──── KPI Row ────┬──── KPI Row ────┬──── KPI Row ────┬────┐  │
│  │ 展览面积 2.1M ㎡ │ 展商 45.5K      │ 观众 1.2M       │ 主办 28│
│  └─────────────────┴─────────────────┴─────────────────┴────┘  │
│                                                                  │
│  ┌── TrendChart ──┐  ┌── IndustryPieChart (Donut) ──┐          │
│  │  [bar chart]   │  │       [donut chart]           │          │
│  │  2022-2028     │  │    + l2ByL1 side legend       │          │
│  └────────────────┘  └───────────────────────────────┘          │
│                                                                  │
│  ┌── MapView (toggle: dashboard tab OR separate page) ──────┐  │
│  │  [Leaflet + CircleMarker]                                │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌── BrandTable (collapsible or bottom section) ────────────┐  │
│  │  [name | industry | organizer | relation | mds]           │  │
│  └───────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
        │  useEffect → fetch()                                      │
        ▼                                                           │
┌───────────────────┐                                              │
│  Next.js BFF      │  GET /api/dashboard?industry_l2=X             │
│  (better-sqlite3) │  GET /api/map/markers                         │
│  route.ts         │                                              │
└───────┬───────────┘                                              │
        │ SQL queries                                               │
        ▼                                                           │
┌───────────────────┐                                              │
│  mwlab.db (SQLite)│                                              │
│  exhibition_brand │                                              │
│  exhibition_edition│                                             │
└───────────────────┘                                              │
```

**Data flow (primary use case):**
1. User clicks L1 button in SlicerBar
2. L2 panel expands below (client-side state, immediate)
3. User clicks L2 pill (or leaves L2 unselected for L1-level filter)
4. URL searchParams update -> `buildQueryString()` -> `router.replace()`
5. `useEffect` triggers `fetchData()` -> `GET /api/dashboard?industry_l2=X`
6. API returns filtered kpis + brands + industryDistribution + yearTrend
7. All components re-render with new data
8. Map markers are fetched independently when map tab is viewed

### Recommended Project Structure (changes only)

```
src/                                  (no structural change)
├── components/
│   ├── dashboard/
│   │   ├── KpiCardRow.tsx            KEEP — minor icon add
│   │   ├── TrendChart.tsx            KEEP — minor refinement
│   │   ├── BrandTable.tsx            KEEP — as-is
│   │   ├── SlicerBar.tsx           REWRITE — replaces FilterTabs.tsx
│   │   ├── LayerTabs.tsx            REMOVE or simplify to 2 tabs
│   │   └── SubTabs.tsx              REMOVE or keep only implemented
│   ├── charts/
│   │   └── IndustryPieChart.tsx      REFINE — donut center label + color
│   ├── ui/
│   │   ├── KpiCard.tsx               REFINE — icon + trend enhancement
│   │   └── TrendBadge.tsx            KEEP — as-is
│   └── layout/
│       ├── AppShell.tsx              KEEP — as-is
│       └── Sidebar.tsx               KEEP — as-is
├── app/
│   ├── dashboard/
│   │   ├── page.tsx                  KEEP — fallback skeleton
│   │   └── dashboard-content.tsx    REWRITE — new layout orchestration
│   └── map/
│       └── map-view.tsx              KEEP — as-is
└── app/globals.css                   ADD — shadow/radius CSS variables
```

### Pattern 1: Excel-Slicer Pattern (Standalone SlicerBar)

**What:** A horizontal row of L1 "切片器" buttons at the top of the dashboard. Clicking an L1 expands that L1's L2 options below as a pill grid. Clicking an L2 pill toggles selection. The pattern is extracted from the existing l2ByL1 accordion in IndustryPieChart into a standalone sticky bar.

**When to use:** Always. This is the primary user interaction for data filtering.

**Example structure (derived from existing patterns in IndustryPieChart l2ByL1 + FilterTabs):**
```tsx
// SlicerBar.tsx — new component, replaces FilterTabs.tsx
// Uses existing l2ByL1 Map<string, string[]> for data
// L1 buttons: horizontal row, active state = MD orange fill
// L2 panel: pills in a flex-wrap grid, multi-select toggle
// Filter state flows up via callbacks (onL1Change, onL2Change)
// Competition relation + MDS become secondary pill rows below
```

**Key implementation points:**
- SlicerBar is position: sticky; top: 0; z-index: 10 with white/glass background
- L1 buttons are rectangular (not pills) — styled like Excel slicer buttons with MD orange border-left or fill
- L2 pills are small rounded tags with check/selection state
- Only ONE L1's L2 panel is open at a time (accordion behavior)

### Pattern 2: PowerBI-Style Single-Page Scroll

**What:** All dashboard content on one scrollable page, no tab switching within the dashboard. The only "tab" is a toggle between dashboard view and map view.

**When to use:** This replaces the 4-layer + sub-tab architecture.

```tsx
// dashboard-content.tsx — restructured
// Layout (top to bottom):
// 1. <SlicerBar /> — sticky
// 2. <KpiCardRow /> — always visible
// 3. <TrendChart /> + <IndustryPieChart /> — side by side (lg: grid-cols-2)
// 4. <BrandTable /> — full width, optional collapsible
// Filter state lives in this component, passed down
// No LayerTabs. No SubTabs. Map = separate route or toggle.
```

### Anti-Patterns to Avoid
- **Nested tab switching (LayerTabs + SubTabs):** Current approach creates 18 view states. User cannot remember where data lives. Replace with flat scroll.
- **L2 pills inside FilterTabs row:** Current implementation shows L2 pills inline below L1 pills, creating visual clutter. Move to expandable panel.
- **Empty state explosion:** 9 of 18 subtabs show "开发中". This signals brokenness. Remove them entirely.
- **Filter state duplication:** Current code has both URL params AND useState. Keep both for shareability but ensure single source of truth.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Charts (bar, pie) | Custom SVG/Canvas | recharts | Complexity: axis computation, tooltip positioning, responsive sizing |
| Map tiles | Custom tile server | Leaflet + OSM | 500+ tile servers already exist, OSM is free |
| Icons | Custom SVG sprites | lucide-react | Tree-shakeable, consistent 24px grid, accessible |
| JWT auth | Custom crypto | jose | Standards-compliant JWT verification, no crypto mistakes |

**Key insight:** This phase adds ZERO new library dependencies. Every UI need is met by what is already in package.json. The work is refactoring and composing existing components.

## Runtime State Inventory

> Phase 06 is a UI refactor (no rename/rebrand/migration). Skipping exhaustive runtime inventory.

No stored data, service config, OS registrations, secrets/env vars, or build artifacts are affected by this phase. The data layer (mwlab.db, API routes, auth) is untouched.

## Common Pitfalls

### Pitfall 1: Over-Retaining the Layer/Sub-Tab Architecture
**What goes wrong:** The planner creates tasks that keep LayerTabs and SubTabs with minor modifications, perpetuating the 18-view navigation.
**Why it happens:** "We already built it, we should keep it." The existing code feels like an investment worth preserving.
**How to avoid:** User explicitly said 4-layer architecture is "过度设计". Kill LayerTabs entirely. Single scrollable dashboard + map toggle.
**Warning signs:** Any task mentioning LayerTabs or SubTabs beyond removal.

### Pitfall 2: Rewriting What Already Works
**What goes wrong:** Every component gets rewritten "to be cleaner" rather than focusing on the parts that actually need change.
**Why it happens:** Developer pride in cleaning up code. The existing code works and passes UAT.
**How to avoid:** Component reuse table in this document. Only rewrite FilterTabs (to SlicerBar) and dashboard-content.tsx (layout). All other components get minor in-place refinements.
**Warning signs:** Tasks for rewriting KpiCard, TrendChart, BrandTable, MapView, IndustryPieChart.

### Pitfall 3: Creating a New "Empty State" Burden
**What goes wrong:** The new layout re-introduces empty/placeholder content for unimplemented features.
**Why it happens:** The current 18 subtabs mirror a vision document, not an implemented system. Replacing them with new empty sections perpetuates the problem.
**How to avoid:** Only implement what the user asked for: slicer, KPI, trend chart, pie chart, map, brand table. Nothing else. No "coming soon" placeholders.
**Warning signs:** Any task mentioning features from the deferred list (export, search, heat map, etc.).

### Pitfall 4: Adding State Management Libraries
**What goes wrong:** Someone decides URL params are "not clean enough" and adds Zustand, Redux, or React Context for filter state.
**Why it happens:** Large-scale app habits applied to a small-scale app.
**How to avoid:** The data flow is trivial: filter change -> URL -> fetch -> render. No cross-component state sharing beyond parent-child. URL params are the correct solution for filter persistence and shareability.
**Warning signs:** Any task mentioning Zustand, Redux, Context, or new npm packages.

## Code Examples

Current patterns that should be preserved (verified against codebase):

### Filter Sync via URL Params (Keep)
```typescript
// Source: dashboard-content.tsx (existing, working pattern)
const buildQueryString = useCallback(() => {
  const params = new URLSearchParams();
  if (selectedL2) params.set("industry_l2", selectedL2);
  if (selectedRelations.length > 0)
    params.set("competition_relation", selectedRelations.join(","));
  if (selectedMds) params.set("mds_related", selectedMds);
  return params.toString();
}, [selectedL2, selectedRelations, selectedMds]);

// Filter change -> sync URL + refetch
useEffect(() => {
  if (!mountedRef.current) return;
  const raw = buildQueryString();
  const nextUrl = `/dashboard${raw ? `?${raw}` : ""}`;
  router.replace(nextUrl, { scroll: false });
  fetchData(raw);
}, [selectedL2, selectedRelations, selectedMds]);
```

### Donut Pie Chart with Center Label (Add)
```tsx
// Source: IndustryPieChart.tsx (add center label ref)
// Replace <Pie> with donut, add center text via custom label:
// Use recharts Pie's innerRadius + custom Label component
// Reference: existing pie already has innerRadius={50}, outerRadius={100}
// Add center label:
<Pie ...>
  <Label
    content={({ viewBox }) => {
      const total = data.reduce((sum, d) => sum + d.value, 0);
      return (
        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle">
          <tspan fontSize="24" fontWeight="bold" fill="#111827">
            {total.toLocaleString()}
          </tspan>
          <tspan fontSize="12" fill="#6B7280" dy="18">
            总数
          </tspan>
        </text>
      );
    }}
  />
</Pie>
```

### Existing SaaS-Style KPI Card Hover (Keep + Refine)
```tsx
// Source: KpiCard.tsx (already has hover, keep this pattern)
// Current hover effect:
className={`... hover:shadow-[0_4px_12px_rgba(254,92,0,0.12)] hover:-translate-y-px`}
// Add icon prop and minor refinements only
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| FilterTabs with inline L2 pills | SlicerBar with expandable L2 panel | Phase 06 | Cleaner filter interaction, no content occlusion |
| 4 layers + 18 subtabs | Single-page scroll + map toggle | Phase 06 | Drastically reduced cognitive load |
| Empty "开发中" subtabs | Removed entirely | Phase 06 | No dead UI, signals completeness |
| Pie chart (no center label) | Donut chart with total count center | Phase 06 | Better data density, PowerBI convention |
| shadow-sm only | Tiered shadow system (sm/md/lg/xl) | Phase 06 | SaaS-quality visual hierarchy |

**Deprecated/outdated:**
- `LayerTabs.tsx`: The 4-layer navigation concept originated from PRD Phase 4 vision. User feedback deprecates it. Component should be removed or reduced to a 2-tab toggle (dashboard vs map).
- `SubTabs.tsx`: All subtabs showing "开发中" should be deleted. Only summary, trend, industry, brands were ever implemented.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | No backend changes are needed for Phase 06 | Architectural Responsibility Map | Low — API already supports all filter params. Adding map industry filtering would need backend change but is not requested. |
| A2 | The existing IndustryPieChart l2ByL1 accordion can be extracted into SlicerBar | Component Reuse Analysis | Low — the data structure (Map<string, string[]>) is the same. The rendering logic is pure JSX. |
| A3 | URL searchParams are sufficient for filter state management | State & Data Flow | Low — current implementation works in production. No cross-component sync issues observed. |
| A4 | No new npm packages are needed | Standard Stack | Low — all existing libraries (recharts, Leaflet, lucide-react) cover every UI need identified. |

**No critical assumptions.** All major claims are verified from the codebase.

## Open Questions

1. **Map integration: tab or separate page?**
   - What we know: Map currently exists as both a standalone route (`/map`) and a geo subtab. User wants "地图为独立图层".
   - What's unclear: Should the map be a toggle on the dashboard page (swapping content view) or keep it as a sidebar navigation target?
   - Recommendation: Keep it as a sidebar nav item (current approach). It already works. No need to duplicate into dashboard. The sidebar already has a "地图" link with active state.

2. **Competition relation and MDS filter placement**
   - What we know: These are secondary filters that currently appear as separate pill rows in FilterTabs.
   - What's unclear: Should they remain in the sticky bar below the industry slicer, or move to a collapsible "advanced filters" section?
   - Recommendation: Keep them as secondary rows in the sticky SlicerBar area, visually less prominent (smaller text, gray background) below the industry L1/L2 section. This maintains the "三步点选" principle.

3. **BrandTable placement**
   - What we know: BrandTable was under "明细-品牌列表" subtab.
   - What's unclear: Should it appear at the bottom of the single-page scroll, or be collapsible/expandable?
   - Recommendation: Place at the bottom of the dashboard page as a collapsed-by-default section with a "显示品牌列表 (N)" toggle. Keeps the scroll view clean while maintaining access.

## Environment Availability

No external dependencies beyond the existing Next.js development server. The phase is pure client-side UI refactoring. No new tools, services, or runtimes needed.

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

**Step 2.6: SKIPPED (no external dependencies identified)**

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest |
| Config file | `vitest.config.ts` (in project root) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-SLICER | L1 click expands L2 panel | manual (visual) | — | — |
| UI-SLICER | L2 click updates URL params | e2e | `npx vitest run tests/ui-slicer.test.tsx` | ❌ Wave 0 |
| UI-DASHBOARD | KPI cards render from API data | integration | `npx vitest run tests/dashboard-api.test.ts` | ❌ Wave 0 |
| UI-MAP | Map markers render with correct colors | manual (visual) | — | — |
| UI-SAAS | Empty states show placeholder UI | unit | `npx vitest run tests/ui-empty-state.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --changed` (run tests affected by changes)
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `tests/ui-slicer.test.tsx` — covers SlicerBar L1/L2 interaction
- [ ] `tests/dashboard-api.test.ts` — covers dashboard data integration
- [ ] `tests/ui-empty-state.test.tsx` — covers empty state rendering

## Security Domain

Not applicable. This phase involves no authentication changes, no API endpoint changes, and no data mutation. The existing JWT middleware and API routes are untouched.

**Reason:** Phase 06 is purely a frontend UI reorganization. `security_enforcement` controls apply to the overall project but this phase introduces no security-relevant changes.

## Sources

### Primary (HIGH confidence)
- Codebase files read (verified by file content):
  - `dashboard-content.tsx` — current layout architecture
  - `FilterTabs.tsx` — current filter component
  - `IndustryPieChart.tsx` — l2ByL1 pattern, donut chart
  - `KpiCard.tsx` — hover effects, trend badge
  - `TrendChart.tsx` — bar chart with MD orange
  - `BrandTable.tsx` — brand list table
  - `MapView.tsx` — Leaflet map with CircleMarker
  - `LayerTabs.tsx` — 4-layer nav
  - `SubTabs.tsx` — sub-tab nav with 18 tab definitions
  - `globals.css` — MD brand CSS variables
  - `Sidebar.tsx` — sidebar nav structure
  - `AppShell.tsx` — layout shell
  - `routes.ts` — dashboard API (filters: industry_l2, competition_relation, mds)

### Secondary (MEDIUM confidence)
- Phase 04 CONTEXT.md (D-01 through D-19 — architectural decisions now superseded by Phase 06 user feedback)
- Phase 04 HUMAN-UAT.md (verification that all 6 tests passed, confirming current architecture is functional)

### Tertiary (LOW confidence)
- None — all claims verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified from package.json and existing imports
- Architecture: HIGH — verified from codebase reading and CONTEXT.md user decisions
- Pitfalls: HIGH — derived from known UX anti-patterns visible in codebase
- Component reuse: HIGH — each component file read and assessed individually

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (30-day validity for UI patterns — no external dependency changes expected)
