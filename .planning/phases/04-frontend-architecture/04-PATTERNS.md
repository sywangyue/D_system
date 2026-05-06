# Phase 4: Frontend Architecture - Pattern Map

**Mapped:** 2026-05-06
**Files analyzed:** 32 new files
**Analogs found:** 7 with match / 32 total (greenfield project, 25 files are pure frontend with no Python analog)

## File Classification

| New File | Role | Data Flow | Closest Analog | Match Quality |
|----------|------|-----------|----------------|---------------|
| `supabase/migrations/001_init.sql` | migration | DDL | `schema/init_db.sql` | exact (same DDL, SQLite->PostgreSQL) |
| `app/api/brands/[id]/tags/route.ts` | route (API) | CRUD | `tag_api.py` (PATCH /api/brands/{id}/tags) | role-match (same endpoint, TS rewrite) |
| `app/api/brands/[id]/route.ts` | route (API) | CRUD | `tag_api.py` (GET /api/brands/{id}) | role-match (same endpoint, TS rewrite) |
| `app/api/dashboard/route.ts` | route (API) | CRUD | `tag_api.py` (query patterns) | partial (different endpoint, same DB query style) |
| `app/api/users/route.ts` | route (API) | CRUD | none | no analog |
| `middleware.ts` | middleware | request-response | none | no analog (Supabase auth pattern from RESEARCH.md) |
| `lib/supabase/client.ts` | utility | request-response | none | no analog (Supabase SDK pattern) |
| `lib/supabase/server.ts` | utility | request-response | none | no analog (Supabase SDK pattern) |
| `lib/types.ts` | utility | initiation | none | no analog (auto-generated from Supabase) |
| `scripts/seed-users.ts` | script | batch | none | no analog (Supabase admin API pattern) |
| `app/layout.tsx` | component (layout) | request-response | none | no analog (greenfield frontend) |
| `app/page.tsx` | component (page) | request-response | none | no analog |
| `app/login/page.tsx` | component (page) | request-response | none | no analog |
| `app/dashboard/page.tsx` | component (page) | CRUD | none | no analog |
| `app/calendar/page.tsx` | component (page) | request-response | none | no analog |
| `app/map/page.tsx` | component (page) | request-response | none | no analog |
| `app/setting/page.tsx` | component (page) | CRUD | none | no analog |
| `components/Sidebar.tsx` | component | request-response | none | no analog |
| `components/KpiCard.tsx` | component | request-response | none | no analog |
| `components/FilterTabs.tsx` | component | request-response | none | no analog |
| `components/IndustryPieChart.tsx` | component | request-response | none | no analog |
| `components/CalendarView.tsx` | component | request-response (client) | none | no analog |
| `components/MapView.tsx` | component | request-response (client) | none | no analog |
| `tests/api/tags.test.ts` | test | unit | `tests/test_tag_api.py` | role-match (same API tested, Vitest vs unittest) |
| `tests/api/dashboard.test.ts` | test | unit | none | no analog |
| `tests/middleware.test.ts` | test | integration | none | no analog |

## Pattern Assignments

### `supabase/migrations/001_init.sql` (migration, DDL)

**Analog:** `schema/init_db.sql` (lines 1-147)

**Imports/Schema pattern:** No imports — raw SQL DDL file.

**Core DDL pattern** (lines 9-36):
```sql
-- SQLite source: schema/init_db.sql
CREATE TABLE IF NOT EXISTS exhibition_brand (
    brand_id              TEXT    PRIMARY KEY,
    name_cn               TEXT    NOT NULL,
    name_en               TEXT    NOT NULL DEFAULT '',
    first_year            INTEGER,
    organizer             TEXT    NOT NULL DEFAULT '',
    ...
    created_at            TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
```

**Conversion rules** (from RESEARCH.md SQLite-to-PostgreSQL table):
- `TEXT PRIMARY KEY` -> keep `TEXT PRIMARY KEY`
- `INTEGER PRIMARY KEY AUTOINCREMENT` -> `BIGSERIAL PRIMARY KEY` (crawl_log.id, manual_tag_history.id)
- `datetime('now', 'localtime')` -> `NOW()`
- `REAL` -> `DOUBLE PRECISION`
- `INTEGER` -> `INTEGER` or `BIGINT`
- Remove `PRAGMA foreign_keys = ON` and `PRAGMA journal_mode = WAL`
- `TEXT` for dates -> `DATE` type preferred (date_start, date_end)

