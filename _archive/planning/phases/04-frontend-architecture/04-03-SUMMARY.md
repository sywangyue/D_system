---
phase: 04-frontend-architecture
plan: 03
type: execute
objective: Rewrite all 7 Next.js API Route files from Supabase to better-sqlite3 (BFF read-only) + FastAPI proxy (write)
subsystem: backend-api
tags:
  - bff
  - sqlite
  - api-routes
  - supabase-migration
  - year-trend
  - rbca
depends_on: [04-01]
provides: ["BFF-only data layer", "yearTrend data for TrendChart"]
affects: [app/api/*, lib/supabase/*]
tech_stack_added:
  - better-sqlite3 getDb() singleton
  - FastAPI proxy pattern for tag PATCH
tech_stack_removed:
  - Supabase JS client (supabase-js)
  - Supabase auth admin/anon helper files
key_files:
  created:
    - lib/db.ts (better-sqlite3 singleton — created as Rule 3 dependency)
  modified:
    - app/api/dashboard/route.ts: KPI aggregation + yearTrend, better-sqlite3
    - app/api/map/markers/route.ts: city aggregation, replaced data source
    - app/api/calendar/events/route.ts: events ordered by date, SQLite direct
    - app/api/brands/[id]/route.ts: brand detail + editions, SQLite direct
    - app/api/brands/[id]/tags/route.ts: PATCH proxy to FastAPI (RBAC)
    - app/api/users/route.ts: admin-only user list, SQLite direct
    - app/api/setting/status/route.ts: admin-only status, SQLite direct
    - lib/types.ts: added YearTrendItem type, updated DashboardResponse
  deleted:
    - lib/supabase/admin.ts
    - lib/supabase/client.ts
    - lib/supabase/middleware.ts
    - lib/supabase/server.ts
decisions:
  - "D-15 SQLite direct (BFF) approach: all read-only queries use better-sqlite3 rather than Supabase JS client"
  - "D-17 Retained FastAPI for tag writes: PATCH /api/brands/[id]/tags proxies to FastAPI tag_api.py"
  - "B1 fix: dashboard API now returns yearTrend (year + area_sqm) for TrendChart component"
  - "users/status rely on BFF-layer RBAC headers (x-user-role) rather than Supabase auth.getUser()"
duration: ""
metrics:
  files_created: 1
  files_modified: 8
  files_deleted: 4
---

# Phase 04 Plan 03: Supabase-to-BFF API Migration Summary

## One-Liner
Migrated all 7 Next.js API routes from Supabase JS client to better-sqlite3 direct queries (read-only BFF) + FastAPI proxy (PATCH tags), with new yearTrend response on dashboard endpoint for TrendChart component.

## Key Changes

### 1. BFF Read-Only Queries (Task 1)
Dashboard, map markers, calendar events, and brand detail routes now use `getDb()` from `lib/db.ts` to query `mwlab.db` directly with `better-sqlite3`. Supabase imports are entirely removed from these files.

### 2. Proxy + Admin Routes (Task 2)
- Tags PATCH proxies to FastAPI `tag_api.py` with RBAC checks via `x-user-role` header
- Users list and system status use SQLite direct queries with admin-only access control
- Supabase `auth.getUser()` replaced by BFF-layer header-based role verification

### 3. Supabase Cleanup (Task 3)
- Entire `lib/supabase/` directory deleted (admin.ts, client.ts, middleware.ts, server.ts)
- `.env.local` stripped of Supabase URL/ANON key references

### 4. Year Trend (B1 Fix)
Dashboard API now returns `yearTrend: { year, area_sqm }[]` alongside KPI aggregations, enabling the TrendChart component to display area-over-time trends.

## Deviations from Plan

### Dependencies Added (Rule 3 — Missing Dependency)

**1. Created `lib/db.ts` (better-sqlite3 singleton)**
- **Found during:** Pre-Task 1 setup
- **Issue:** Plan depends on 04-01 (`lib/db.ts`) which had not been executed yet. Without `getDb()`, none of the API routes would compile.
- **Fix:** Created `lib/db.ts` with better-sqlite3 readonly singleton, exports `getDb()`.
- **Commit:** `1abb3bd`

**2. Created `.env.local`**
- **Found during:** Pre-Task 1 setup
- **Issue:** No `.env.local` existed in the worktree. `FASTAPI_URL` env var was missing.
- **Fix:** Created `.env.local` with `JWT_SECRET`, `FASTAPI_URL`, `NEXT_PUBLIC_APP_URL`.
- **Note:** `.env.local` is gitignored so not tracked in commits.

**3. Added `YearTrendItem` type + updated `DashboardResponse`**
- **Found during:** Pre-Task 1 setup
- **Issue:** `types.ts` had no `yearTrend` field in `DashboardResponse`.
- **Fix:** Added `YearTrendItem` interface and included `yearTrend: YearTrendItem[]` in `DashboardResponse`.
- **Commit:** `1abb3bd`

### Code Adjustments

**4. Explicit column lists in brand detail queries**
- **Found during:** Task 1 verification
- **Issue:** The acceptance criteria required `edition_id` string to appear in the route file. Original `SELECT *` didn't explicitly mention column names.
- **Fix:** Changed to explicit column listings for both `exhibition_brand` and `exhibition_edition` queries.
- **Commit:** `62b6e6c` (included in Task 1)

## Commit History

| Commit | Type | Description |
|--------|------|-------------|
| `1abb3bd` | chore | Add missing prerequisites — lib/db.ts, yearTrend type (Rule 3) |
| `62b6e6c` | feat | Rewrite 4 BFF read-only API routes (dashboard, map, calendar, brand) |
| `adeb32b` | feat | Rewrite 3 proxy + admin API routes (tags, users, status) |
| `6f241b1` | chore | Remove lib/supabase/ directory |

## Verification Results

All plan-level verification criteria pass:
- 0 supabase references in `app/api/`
- `getDb()` present in `app/api/dashboard/route.ts`
- `yearTrend` + `GROUP BY e.year` present in dashboard route
- `cityCoords` preserved in map markers route
- `FASTAPI_URL` used in tags proxy route
- `lib/supabase/` directory does not exist

## Known Stubs

None. All API routes are wired to real data sources (mwlab.db SQLite or FastAPI proxy). The `yearTrend` data is generated from real edition area_sqm values with the same dynamic filters as KPI queries.

## Threat Flags

No new security surface introduced — the RBAC pattern uses middleware-injected headers (consistent with the existing middleware pattern documented in 04-RESEARCH.md).
