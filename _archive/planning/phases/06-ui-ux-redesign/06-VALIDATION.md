---
phase: 06
slug: ui-ux-redesign
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest |
| **Config file** | `vitest.config.ts` (in project root) |
| **Quick run command** | `npx vitest run --reporter=verbose` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npx vitest run --changed`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | UI-SAAS | — | N/A | unit | `grep "shadow-soft\|shadow-card\|rounded-btn" app/globals.css` | ✅ | ⬜ pending |
| 06-01-02 | 01 | 1 | UI-SLICER | — | N/A | e2e | `npx vitest run tests/ui-slicer.test.tsx` | ❌ W0 | ⬜ pending |
| 06-02-01 | 02 | 1 | UI-DASHBOARD | — | N/A | unit | `grep "Icon\|icon" components/ui/KpiCard.tsx` | ✅ | ⬜ pending |
| 06-02-02 | 02 | 1 | UI-DASHBOARD | — | N/A | unit | `grep "Label\|innerRadius\|outerRadius" components/charts/IndustryPieChart.tsx` | ✅ | ⬜ pending |
| 06-03-01 | 03 | 1 | UI-SAAS | — | N/A | unit | `npx vitest run tests/ui-empty-state.test.tsx` | ❌ W0 | ⬜ pending |
| 06-03-02 | 03 | 1 | UI-DASHBOARD | — | N/A | unit | `grep "shadow-card\|rounded-card" components/dashboard/TrendChart.tsx` | ✅ | ⬜ pending |
| 06-04-01 | 04 | 2 | UI-DASHBOARD | — | N/A | unit | `test -f components/dashboard/LayerTabs.tsx && echo "FAIL" || echo "PASS"` | ✅ | ⬜ pending |
| 06-04-02 | 04 | 2 | UI-DASHBOARD | — | N/A | integration | `npx vitest run tests/dashboard-api.test.ts` | ❌ W0 | ⬜ pending |
| 06-04-03 | 04 | 2 | UI-MAP, UI-SAAS | — | N/A | unit | `grep "EmptyState" app/map/map-content.tsx components/dashboard/BrandTable.tsx` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/ui-slicer.test.tsx` — covers SlicerBar L1/L2 interaction
- [ ] `tests/dashboard-api.test.ts` — covers dashboard data integration
- [ ] `tests/ui-empty-state.test.tsx` — covers empty state rendering

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SlicerBar L1 click expands L2 panel | UI-SLICER | Visual layout verification | Click each L1 button, verify L2 panel appears below, no overlap |
| Map markers render MD orange | UI-MAP | Visual color verification | Open /map, verify all CircleMarkers use #fe5c00 fill |
| Dashboard responsive layout | UI-DASHBOARD | Visual breakpoint check | Resize browser to mobile, verify KPI cards stack vertically |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
