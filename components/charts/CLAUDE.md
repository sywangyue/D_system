# components/charts/ — Recharts chart components

## "use client" required

All recharts components must be `"use client"` — the library calls `getBoundingClientRect()` internally for layout calculations.

## Legend formatter type quirk

recharts Legend formatter payload type is `{ strokeDasharray, value? }` NOT the raw data shape. Use optional chaining when accessing `.payload.value`:

```tsx
formatter={(_v: string, entry: { payload?: { value?: number } }) =>
  entry.payload?.value != null ? `...(${entry.payload.value.toLocaleString()})` : _v
}
```

## Animation flag

Set `isAnimationActive={false}` on Pie to prevent SSR→client hydration mismatches from recharts animations.

## State contract

Same 4-state contract as all UI components: populated (chart render), loading (skeleton), empty ("暂无数据"), error (message + retry).

## Pie chart structure

PieChart → Pie → Cell (per data entry, colored by `CHART_COLORS[index % length]`). Tooltip and Legend are siblings of Pie inside PieChart.
