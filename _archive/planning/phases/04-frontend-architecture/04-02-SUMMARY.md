---
phase: 04-frontend-architecture
plan: 02
type: execute
subsystem: frontend-auth
tags: [jwt, middleware, auth, sidebar, types]
requires: [04-01]
affects: [middleware.ts, app/page.tsx, components/layout, lib/types.ts, lib/auth.ts]
tech-stack:
  added: [jose@6.2.3]
  patterns: [JWT cookie auth, localStorage client auth, Edge Runtime compatible JWTs]
key-files:
  created: [lib/auth.ts]
  modified: [middleware.ts, app/page.tsx, components/layout/Sidebar.tsx, lib/types.ts]
decisions:
  - "jose over jsonwebtoken — Edge Runtime compatibility for Next.js middleware"
  - "localStorage user_info + document.cookie clear for client-side auth instead of Supabase Auth client"
metrics:
  duration: null
  completed: 2026-05-08
---

# Phase 4 Plan 2: JWT Migration + Middleware Rewrite Summary

Remove Supabase Auth from frontend routing and layout. Replace with JWT cookie-based auth using jose library, add `lib/auth.ts` client utility, and update Sidebar to use MD branding with lucide-react icons.

**One-liner:** JWT cookie auth migration from Supabase — middleware route guard, root page redirect, Sidebar client auth, type cleanup.

## What Was Built

### Task 1 — jose + middleware.ts rewrite
- Installed `jose` (Edge Runtime compatible JWT library, v6.2.3)
- Rewrote `middleware.ts` to verify `session` cookie with `jwtVerify` instead of calling Supabase `updateSession`
- Public path allowlist: `/login`, `/_next`, `/api/auth`, static assets
- Inject `x-user-email` and `x-user-role` request headers for API Routes
- Admin-only guard: `/setting` route requires `role === 'admin'`
- Invalid/expired token redirects to `/login`
- Added `JWT_SECRET` to `.env.local` (gitignored, not committed)

### Task 2 — page.tsx, Sidebar.tsx, AppShell.tsx migration + lib/auth.ts creation
- **`app/page.tsx`**: Root path now reads session cookie via `cookies()` + `jwtVerify` and redirects to `/dashboard` or `/login`
- **`components/layout/Sidebar.tsx`**: Replaced Supabase auth with `lib/auth` (`getUserInfo`, `clearAuth`), replaced SVG icon references with lucide-react components (`LayoutDashboard`, `Calendar`, `Map`, `Settings`, `LogOut`)
- **`lib/auth.ts`** (created): Client-side auth utility — `getUserInfo()` reads from `localStorage('user_info')`, `clearAuth()` removes localStorage key and session cookie, redirects to `/login`
- **`AppShell.tsx`**: Unchanged (already clean, no Supabase references)

### Task 3 — lib/types.ts cleanup
- Removed `Database` generic type, `TableRelationship` interface, Supabase helper comment blocks
- Preserved all data row interfaces (Brand, Edition, DataProvenance, CrawlLog, ManualTagHistory) and API types (KpiData, DashboardResponse, ApiError, TagUpdateRequest, TAG_FIELDS)

## Deviations from Plan

### Rule 3 — Missing dependency: lib/auth.ts

**Issue:** Plan references `lib/auth.ts` from "04-01 Task 2", but the file does not exist. Without it, `Sidebar.tsx` cannot import `getUserInfo` and `clearAuth`.

**Fix:** Created `lib/auth.ts` with:
- `getUserInfo()` — reads JWT user payload from `localStorage('user_info')`, returns `{ userEmail, isAdmin }`
- `clearAuth()` — removes localStorage key, expires session cookie, redirects to `/login`

**Files modified:** `lib/auth.ts` (new file)

**Commit:** b94c243

## Key Technical Decisions

1. **jose over jsonwebtoken**: jose is Edge Runtime compatible, required by Next.js middleware. jsonwebtoken uses Node.js APIs not available in Edge Runtime.
2. **localStorage for client auth state**: Login page stores decoded JWT payload in `localStorage('user_info')`; `getUserInfo()` reads it synchronously with `useState(() => ...)` initializer to avoid flash-of-unauthorized-content.
3. **Cookie name "session"**: Consistent with standard JWT cookie naming; middleware checks `request.cookies.get('session')`.

## Commits

| Commit | Message |
|--------|---------|
| 964bc5b | `feat(04-02): rewrite middleware.ts — JWT cookie route guard with jose` |
| b94c243 | `feat(04-02): migrate page.tsx, Sidebar.tsx to JWT auth — create lib/auth.ts` |
| 2382048 | `refactor(04-02): remove Supabase Database type and TableRelationship from types.ts` |

## Self-Check

### Created/Modified Files

- `/Volumes/databoard/AI Project/D_dashboard/middleware.ts` — rewritten (jwtVerify, session cookie, admin guard)
- `/Volumes/databoard/AI Project/D_dashboard/app/page.tsx` — rewritten (cookies() + jose redirect)
- `/Volumes/databoard/AI Project/D_dashboard/components/layout/Sidebar.tsx` — rewritten (lib/auth, lucide icons)
- `/Volumes/databoard/AI Project/D_dashboard/lib/auth.ts` — created (getUserInfo, clearAuth)
- `/Volumes/databoard/AI Project/D_dashboard/lib/types.ts` — modified (removed Supabase types)
- `/Volumes/databoard/AI Project/D_dashboard/package.json` — modified (jose added)
- `/Volumes/databoard/AI Project/D_dashboard/package-lock.json` — modified (jose lockfile)
- `/Volumes/databoard/AI Project/D_dashboard/.env.local` — modified (JWT_SECRET added)

### Verification

| Check | Status |
|-------|--------|
| middleware.ts: supabase refs = 0 | PASS (0) |
| middleware.ts: jwtVerify present | PASS |
| middleware.ts: session cookie | PASS |
| middleware.ts: x-user-role header | PASS |
| middleware.ts: /setting admin guard | PASS |
| page.tsx: supabase refs = 0 | PASS (0) |
| page.tsx: jose/jwtVerify present | PASS |
| Sidebar.tsx: supabase refs = 0 | PASS (0) |
| Sidebar.tsx: getUserInfo/lib/auth | PASS |
| Sidebar.tsx: clearAuth | PASS |
| Sidebar.tsx: lucide-react icons | PASS |
| AppShell.tsx: supabase refs = 0 | PASS (0) |
| AppShell.tsx: login skips sidebar | PASS |
| types.ts: interface Brand preserved | PASS |
| types.ts: interface KpiData preserved | PASS |
| types.ts: TableRelationship removed | PASS (0) |
| types.ts: type Database removed | PASS (0) |
| types.ts: Supabase refs = 0 | PASS (0) |
| types.ts: TAG_FIELDS preserved | PASS |
| jose installed | PASS (v6.2.3) |

## Self-Check: PASSED
