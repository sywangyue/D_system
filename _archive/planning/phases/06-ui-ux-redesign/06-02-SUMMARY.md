---
phase: 06-ui-ux-redesign
plan: 02
type: execute
wave: 1
subsystem: ui
tags: [recharts, lucide-react, KpiCard, donut-chart, icon-support]

requires: []
provides:
  - KpiCard with optional icon prop and variant-aware coloring
  - KpiCardRow with lucide-react icons for each KPI metric
  - IndustryPieChart with donut center total brand count label
affects: []

tech-stack:
  added: [lucide-react Square, Users, Eye, Building2 icons]
  patterns:
    - "KpiCard icon above label with variant-aware accent/accent-dark color"
    - "Donut center label using recharts Label component with custom content renderer"

key-files:
  modified:
    - components/ui/KpiCard.tsx
    - components/dashboard/KpiCardRow.tsx
    - components/charts/IndustryPieChart.tsx

key-decisions:
  - "KpiCard icon prop is optional React.ReactNode, placed above label with w-8 h-8 sizing"
  - "loading skeleton includes icon placeholder pulse"
  - "lucide-react icons: Square (面积), Users (展商), Eye (观众), Building2 (主办方)"
  - "recharts Label content uses viewBox type assertion for cx/cy access (PolarViewBox)"
  - "Donut center total calculated from data.reduce, formatted with toLocaleString('en-US')"

requirements-completed: [UI-DASHBOARD, UI-SAAS]

duration: 6min
completed: 2026-05-09
---

# Phase 06 Plan 02: KpiCard Icons + Donut Center Label

**KpiCard icon support with lucide-react icons for 4 KPI metrics + IndustryPieChart donut center showing total brand count**

## Performance

- **Duration:** 6 min
- **Started:** 2026-05-09T10:02:00Z
- **Completed:** 2026-05-09T10:08:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- KpiCard accepts optional `icon?: React.ReactNode` prop, renders above label with variant-aware color (highlight=accent-dark, standard=accent)
- KpiCardRow passes lucide-react Square/Users/Eye/Building2 icons to each KPI card; label "展览集团" corrected to "主办方数"
- IndustryPieChart shows total brand count in donut center (large number + "品牌" label), hidden when data is empty

## Task Commits

Each task was committed atomically:

1. **Task 1: KpiCard icon prop + KpiCardRow icons + label update** - `8236789` (feat)
2. **Task 2: IndustryPieChart donut center Label** - `2a0e77d` (feat)

**Plan metadata:** committed in next step (docs: complete plan)

## Files Modified
- `components/ui/KpiCard.tsx` - Added optional icon prop, icon rendering above label, loading skeleton placeholder
- `components/dashboard/KpiCardRow.tsx` - Imported 4 lucide-react icons, passed to each KpiCard, updated label
- `components/charts/IndustryPieChart.tsx` - Added Label import from recharts, donut center total count with "品牌" label

## Decisions Made
- Icons placed above label in a `w-8 h-8` container with `mb-2` spacing, not inline (better visual hierarchy for SaaS design)
- lucide-react `Square`, `Users`, `Eye`, `Building2` confirmed available in 0.532.0
- recharts Label `ViewBox` type assertion `as { cx?: number; cy?: number }` needed because TS union type (CartesianViewBox|PolarViewBox) doesn't expose cx/cy directly
- Center label only renders in populated state; loading, error, and empty states are unaffected

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

None - all functionality is wired with real icon references and real data aggregation.

## Success Criteria Verification

- [x] KpiCard accepts icon prop, KpiCardRow passes 4 icons
- [x] IndustryPieChart donut center displays total brand count
- [x] `npm run build` passes with no errors

## Issues Encountered

- TypeScript type error on `viewBox.cx/cy` destructure (`Property 'cx' does not exist on type 'ViewBox'`). Fixed by using type assertion `as { cx?: number; cy?: number }` since recharts ViewBox is a union of CartesianViewBox|PolarViewBox, and only PolarViewBox has cx/cy.

## Next Phase Readiness
- Ready for Phase 06-03 (Wave 2) which can build on the icon pattern and donut label style established here

---
*Phase: 06-ui-ux-redesign*
*Plan: 02*
*Completed: 2026-05-09*