**Key migration decisions** (from RESEARCH.md):
- `user` table from SQLite -> **do NOT migrate**. Supabase Auth `auth.users` replaces it.
- Role stored in `app_metadata.role` (not `user_metadata`)
- 5 tables migrate: exhibition_brand, exhibition_edition, data_provenance, crawl_log, manual_tag_history

---

### `app/api/brands/[id]/tags/route.ts` (route, CRUD)

**Analog:** `tag_api.py` lines 161-209 (PATCH handler logic)

**Core tagging business logic to port:**
```python
# Source: tag_api.py lines 161-209 — PATCH /api/brands/{brand_id}/tags
@app.patch("/api/brands/{brand_id}/tags")
def update_tag(
    brand_id: str,
    body: TagUpdate,
    conn: sqlite3.Connection = Depends(get_db),
):
    # 1. Brand existence check
    row = conn.execute(
        "SELECT * FROM exhibition_brand WHERE brand_id = ?", (brand_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail=f"品牌不存在: {brand_id}")

    # 2. Validate field name against TAGGABLE_FIELDS whitelist
    ok, err = validate_value(body.field_name, body.new_value)
    if not ok:
        raise HTTPException(status_code=422, detail=err)

    brand = dict(row)
    old_value = str(brand.get(body.field_name, '') or '')
    new_value = str(body.new_value)

    # 3. Update main table
    conn.execute(
        f"UPDATE exhibition_brand SET {body.field_name} = ?, updated_at = datetime('now','localtime') "
        f"WHERE brand_id = ?",
        (body.new_value, brand_id)
    )

    # 4. Record history
    conn.execute(
        """INSERT INTO manual_tag_history
            (brand_id, field_name, old_value, new_value, changed_by, reason)
        VALUES (?,?,?,?,?,?)""",
        (brand_id, body.field_name, old_value, new_value,
         body.changed_by, body.reason or '')
    )
    conn.commit()
```

**TAGGABLE_FIELDS whitelist** (tag_api.py lines 29-47) — port to TypeScript:
```python
TAGGABLE_FIELDS: dict[str, type] = {
    "competition_relation":  str,
    "mds_related":           str,
    "scale_score":           int,   # 1-10
    "is_international":      int,   # 0/1
    "is_ufi_certified":      int,   # 0/1
    "ma_potential":          int,   # 1-5
    "strategic_relevance":   int,   # 1-5
    "competitor_group":      str,
    "industry_l1":           str,
    "industry_l2":           str,
    "notes":                 str,
    "first_year":            int,
    "organizer":             str,
    "co_organizer":          str,
    "city":                  str,
    "frequency":             str,
    "website":               str,
}
```

**Validation rules** (tag_api.py lines 103-135) — port to TypeScript:
```python
_ENUM_CONSTRAINTS: dict[str, set] = {
    "competition_relation": {'是', '否', ''},
    "status":               {'已举办', '即将举办', '取消', '延期', ''},
}
_INT_RANGE_CONSTRAINTS: dict[str, tuple[int, int]] = {
    "scale_score":         (1, 10),
    "ma_potential":        (1, 5),
    "strategic_relevance": (1, 5),
    "is_international":    (0, 1),
    "is_ufi_certified":    (0, 1),
}
```

