---
status: partial
phase: 06-ui-ux-redesign
source: [06-VERIFICATION.md]
started: 2026-05-09T10:35:00+08:00
updated: 2026-05-09T10:35:00+08:00
---

## Current Test

[awaiting human testing]

## Tests

### 1. Map markers MD orange color
expected: Open /map page — CircleMarkers use #fe5c00 fill color
result: [pending]

### 2. SlicerBar accordion panel behavior
expected: Click each L1 button — only one L2 panel opens at a time, no content overlap, correct z-index
result: [pending]

### 3. Dashboard responsive layout
expected: Resize to mobile viewport — KPI cards stack vertically, charts stack (not side-by-side)
result: [pending]

### 4. CR-01 Tooltip Bug — Accept or Fix Decision
expected: IndustryPieChart tooltip shows correct percentage (not always 100%). Currently `total` is computed from hovered item's own value instead of sum of all slices (line 48-49 of IndustryPieChart.tsx). Human decision: fix now or defer.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
