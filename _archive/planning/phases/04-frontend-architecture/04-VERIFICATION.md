---
phase: 04-frontend-architecture
verified: 2026-05-08T15:37:00Z
status: human_needed
score: 15/15 must-haves verified
overrides_applied: 0
re_verification: false
---

# Phase 4: Frontend Architecture Verification Report

**Phase Goal:** 实现 MD Corporate Design 品牌规范的 4 层 Dashboard + 简化 Leaflet 地图 + 日历 + 设置；FastAPI JWT 认证（替代 Supabase）；SQLite BFF 直连（替代 PostgreSQL）；科技感 UI + 真实 mwlab.db 数据验证。

**Verified:** 2026-05-08T15:37:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| #   | Truth   | Status     | Evidence       |
| --- | ------- | ---------- | -------------- |
| 1   | FastAPI auth_api.py 提供 JWT login/verify/users 端点 | ✓ VERIFIED | auth_api.py (178 lines): POST /api/auth/login, GET /api/auth/verify, GET /api/auth/users; bcrypt + PyJWT; CORSMiddleware |
| 2   | lib/db.ts 提供 better-sqlite3 readonly 单例 | ✓ VERIFIED | lib/db.ts (16 lines): getDb() with readonly + fileMustExist + WAL pragma |
| 3   | lib/auth.ts 提供 saveAuth, getUserInfo, getAuthState, clearAuth, isAuthenticated | ✓ VERIFIED | lib/auth.ts (57 lines): 6 exports, localStorage-based, session cookie management |
| 4   | middleware.ts 使用 jose JWT Cookie 路由守卫（非 Supabase） | ✓ VERIFIED | middleware.ts (52 lines): jwtVerify from 'jose', session cookie, x-user-email/x-user-role headers, /setting admin-only guard |
| 5   | 无 Supabase 引用残留于 app/ components/ lib/ | ✓ VERIFIED | grep -rn "supabase" → 0 matches in all three directories |
| 6   | 无 #22C55E / #16A34A 绿色残留于 app/ components/ | ✓ VERIFIED | grep -rn "#22C55E\|#16A34A" → 0 matches |
| 7   | 所有 7 个 API routes 使用 better-sqlite3 (getDb) 非 Supabase | ✓ VERIFIED | All routes: 0 supabase refs, getDb() used in 6/7 (tags route proxies to FastAPI) |
| 8   | Dashboard API 新增 yearTrend 年比趋势响应 (B1 fix) | ✓ VERIFIED | route.ts: yearTrend query with GROUP BY e.year ORDER BY e.year; YearTrendItem type in types.ts |
| 9   | MD 品牌色板应用于 globals.css (--color-md-orange, #fe5c00) | ✓ VERIFIED | globals.css: @theme with --color-md-orange: #fe5c00 + 10 MD tokens, semantic --color-accent mapping, glass-card, kpi-value |
| 10  | KpiCard / TrendBadge / FilterTabs / PieChart 使用 MD Orange | ✓ VERIFIED | KpiCard: rgba(254,92,0,0.12) hover; TrendBadge: var(--color-md-orange-dark); FilterTabs: accent-dark (no green-700); PieChart: MD palette [#fe5c00, #e60070, #ff8c00] |
| 11  | 4 层 Dashboard 导航: LayerTabs (概览/分析/地理/明细) + SubTabs | ✓ VERIFIED | LayerTabs.tsx with 4 layers + lucide icons; SubTabs.tsx with 4 tab arrays (4+5+5+4) |
| 12  | TrendChart 接收 API yearTrend 数据 (B1 fix) | ✓ VERIFIED | dashboard-content.tsx L302: `<TrendChart data={data?.yearTrend ?? []}>` ; TrendChart.tsx: recharts BarChart with #fe5c00 fill |
| 13  | 登录页使用 FastAPI JWT (saveAuth + cookie) | ✓ VERIFIED | login/page.tsx: fetch to FASTAPI_URL/api/auth/login, saveAuth() + document.cookie='session=...' |
| 14  | 日历/地图/设置页使用 MD 品牌色 + JWT 认证 | ✓ VERIFIED | Calendar: #fff3ec/#fe5c00; Map: #fe5c00/#e55300 (no blue); Setting: 0 supabase, getUserInfo |
| 15  | 构建成功 + 38/38 测试通过 | ✓ VERIFIED | `npm run build`: SUCCESS (all routes, pages); `npm test`: 8 files, 38 tests, all PASS |

**Score:** 15/15 truths verified

### Required Artifacts

| Artifact | Expected    | Status | Details |
| -------- | ----------- | ------ | ------- |
| `auth_api.py` | JWT login/verify FastAPI | ✓ VERIFIED | 178 lines, 3 endpoints, bcrypt+PyJWT |
| `lib/db.ts` | better-sqlite3 singleton | ✓ VERIFIED | getDb(), readonly, WAL |
| `lib/auth.ts` | Client auth helpers (6 exports) | ✓ VERIFIED | saveAuth, getUserInfo, getAuthState, getToken, clearAuth, isAuthenticated |
| `middleware.ts` | jose JWT cookie guard | ✓ VERIFIED | jwtVerify, session cookie, admin guard |
| `app/api/dashboard/route.ts` | BFF KPI aggregation + yearTrend | ✓ VERIFIED | 4 queries: KPI, brands, industryDist, yearTrend |
| `app/api/map/markers/route.ts` | City aggregation | ✓ VERIFIED | better-sqlite3, cityCoords preserved |
| `app/api/calendar/events/route.ts` | Calendar events | ✓ VERIFIED | better-sqlite3 |
| `app/api/brands/[id]/route.ts` | Brand detail | ✓ VERIFIED | better-sqlite3 |
| `app/api/brands/[id]/tags/route.ts` | FastAPI PATCH proxy | ✓ VERIFIED | fetch(FASTAPI_URL), RBAC |
| `app/api/users/route.ts` | User list (admin) | ✓ VERIFIED | better-sqlite3, admin check |
| `app/api/setting/status/route.ts` | System status | ✓ VERIFIED | better-sqlite3, crawl_log |
| `app/globals.css` | MD design tokens | ✓ VERIFIED | @theme with --color-md-*, glass-card, kpi-value |
| `app/layout.tsx` | MD root layout | ✓ VERIFIED | Inter font, "MWLAB 2026 \| 竞争盘面看板" |
| `app/page.tsx` | Root redirect | ✓ VERIFIED | cookies()+jose → /dashboard or /login |
| `app/login/page.tsx` | JWT login page | ✓ VERIFIED | saveAuth + cookie, 0 supabase |
| `app/dashboard/dashboard-content.tsx` | 4-layer controller | ✓ VERIFIED | activeLayer, activeSub, yearTrend data pipe |
| `components/layout/Sidebar.tsx` | MD sidebar | ✓ VERIFIED | getUserInfo, clearAuth, lucide icons |
| `components/layout/AppShell.tsx` | App shell | ✓ VERIFIED | 0 supabase, login skips sidebar |
| `components/dashboard/LayerTabs.tsx` | 4-layer tab switcher | ✓ VERIFIED | overview/analysis/geo/detail + lucide icons |
| `components/dashboard/SubTabs.tsx` | Per-layer sub-tab switcher | ✓ VERIFIED | 4 tab arrays (4+5+5+4), pill style |
| `components/dashboard/KpiCardRow.tsx` | KPI card grid | ✓ VERIFIED | 4 KpiCard instances (area/exhibitors/visitors/organizers) |
| `components/dashboard/TrendChart.tsx` | Year trend chart | ✓ VERIFIED | recharts BarChart, #fe5c00 fill, skeleton+empty states |
| `components/dashboard/BrandTable.tsx` | Brand list table | ✓ VERIFIED | competition_relation capsules, MDS badges |
| `components/ui/KpiCard.tsx` | MD orange KPI card | ✓ VERIFIED | rgba(254,92,0,0.12) hover, kpi-value class |
| `components/ui/TrendBadge.tsx` | MD trend badge | ✓ VERIFIED | var(--color-md-orange-dark) up, var(--color-md-red) down |
| `components/ui/FilterTabs.tsx` | MD orange pills | ✓ VERIFIED | accent-dark selected, 0 text-green-700 |
| `components/charts/IndustryPieChart.tsx` | MD palette chart | ✓ VERIFIED | #fe5c00, #e60070, #ff8c00 palette |
| `components/map/Legend.tsx` | MD orange legend | ✓ VERIFIED | #fe5c00 domestic, #ff8c00 international |
| `lib/types.ts` | Cleaned types | ✓ VERIFIED | Brand, KpiData, TAG_FIELDS, YearTrendItem; 0 Database/TableRelationship/Supabase |
| `scripts/seed_db_users.py` | User seed script | ✓ VERIFIED | 3 users (admin/manager/readonly) with bcrypt |
| `.planning/phases/04-frontend-architecture/04-VALIDATION.md` | Validation doc | ✓ VERIFIED | KPI accuracy, filter linkage, residuals all green |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| middleware.ts | session cookie | jose jwtVerify | ✓ WIRED | `jwtVerify(token, JWT_SECRET)` with HS256 |
| Sidebar.tsx | lib/auth.ts | getUserInfo() + clearAuth() | ✓ WIRED | Import + usage confirmed |
| All API routes | lib/db.ts | getDb() → better-sqlite3 | ✓ WIRED | All 6 read routes import getDb |
| tags/route.ts | tag_api.py | fetch(FASTAPI_URL) | ✓ WIRED | PATCH proxy with RBAC check |
| dashboard-content.tsx | /api/dashboard | fetch() with filter params | ✓ WIRED | URLSearchParams → API → DashboardResponse |
| dashboard-content.tsx | TrendChart.tsx | data?.yearTrend prop | ✓ WIRED | B1 fix: yearTrend passed as data prop |
| login/page.tsx | auth_api.py | POST /api/auth/login | ✓ WIRED | fetch to FASTAPI_URL, saveAuth + cookie |
| globals.css | layout.tsx | --font-inter variable | ✓ WIRED | Inter font via @theme + html class |
| KpiCard.tsx | globals.css | theme() / var(--color-*) | ✓ WIRED | bg-accent-surface, text-accent-dark, kpi-value |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| dashboard-content.tsx | data (DashboardResponse) | GET /api/dashboard | Yes (SQL aggregation on mwlab.db) | ✓ FLOWING |
| dashboard-content.tsx → TrendChart | data?.yearTrend | Dashboard API yearTrend query | Yes (GROUP BY e.year) | ✓ FLOWING |
| dashboard-content.tsx → KpiCardRow | data?.kpis | Dashboard API KPI aggregation | Yes (SUM/COUNT on real tables) | ✓ FLOWING |
| map-content.tsx | markers | GET /api/map/markers | Yes (city aggregation from mwlab.db) | ✓ FLOWING |
| calendar-content.tsx | events | GET /api/calendar/events | Yes (edition join brand query) | ✓ FLOWING |
| setting-content.tsx | users + status | GET /api/users + /api/setting/status | Yes (user table + crawl_log) | ✓ FLOWING |
| login/page.tsx | auth token | POST auth_api.py:/api/auth/login | Yes (bcrypt verify + JWT sign) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Python deps importable | `python3 -c "import jwt; import bcrypt; print('OK')"` | OK | ✓ PASS |
| auth_api.py importable | `python3 -c "from auth_api import app; print('OK')"` | OK | ✓ PASS |
| jose installed | `npm ls jose` | jose@6.2.3 | ✓ PASS |
| Build succeeds | `npm run build` | All routes/pages compiled | ✓ PASS |
| Tests passing | `npm test` | 38/38 tests PASS | ✓ PASS |
| 0 Supabase refs | `grep -rn "supabase" app/ lib/ components/` | 0 matches | ✓ PASS |
| 0 #22C55E green | `grep -rn "#22C55E" app/ components/` | 0 matches | ✓ PASS |
| 0 edge runtime in API | `grep -rn "runtime.*edge" app/api/` | 0 matches | ✓ PASS |
| lib/supabase/ deleted | `ls lib/supabase/` | No such directory | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| UI-POOL | All 7 plans | Full frontend migration (Supabase→JWT, green→MD orange, 4-layer dashboard, SQLite BFF) | ✓ SATISFIED | All 15 truths verified, 38/38 tests pass, build succeeds |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `app/setting/setting-content.tsx` | 39 | `bg-green-100 text-green-800` for active-user status | ⚠️ Warning | Semantic UX color (not Hirezy green #22C55E). Acknowledged in 04-07 SUMMARY as intentional. Does not affect MD brand compliance. |
| `.env.local` | 5-7 | Supabase keys retained | ℹ️ Info | Keys kept with comment "保留用于脚本兼容，前端不再使用". No code references these vars. Not a functional issue. |
| `middleware.ts` vs `auth_api.py` | 5, 35 | JWT_SECRET fallback mismatch | ⚠️ Warning | middleware defaults to "mwlab-dev-secret-2026" (21B), auth_api defaults to "...-with-extra-length" (34B). Mitigated: .env.local sets JWT_SECRET so both use same value at runtime. |

### Human Verification Required

#### H1: Login Flow End-to-End
**Test:** Start `uvicorn auth_api:app --port 8000` and `npm run dev`, then navigate to http://localhost:3000/login. Login with admin@mwlab.internal / admin123.
**Expected:** Redirect to /dashboard, session cookie set, Sidebar shows user email, logout works.
**Why human:** Requires running services + browser interaction.

#### H2: 4-Layer Dashboard Navigation
**Test:** Navigate between 4 layers (概览/分析/地理/明细) and their sub-tabs. Verify data loads for each tab.
**Expected:** LayerTabs switch layers, SubTabs switch content. 概览-总览 shows KPI cards + pie chart. 概览-趋势 shows TrendChart with real data. 地理-城市分布 shows map with MD orange markers. 明细-品牌列表 shows brand table.
**Why human:** Visual verification of tab switching, data rendering, and loading states.

#### H3: MD Brand Visual Appearance
**Test:** Verify the overall look matches MD Corporate Design specifications.
**Expected:** MD Orange (#fe5c00) accent throughout. Inter + Arial fonts. Glass-morphism cards. No Hirezy green visible anywhere.
**Why human:** Visual design quality cannot be verified programmatically.

#### H4: Map Markers (MD Orange)
**Test:** Navigate to /map (or 地理 layer in dashboard).
**Expected:** Domestic city markers use MD Orange (#fe5c00), international use MD Light Orange (#ff8c00). No blue markers. Popup shows exhibition list on click.
**Why human:** Map rendering requires browser + Leaflet initialization.

#### H5: Calendar Event Styles
**Test:** Navigate to /calendar.
**Expected:** "潜在伙伴" events use MD Orange border/background (#fff3ec/#fe5c00). "竞争对手" events use semantic red. No green event styles.
**Why human:** React-big-calendar rendering requires browser.

#### H6: TrendChart Visual
**Test:** Navigate to 概览-趋势 sub-tab in dashboard.
**Expected:** Bar chart renders with MD Orange bars (#fe5c00). X-axis shows years, Y-axis shows area in ㎡. Tooltip shows year + area on hover.
**Why human:** recharts rendering requires browser for visual verification.

### Warnings Summary

| #   | Warning | Severity | Detail |
| --- | ------- | -------- | ------ |
| W1  | .env.local missing FASTAPI_URL / NEXT_PUBLIC_APP_URL | ⚠️ Warning | Login page falls back to `http://localhost:8000`. Works in dev but should be explicitly configured. |
| W2  | JWT_SECRET fallback differs between middleware and auth_api | ⚠️ Warning | Only impacts when JWT_SECRET env var is unset. With .env.local set, both use same value. |
| W3  | setting-content.tsx uses Tailwind green utilities for active-user status | ℹ️ Info | Not brand green (#22C55E). Intentional UX semantic. |

### Files Verified

**Created (new):**
- `auth_api.py` (178 lines) -- FastAPI JWT auth service
- `lib/db.ts` (16 lines) -- better-sqlite3 singleton
- `lib/auth.ts` (57 lines) -- Client auth helpers
- `scripts/seed_db_users.py` -- Seed users script
- `components/dashboard/LayerTabs.tsx` -- 4-layer tab switcher
- `components/dashboard/SubTabs.tsx` -- Per-layer sub-tab switcher
- `components/dashboard/KpiCardRow.tsx` -- KPI card grid
- `components/dashboard/TrendChart.tsx` -- Year trend chart
- `components/dashboard/BrandTable.tsx` -- Brand list table

**Modified:**
- `middleware.ts` -- Supabase → jose JWT
- `app/page.tsx` -- Supabase → cookies()+jose redirect
- `app/globals.css` -- Full rewrite: MD brand tokens
- `app/layout.tsx` -- MD title update
- `app/login/page.tsx` -- Supabase → FastAPI JWT
- `app/dashboard/dashboard-content.tsx` -- 4-layer architecture refactor
- `app/api/dashboard/route.ts` -- Supabase → better-sqlite3 + yearTrend
- `app/api/map/markers/route.ts` -- Supabase → better-sqlite3
- `app/api/calendar/events/route.ts` -- Supabase → better-sqlite3
- `app/api/brands/[id]/route.ts` -- Supabase → better-sqlite3
- `app/api/brands/[id]/tags/route.ts` -- Supabase → FastAPI proxy
- `app/api/users/route.ts` -- Supabase → better-sqlite3
- `app/api/setting/status/route.ts` -- Supabase → better-sqlite3
- `app/calendar/calendar-view.tsx` -- Green → MD orange event styles
- `app/map/map-view.tsx` -- Blue → MD orange markers
- `app/setting/setting-content.tsx` -- Supabase → JWT+SQLite
- `components/layout/Sidebar.tsx` -- Supabase → lib/auth, lucide icons
- `components/ui/KpiCard.tsx` -- MD orange hover + kpi-value
- `components/ui/TrendBadge.tsx` -- MD color system
- `components/ui/FilterTabs.tsx` -- MD orange selected state
- `components/charts/IndustryPieChart.tsx` -- MD brand palette
- `components/map/Legend.tsx` -- MD orange markers
- `lib/types.ts` -- Supabase types removed, YearTrendItem added
- `.env.local` -- JWT_SECRET added (FASTAPI_URL pending)

**Deleted:**
- `lib/supabase/` (entire directory: admin.ts, client.ts, middleware.ts, server.ts)

---

_Verified: 2026-05-08T15:37:00Z_
_Verifier: Claude (gsd-verifier)_