**Next.js API Route pattern** (from RESEARCH.md lines 663-701):
```typescript
// Source: RESEARCH.md — Dashboard API Route template
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  
  // 1. Auth check — verified by middleware, but also verify
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  
  const role = user.app_metadata?.role
  if (!['admin', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { brand_id } = params
    
    // ... business logic ported from tag_api.py
    
    return NextResponse.json({ brand_id, field_name, old_value, new_value })
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

---

### `app/api/dashboard/route.ts` (route, CRUD)

**Analog:** `tag_api.py` lines 146-158 (query patterns). No direct dashboard analog exists — business logic is new.

**Core pattern** (from RESEARCH.md lines 663-701):
```typescript
// Source: RESEARCH.md — Dashboard API Route
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const industry_l2 = searchParams.get('industry_l2')
  const relation = searchParams.get('relation')
  const mds = searchParams.get('mds')

  const supabase = await createClient()

  let query = supabase
    .from('exhibition_brand')
    .select(`
      brand_id, name_cn, organizer, competition_relation, mds_related,
      industry_l1, industry_l2,
      exhibition_edition!inner(area_sqm, exhibitors_count, visitors_count, yoy_trend, year)
    `)

  if (industry_l2) query = query.eq('industry_l2', industry_l2)
  if (relation && relation !== '全部') query = query.eq('competition_relation', relation)
  if (mds && mds !== '全部') query = query.eq('mds_related', mds)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const kpi = {
    area_sqm: data.reduce((s, b) => s + (b.exhibition_edition?.[0]?.area_sqm ?? 0), 0),
    exhibitors_count: data.reduce((s, b) => s + (b.exhibition_edition?.[0]?.exhibitors_count ?? 0), 0),
    visitors_count: data.reduce((s, b) => s + (b.exhibition_edition?.[0]?.visitors_count ?? 0), 0),
    organizer_count: new Set(data.map(b => b.organizer).filter(Boolean)).size,
  }

  return NextResponse.json({ brands: data, kpi })
}
```

**Three filter params** (PRD SS5, mapped to URL search params):
- `industry_l2` — single-select, drives multi-select joins
- `competition_relation` — multi-select: 全部/竞争对手/潜在伙伴/新进入者
- `mds_related` — single-select: 全部/MFC/Reha China/无

**Data priority rule** (from AGENTS.md) — apply in aggregation:
> 展商数/观众数/面积 — 取较大值 when multiple editions exist

---

### `tests/api/tags.test.ts` (test, unit)

**Analog:** `tests/test_tag_api.py` (lines 1-252)

**Test pattern — Vitest equivalent of FastAPI TestClient pattern:**
```typescript
// Source concept: tests/test_tag_api.py — FastAPI test patterns to port to Vitest
```

**Test cases to port** (tag_api.py test coverage):
| Test | tag_api.py line | What to test |
|------|----------------|--------------|
| valid tag PATCH | line 92 | 200 + correct response |
| updates brand table | line 105 | Verify DB write |
| invalid field_name | line 115 | 422 |
| invalid enum value | line 123 | 422 |
| out of range integer | line 131 | 422 |
| brand not found | line 139 | 404 |
| invalid email | line 147 | 422 |
| null new_value | line 155 | 422 |
| tag history recorded | line 164 | Verify manual_tag_history |
| history filter by field | line 177 | Query param filter |
| multiple patches chain | line 198 | History chain integrity |
| old_value tracking | line 235 | Correct before/after |

**Vitest pattern** (no existing analog, based on RESEARCH.md):
```typescript
// Expected test pattern (no analog in codebase)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('PATCH /api/brands/[id]/tags', () => {
  it('should update field and return new value', async () => {
    const res = await fetch('http://localhost:3000/api/brands/EXPO-0001/tags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        field_name: 'competition_relation',
        new_value: '是',
        changed_by: 'admin@mwlab.com',
      }),
    })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.new_value).toBe('是')
  })
})
```

---

## Shared Patterns

### Supabase Auth Middleware
**Source:** RESEARCH.md lines 246-294 (canonical Supabase pattern)
**Apply to:** All API Routes and page routes via middleware.ts

```typescript
// RESEARCH.md — middleware.ts (complete, use as-is)
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  // MUST use getUser() not getSession() for security
  const { data: { user } } = await supabase.auth.getUser()

  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (request.nextUrl.pathname.startsWith('/setting')) {
    const role = user?.app_metadata?.role
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)'],
}
```

### Supabase Server Client (API Routes / Server Components)
**Source:** RESEARCH.md lines 298-321
**Apply to:** All API Routes

```typescript
// lib/supabase/server.ts — use as-is
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options))
        },
      },
    }
  )
}
```

### Supabase Browser Client (Client Components)
**Source:** Supabase SSR docs
**Apply to:** Dashboard, Calendar, Map, Login pages

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### Leaflet / react-leaflet Dynamic Import
**Source:** RESEARCH.md lines 326-344
**Apply to:** `app/map/page.tsx` + `components/MapView.tsx`

```typescript
// app/map/page.tsx — dynamic import with ssr:false
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-xl" />,
})

export default function MapPage() {
  return <MapView />
}

// components/MapView.tsx — "use client"
'use client'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
```

### react-big-calendar Dynamic Import
**Source:** RESEARCH.md lines 138-139, 543
**Apply to:** `app/calendar/page.tsx` + `components/CalendarView.tsx`

```typescript
// app/calendar/page.tsx
import dynamic from 'next/dynamic'

const CalendarView = dynamic(() => import('@/components/CalendarView'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-xl" />,
})
```

```typescript
// components/CalendarView.tsx — "use client"
'use client'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { Calendar, dateFnsLocalizer } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay } from 'date-fns'
```

### Seed Users Script
**Source:** RESEARCH.md lines 348-374
**Apply to:** `scripts/seed-users.ts`

```typescript
// scripts/seed-users.ts — use as-is
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const users = [
  { email: 'admin@mwlab.internal', password: process.env.ADMIN_PASSWORD!, role: 'admin' },
  // ... 30 users
]

