# 04-05 SUMMARY — 4-Layer Dashboard Architecture

**Status**: complete
**Date**: 2026-05-08
**Execution**: inline (worktree agent failed, re-executed on main)

## Tasks Completed

### Task 1: LayerTabs + SubTabs
- `components/dashboard/LayerTabs.tsx` — 4-layer tab switcher (概览/分析/地理/明细) with lucide icons
- `components/dashboard/SubTabs.tsx` — per-layer sub-tab pill switcher with 4 exported tab arrays (OVERVIEW_SUBTABS, ANALYSIS_SUBTABS, GEO_SUBTABS, DETAIL_SUBTABS)
- Selected state uses MD Orange (`text-accent`, `bg-accent-surface`, `text-accent-dark`)

### Task 2: KpiCardRow + TrendChart + BrandTable
- `components/dashboard/KpiCardRow.tsx` — 4-KPI card grid (面积/展商/观众/集团) using existing KpiCard
- `components/dashboard/TrendChart.tsx` — recharts BarChart with `#fe5c00` fill, loading skeleton, empty state ("暂无趋势数据"), ResponsiveContainer
- `components/dashboard/BrandTable.tsx` — brand list table with competition_relation capsules (red/orange/blue/gray), MDS related badges, hover highlight, empty state

### Task 3: dashboard-content.tsx refactor
- Added `activeLayer` + `activeSub` state management
- LayerTabs rendered below FilterTabs (global filters preserved)
- SubTabs rendered below LayerTabs, resets on layer change
- Content conditionally rendered per layer/subtab:
  - overview/summary: KpiCardRow + IndustryPieChart
  - overview/trend: TrendChart (with `data?.yearTrend` from API — B1 fix)
  - overview/organizer, overview/snapshot: placeholder
  - analysis/industry: IndustryPieChart
  - analysis/relation, mds, heat, tags: placeholder
  - geo/cities: MapView (dynamic import, lazy-fetched from /api/map/markers)
  - geo/venues, compare, city-rank, venue-rank: placeholder
  - detail/brands: BrandTable
  - detail/editions, search, export: placeholder
- No supabase references

## Verification
- TypeScript: passes (no new errors)
- Build: `next build` succeeds
- Tests: 38/38 pass
- B1 fix: `grep -c "yearTrend" dashboard-content.tsx` = 1
