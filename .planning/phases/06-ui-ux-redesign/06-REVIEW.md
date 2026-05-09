---
phase: 06-ui-ux-redesign
reviewed: 2026-05-09T12:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - app/dashboard/dashboard-content.tsx
  - app/globals.css
  - app/map/map-content.tsx
  - components/charts/IndustryPieChart.tsx
  - components/dashboard/BrandTable.tsx
  - components/dashboard/KpiCardRow.tsx
  - components/dashboard/SlicerBar.tsx
  - components/dashboard/TrendChart.tsx
  - components/ui/EmptyState.tsx
  - components/ui/KpiCard.tsx
findings:
  critical: 1
  warning: 2
  info: 4
  total: 7
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-05-09
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Reviewed 10 source files from the Phase 06 UI/UX redesign scope: 2 page-level content components, 4 dashboard components, 1 chart component, 2 UI primitives, and 1 global stylesheet. The code is generally well-structured with consistent patterns, proper TypeScript typing, and good error/loading/empty state handling.

One blocking bug was found in the IndustryPieChart tooltip (percentage calculation always shows 100%). Two warnings relate to error handling quality. Four informational items cover dead code, semantic imprecision, and design convention notes.

---

## Critical Issues

### CR-01: Tooltip percentage always shows 100% in IndustryPieChart

**File:** `components/charts/IndustryPieChart.tsx:47-49`
**Issue:** The `CustomTooltip` component computes the percentage using `payload[0].payload.value` as the `total`, but this is the value of the *currently hovered* slice, not the sum of all slices. The result is that every tooltip displays `100.0%` regardless of the slice's actual proportion.

```ts
// BUG: total equals the hovered item's own value, not the sum of all items
const total = payload[0].payload.value;  // <-- same as `value`
const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";  // always "100.0"
```

**Fix:** Pass the full `data` array into `CustomTooltip` so it can compute the true total:

```tsx
// In CustomTooltip props — add a `total` prop or the full data array
function CustomTooltip({
  active,
  payload,
  total,  // NEW: precomputed sum of all values
}: {
  active?: boolean;
  payload?: CustomTooltipPayload[];
  total?: number;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];
  const pct = total && total > 0 ? ((value / total) * 100).toFixed(1) : "0.0";
  // ...
}

// In the parent component, compute the total and pass it:
const totalValue = data.reduce((sum, d) => sum + d.value, 0);
// ...
<Tooltip content={<CustomTooltip total={totalValue} />} />
```

---

## Warnings

### WR-01: Empty catch block silently swallows all errors during initial data load

**File:** `app/dashboard/dashboard-content.tsx:118`
**Issue:** The initial mount effect catches errors from the unfiltered `/api/dashboard` fetch with an empty catch block (`catch { /* silent */ }`). While the code has a fallback (it proceeds to the filtered `fetchData` call), silently swallowing errors makes debugging difficult and could mask API contract changes, network issues, or malformed responses.

**Fix:** At minimum, log the error to the console:

```ts
} catch (err) {
  console.warn("Initial unfiltered dashboard fetch failed, falling back to filtered fetch:", err);
}
```

---

### WR-02: Full page reload for error retry discards all client state

**File:** `app/map/map-content.tsx:54`
**Issue:** The error state's retry button calls `window.location.reload()`, which performs a full browser page reload. This discards all client-side state, resets any active filters or UI interactions, and provides a jarring user experience compared to a lightweight data re-fetch.

**Fix:** Replace with a re-fetch function, consistent with how `dashboard-content.tsx` handles retries:

```tsx
const fetchMarkers = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  try {
    const res = await fetch("/api/map/markers");
    // ... same logic as existing useEffect
  } catch (e) {
    setError(e instanceof Error ? e.message : "网络异常，请稍后重试");
  } finally {
    setIsLoading(false);
  }
}, []);

// Then in the error state:
<button onClick={fetchMarkers} ...>点击重试</button>
```

---

## Info

### IN-01: Unused `isMulti` prop in `WeakPill` component

**File:** `components/dashboard/SlicerBar.tsx:97,102,284`
**Issue:** The `WeakPill` component accepts an `isMulti` prop but never references it in the component body. It is passed as `isMulti` at line 284 when rendering competition relation pills but has no effect.

**Fix:** Either remove the unused prop from the interface and call sites, or implement multi-select visual differentiation if it was intended to affect rendering.

---

### IN-02: URL search param state not normalized for empty strings

**File:** `app/dashboard/dashboard-content.tsx:46-48,53-55`
**Issue:** `selectedL2` and `selectedMds` are initialized from `searchParams.get()` which returns an empty string `""` when the URL has a key with no value (e.g., `?industry_l2=`). While `buildQueryString` correctly treats empty strings as falsy (omitting them from the query), the state variable itself holds `""` instead of `null`, which is semantically imprecise and could cause issues if any code strictly checks for `null`.

**Fix:** Normalize empty strings to `null` in the initializer:

```ts
const [selectedL2, setSelectedL2] = useState<string | null>(
  () => searchParams.get("industry_l2") || null
);
const [selectedMds, setSelectedMds] = useState<string | null>(
  () => searchParams.get("mds_related") || null
);
```

---

### IN-03: Redundant CSS variable references for theme shadows

**File:** `components/dashboard/TrendChart.tsx:18,26,37`
**Issue:** The `shadow-[var(--shadow-sm)]` class uses Tailwind's arbitrary value syntax to reference the `--shadow-sm` CSS variable. Since `--shadow-sm` is defined in the `@theme` block in `globals.css` (which registers it as a Tailwind utility), the simpler `shadow-sm` class would achieve the same result. The arbitrary value variant adds unnecessary complexity without benefit.

**Fix:** Replace `shadow-[var(--shadow-sm)]` with `shadow-sm`:

```diff
- <div className="bg-white border border-border rounded-xl p-5 shadow-[var(--shadow-sm)]">
+ <div className="bg-white border border-border rounded-xl p-5 shadow-sm">
```

---

### IN-04: Custom shadow definitions in `@theme` override Tailwind v4 defaults globally

**File:** `app/globals.css:33-36`
**Issue:** The `--shadow-sm`, `--shadow-md`, `--shadow-lg`, `--shadow-xl` definitions in the `@theme` block override Tailwind v4's built-in shadow scale. This means every use of `shadow-sm` (or any shadow utility) anywhere in the application uses the project-specific values. While likely intentional (for consistent SaaS styling), it is worth documenting because third-party components or future developers may expect Tailwind's default shadow values.

**Fix:** No code change needed. Consider adding a comment in `globals.css` noting that these shadow overrides are intentional and apply globally:

```css
/* Shadow 层级 — SaaS 质感 (overrides Tailwind v4 defaults globally) */
```

---

_Reviewed: 2026-05-09_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