for (const u of users) {
  const { error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,
    app_metadata: { role: u.role },
  })
  if (error) console.error(`Failed: ${u.email}`, error.message)
  else console.log(`Created: ${u.email} [${u.role}]`)
}
```

### OpenNext Cloudflare Workers Configuration
**Source:** RESEARCH.md lines 377-396
**Apply to:** `wrangler.jsonc`, `open-next.config.ts`, `package.json` scripts

```jsonc
// wrangler.jsonc
{
  "name": "mwlab-dashboard",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-04-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": ".open-next/assets"
  }
}
```

```typescript
// open-next.config.ts
import { defineCloudflareConfig } from '@opennextjs/cloudflare'
export default defineCloudflareConfig()
```

### Supabase RLS Policies
**Source:** RESEARCH.md lines 483-504
**Apply to:** After `001_init.sql` migration

```sql
-- RLS policy template
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- exhibition_brand: all authenticated users can read
CREATE POLICY "authenticated_read" ON exhibition_brand
  FOR SELECT TO authenticated USING (true);

-- exhibition_brand: only admin/manager can write
CREATE POLICY "manager_write" ON exhibition_brand
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- crawl_log: read-only
CREATE POLICY "readonly_crawl_log" ON crawl_log
  FOR SELECT TO authenticated USING (true);
```

### Error Handling Pattern (API Routes)
**Apply to:** All API route files

```typescript
// Consistent error handling pattern
try {
  // ... business logic
  return NextResponse.json({ data: result })
} catch (err) {
  const message = (err as Error).message
  // Determine status code by error type
  if (message.includes('not found') || message.includes('不存在')) {
    return NextResponse.json({ error: message }, { status: 404 })
  }
  if (message.includes('invalid') || message.includes('Validation')) {
    return NextResponse.json({ error: message }, { status: 422 })
  }
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

---

## No Analog Found

These files have no close match in the existing Python/FastAPI codebase. Planners should use patterns from RESEARCH.md:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `app/layout.tsx` | component (layout) | request-response | Greenfield frontend — no existing UI code |
| `app/login/page.tsx` | component (page) | request-response | Supabase Auth — no existing login UI |
| `app/dashboard/page.tsx` | component (page) | CRUD | Greenfield frontend — no existing dashboard |
| `app/calendar/page.tsx` | component (page) | request-response | New feature — no calendar in existing code |
| `app/map/page.tsx` | component (page) | request-response | New feature — no map in existing code |
| `app/setting/page.tsx` | component (page) | CRUD | New feature — admin panel |
| `components/Sidebar.tsx` | component | request-response | Greenfield frontend |
| `components/KpiCard.tsx` | component | request-response | Greenfield frontend — Hirezy style reference |
| `components/FilterTabs.tsx` | component | request-response | New — 3-tier filter UI |
| `components/IndustryPieChart.tsx` | component | request-response | New — chart visualization |
| `scripts/seed-users.ts` | script | batch | Supabase admin API — no existing seed script |
| `tests/middleware.test.ts` | test | integration | No existing middleware tests |
| `tests/api/dashboard.test.ts` | test | unit | No existing dashboard API tests |

For these files, use patterns from:
- **RESEARCH.md** Standard Stack section for library usage
- **RESEARCH.md** Architecture Patterns section for Next.js App Router structure
- **Claude Design** output for Tailwind config, color tokens, component specs
- **Hirezy dashboard reference** (`dashboard_references.png`) for UI layout

---

## Metadata

**Analog search scope:** `/Volumes/databoard/AI Project/D_dashboard/` (Python/FastAPI codebase)
**Files scanned:** tag_api.py, schema/init_db.sql, tests/test_tag_api.py, tests/conftest.py, tools/export_for_tagging.py, tools/import_tags.py

**Key caveats:**
- This is a **greenfield project** — most files have no existing analog in the Python codebase
- The Python codebase provides analogs for **business logic** (tagging API, DDL) and **test structure**, but NOT for frontend UI components
- All UI component files (Sidebar, KpiCard, FilterTabs, pages) should use patterns from RESEARCH.md Architecture Patterns section and the Claude Design UI spec
- RESEARCH.md contains complete, ready-to-copy code for: middleware.ts, lib/supabase/server.ts, lib/supabase/client.ts, scripts/seed-users.ts, wrangler.jsonc, open-next.config.ts, RLS policies
