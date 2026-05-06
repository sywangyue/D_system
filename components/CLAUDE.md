# components/ — MWLAB Dashboard UI components

## "use client" boundary

- Components with `onClick` / `onChange` / event handlers → must have `"use client"`
- Pure presentational components (props → JSX only, no hooks/events) → stay Server Components
- Components using React hooks (`useState`, `useEffect`, etc.) → must have `"use client"`

## Component state contract

All data-display components must handle 4 states:
- **Populated**: normal render with data
- **Loading**: skeleton / animate-pulse placeholder
- **Empty**: "--" or contextual empty message (e.g., "暂无数据")
- **Error**: red error text, role="alert"

## Controlled component pattern (filter-like components)

Filter components receive all state via props and fire callbacks — they never own filter state.
Parent is responsible for fetching data and updating props in response to callbacks.
