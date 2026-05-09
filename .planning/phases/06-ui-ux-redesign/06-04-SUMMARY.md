---
phase: 06-ui-ux-redesign
plan: 04
type: execute
wave: 2
subsystem: ui
tags:
  - layout-rewrite
  - single-page-scroll
  - slicer-bar
  - empty-state
  - brand-table
depends_on:
  - 06-01
  - 06-02
  - 06-03
requires: []
provides:
  - Single-page scroll dashboard layout (SlicerBar -> KpiCardRow -> TrendChart+PieChart -> BrandTable)
  - LayerTabs/SubTabs removed (4-layer, 18-subtab architecture eliminated)
  - EmptyState integration in BrandTable and MapContent
affects: []
tech-stack:
  added: []
  patterns:
    - "Single-page waterfall layout: SlicerBar(sticky) -> KpiCardRow -> TrendChart+IndustryPieChart(grid) -> BrandTable(collapsible)"
    - "BrandTable collapse toggle with ChevronDown/ChevronRight and brand count label"
    - "Empty state with EmptyState component for dashboard, brand table, and map"
    - "No '开发中' placeholders — removed all WIP feature slots"
key-files:
  created: []
  modified:
    - app/dashboard/dashboard-content.tsx
    - components/dashboard/BrandTable.tsx
    - app/map/map-content.tsx
  deleted:
    - components/dashboard/LayerTabs.tsx
    - components/dashboard/SubTabs.tsx
decisions:
  - "BrandTable collapsible toggle placed outside the BrandTable card as a separate button; no double-wrapping of card border-radius needed since BrandTable has its own card styling"
  - "SlicerBar onL1Change wraps both setSelectedL1 and setSelectedL2(null) in the parent for explicit control, even though SlicerBar internally calls onL2Change(null) — ensures correct React batching"
  - "Dashboard empty state uses SearchX icon; BrandTable empty uses Inbox; MapContent empty uses MapPin"
metrics:
  duration: "~10 min"
  completed: "2026-05-09"
---

# Phase 06 Plan 04: Dashboard Layout Rewrite + LayerTabs/SubTabs Removal + EmptyState Integration

**Single-page scroll waterfall layout replacing 4-layer + 18-subtab navigation architecture, with SlicerBar integration and unified EmptyState application across dashboard, brand table, and map.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-09
- **Completed:** 2026-05-09
- **Tasks:** 3
- **Files modified:** 3
- **Files deleted:** 2

## Task Commits

Each task was committed atomically:

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Remove LayerTabs and SubTabs components | `b261147` | LayerTabs.tsx (deleted), SubTabs.tsx (deleted) |
| 2 | Rewrite dashboard-content as single-page scroll layout | `9d51b35` | app/dashboard/dashboard-content.tsx |
| 3 | Replace inline empty states with EmptyState component | `5281abb` | components/dashboard/BrandTable.tsx, app/map/map-content.tsx |

## Accomplishments

### Task 1: LayerTabs/SubTabs Deletion

- Deleted `components/dashboard/LayerTabs.tsx` (4-layer tab component with overview/analysis/geo/detail layers)
- Deleted `components/dashboard/SubTabs.tsx` (18-subtab definition including "开发中" placeholder slots)
- Confirmed zero remaining references to either component across the codebase

### Task 2: Dashboard-content Complete Rewrite

**Removed:**
- `LayerTabs` import and all layer state (`activeLayer`, `activeSub`)
- `SubTabs` import and all sub navigation (`OVERVIEW_SUBTABS`, `ANALYSIS_SUBTABS`, `GEO_SUBTABS`, `DETAIL_SUBTABS`)
- `FilterTabs` import and all FilterTabs renderings (replaced with SlicerBar)
- `MapView` dynamic import and all map-related state (`mapMarkers`, `mapLoading`)
- Inline `EmptyState` helper function (replaced with imported EmptyState)
- All "开发中" placeholder content (organizer, snapshot, heat, tags, search, export, venues, compare, city-rank, venue-rank, editions)
- `getDefaultSub()` and `getSubtabs()` helper functions
- Layer/SubTab switching logic throughout
- Geo layer map marker fetch useEffect

**Retained:**
- All filter state management (`selectedL2`, `selectedRelations`, `selectedMds`, `selectedL1`)
- `deriveIndustryOptions` helper, `buildQueryString`, `fetchData` callbacks
- Initial mount init logic, filter change URL sync + refetch useEffect
- Data/loading/error state management
- Error state with retry button (preserved identical styling)

**New:**
- `SlicerBar` integration with all 4 rows (L1 buttons, L2 accordion, competition relations, MDS)
- Layout: SlicerBar (sticky) -> KpiCardRow -> TrendChart + IndustryPieChart in `lg:grid lg:grid-cols-2 gap-6` -> BrandTable with collapsible toggle
- EmptyState for zero-result state with `SearchX` icon and clear-filters action button
- `brandsExpanded` state with ChevronDown/ChevronRight toggle showing "品牌列表 (N)"
- Loading skeleton: SlicerBar loading -> KpiCardRow skeleton -> TrendChart + IndustryPieChart skeleton

### Task 3: EmptyState Integration

- **BrandTable.tsx**: Replaced inline `p-6 text-center` empty div with `<EmptyState icon={<Inbox />} message="当前筛选条件下无展会数据" />`
- **map-content.tsx**: Replaced inline `flex-col py-20` empty div with `<EmptyState icon={<MapPin />} message="暂无展会地理数据" />`
- Both imports added; no functional changes to loading or error states

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None. All components are wired with real callbacks and data sources. BrandTable, TrendChart, and IndustryPieChart all receive real data from the dashboard API. Empty states use the proper EmptyState component with correct icons.

## Threat Flags

None. This plan is a pure UI layout rewrite with no new network endpoints, auth paths, trust boundary crossings, or schema changes.

## Files Modified/Created/Deleted

### Modified
- `app/dashboard/dashboard-content.tsx` - Complete rewrite (60 insertions, 205 deletions)
- `components/dashboard/BrandTable.tsx` - Added EmptyState import and component (3 insertions, 1 deletion)
- `app/map/map-content.tsx` - Added EmptyState + MapPin imports and component (4 insertions, 4 deletions)

### Deleted
- `components/dashboard/LayerTabs.tsx` (43 lines)
- `components/dashboard/SubTabs.tsx` (63 lines)

## Verification Summary

- [x] All acceptance criteria checked and passed for each task
- [x] `npm run build` passes with no errors or warnings
- [x] No LayerTabs or SubTabs references remain in `app/` or `components/`
- [x] SlicerBar imported and rendered in dashboard-content.tsx
- [x] EmptyState imported in dashboard-content.tsx, BrandTable.tsx, map-content.tsx
- [x] No "开发中" placeholder content in dashboard-content.tsx
- [x] BrandTable has collapsible toggle with brand count

## Success Criteria

- [x] Dashboard page is single-page scroll layout, no LayerTabs/SubTabs
- [x] SlicerBar at top with sticky positioning
- [x] KpiCardRow + TrendChart + IndustryPieChart + BrandTable fully rendered
- [x] BrandTable at bottom with collapse toggle
- [x] Empty states use unified EmptyState component
- [x] Map page unaffected, remains independent sidebar navigation item
- [x] All 3 commits created and verifiable

---
*Phase: 06-ui-ux-redesign*
*Plan: 04*
*Completed: 2026-05-09*
