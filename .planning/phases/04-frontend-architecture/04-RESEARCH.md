# Phase 4: 前端架构全面迁移 + Dashboard UI — Research

**Researched:** 2026-05-06
**Domain:** Next.js 15 + Supabase + Cloudflare Workers + React UI
**Confidence:** HIGH (core stack verified); MEDIUM (calendar library tradeoffs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**技术栈 & 部署**
- D-01: 前端框架 → Next.js（React生态，SSR/SSG均可，Cloudflare Pages原生支持）
- D-02: 前端托管 → Cloudflare Pages（域名已购，免费，静态+Edge Functions）
- D-03: 数据库 → Supabase PostgreSQL（免费层，500MB存储，当前数据约10MB，足够）
- D-04: 认证系统 → Supabase Auth（email+password，替代现有 FastAPI JWT）
- D-05: 后端逻辑 → Next.js API Routes（替代FastAPI，TypeScript实现，部署在CF Pages的Edge Functions）
- D-06: 现有 FastAPI（tag_api.py、merge_engine.py等Python代码）→ 废弃，功能在API Routes中重写

**UI 界面结构**
- D-07: 左侧边栏4项（Dashboard/Calendar/Map/Setting，Setting仅admin可见）
- D-08: 界面参考风格 → Hirezy Dashboard（白色背景，圆角卡片，绿色主色调，浅紫色辅色）
- D-09: Dashboard 三排过滤 Tab（行业筛选单选联动/关系筛选多选/MDS相关性单选）
- D-10: Dashboard KPI卡片区（展览面积/展商数量/观众数量/展览集团，含趋势徽章）

**登录 & 账号系统**
- D-11: 账号密码登录（无SSO/OAuth）
- D-12: 账号总数 → 30个
- D-13: 三角色（admin/manager/readonly）
- D-14: seed脚本（scripts/seed-users.ts），一次性执行
- D-15: Admin密码通过.env.local隔离

**Calendar 模块**
- D-16: 展会日历视图，按月/周显示date_start/date_end，点击显示详情弹窗

**Map 模块**
- D-17: Leaflet地图，按city字段聚合，热力点显示

**Phase 执行顺序**
- D-18: Phase 1b（全集采集）与 Phase 4 并行
- D-19: Phase 3b（打标工具）与 Phase 4 并行
- D-20: 前端开发初期可连接现有SQLite数据，Supabase迁移完成后切换

**Agent 分工**
- D-21: CC（Claude Code）→ 架构层（项目初始化、Supabase接入、DB Schema迁移、API Routes、Auth）
- D-22: Cursor → 界面开发（所有页面组件）
- D-23: Claude Design（一次性）→ UI规范（Tailwind配置、颜色Token、组件样式规范）
- D-24: Hermes → Phase 1b（数据采集，与前端并行）

### Claude's Discretion

以下领域 CC 自主决定：
- Calendar 库的具体选型（react-big-calendar vs FullCalendar vs 自研）
- Next.js App Router 目录结构细节
- RLS Policy 的具体 SQL 写法
- seed-users.ts 脚本的实现细节
- PostgreSQL DDL 中各字段类型的精确映射

### Deferred Ideas (OUT OF SCOPE)

- 打标前端界面（Setting页内嵌打标功能）→ Phase 5 或 Phase 3b
- AI推荐功能 → 永久排除
- 移动端适配 → 未定义，不做
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-POOL | Claude Design Phase 4 正式 UI — 完整可访问前端系统：登录、Dashboard、Calendar、Map、Setting 四模块；Next.js+Supabase全栈；部署至Cloudflare Pages | 本文档全部章节直接支持此需求 |
</phase_requirements>

---

## Summary

Phase 4 的核心任务是将现有 FastAPI+SQLite 技术栈完整迁移至 Next.js 15 + Supabase PostgreSQL，并实现四个前端模块（Dashboard/Calendar/Map/Setting），部署至 Cloudflare（通过 OpenNext for Cloudflare Workers）。

**关键技术发现：** `@cloudflare/next-on-pages` 已被官方废弃，Cloudflare 官方现推荐 `@opennextjs/cloudflare` + Cloudflare Workers（非 Pages）。这是 D-02 决策的重要细化：托管平台是 Cloudflare，但实际运行环境应迁移至 **Cloudflare Workers**（而非 Cloudflare Pages），使用 OpenNext 适配器。这支持完整 Next.js Node.js runtime，解决了 edge-only 的限制。

**认证架构：** Supabase Auth 的角色存储最佳实践是 `app_metadata.role`（仅服务端 service role key 可修改）+ Custom Access Token Hook 注入 JWT claim，而非旧版 `user_metadata`。seed 脚本用 `supabase.auth.admin.createUser()` 配合 `app_metadata: { role: 'admin' }` 批量创建用户。

**数据库迁移：** SQLite → PostgreSQL 的 DDL 转换规则明确（6张表），主要变化：TEXT 列保持/改为 TEXT、AUTOINCREMENT → SERIAL/GENERATED ALWAYS AS IDENTITY、datetime('now') → NOW()、CHECK 约束语法兼容。Supabase 免费层 500MB 已足够当前约 10MB 数据量。

**Primary recommendation:** 采用 Next.js 15 App Router + @opennextjs/cloudflare（Cloudflare Workers 部署），执行顺序 CC（架构层）→ Claude Design（UI规范）→ Cursor（界面实现）。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 用户登录/会话管理 | API / Backend (Supabase Auth) | Frontend Server (Next.js middleware) | 认证逻辑必须在服务端验证 token，middleware 做路由守卫 |
| Dashboard 数据聚合 | API / Backend (Next.js API Route) | Database (Supabase PostgreSQL) | 聚合逻辑（SUM/COUNT/GROUP BY）在 DB 层执行，API 层组装响应 |
| Dashboard KPI卡片 / 过滤Tab | Browser / Client | Frontend Server (SSR 初始数据) | 交互态（过滤切换）为纯客户端，初始渲染可 SSR |
| Calendar 展会日历视图 | Browser / Client | — | react-big-calendar 是纯客户端组件，不支持 SSR |
| Map 地理分布（Leaflet） | Browser / Client | — | Leaflet 依赖 window/document，必须 dynamic import + ssr:false |
| Setting 页用户管理 | API / Backend (Next.js API Route) | Browser / Client | 用户列表查询在服务端，admin-only 通过 RLS + middleware 双重保护 |
| Row Level Security | Database / Storage (Supabase) | — | RLS 在 PostgreSQL 层执行，代码层无需二次过滤 |
| 静态资产 / CSS | CDN / Static (Cloudflare) | — | Next.js build 产出的 /_next/static/* 由 Cloudflare CDN 缓存 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.2.4 | React 全栈框架（App Router） | Cloudflare OpenNext 官方支持 14/15/16 |
| react | 19.2.5 | UI 库 | Next.js peer dependency |
| @supabase/supabase-js | 2.105.3 | Supabase 客户端（DB + Auth） | 官方 JS SDK |
| @supabase/ssr | 0.10.2 | Next.js SSR 场景的 Supabase Auth | 官方推荐，替代已废弃的 auth-helpers |
| @opennextjs/cloudflare | 1.19.6 | Next.js → Cloudflare Workers 适配器 | Cloudflare 官方推荐，替代废弃的 next-on-pages |
| wrangler | 4.88.0 | Cloudflare Workers CLI（本地预览/部署） | Cloudflare 官方工具 |
| typescript | 6.0.3 | 类型系统 | 全项目 TypeScript |
| tailwindcss | 4.2.4 | 原子化 CSS | Claude Design 产出 Tailwind 配置 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-leaflet | 5.0.0 | Leaflet React 封装（Map模块） | 展会地理分布图，dynamic import + ssr:false |
| leaflet | 1.9.4 | 地图底层库 | react-leaflet peer dependency |
| react-big-calendar | 1.19.4 | Calendar 展会日历视图 | 月/周视图，需 dynamic import（客户端渲染） |
| @types/react | 19.2.14 | React 类型定义 | dev dependency |
| @types/leaflet | latest | Leaflet 类型定义 | dev dependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-big-calendar | FullCalendar (@fullcalendar/react 6.1.20) | FullCalendar 功能更丰富但 React 版本需要许可证（免费版有限制）；react-big-calendar 完全开源 |
| react-big-calendar | 自研日历 | 工作量过大，D-16 范围仅需月/周视图 |
| @opennextjs/cloudflare | @cloudflare/next-on-pages | next-on-pages 已废弃，仅支持 edge runtime（不支持完整 Node.js APIs），官方已停止推荐 |
| Supabase Auth (app_metadata) | 自建 users 表 + custom JWT | Supabase Auth 原生支持，seed 脚本更简洁 |

**Installation:**
```bash
npm create cloudflare@latest -- mwlab-dashboard --framework=next --platform=workers
# 或在现有项目中
npx @opennextjs/cloudflare migrate
npm install @supabase/supabase-js @supabase/ssr
npm install react-leaflet leaflet react-big-calendar
npm install -D @types/leaflet wrangler
```

**Version verification:** [VERIFIED: npm registry — 2026-05-06]
- @opennextjs/cloudflare: 1.19.6
- next: 16.2.4
- @supabase/supabase-js: 2.105.3
- @supabase/ssr: 0.10.2
- react-leaflet: 5.0.0
- react-big-calendar: 1.19.4
- tailwindcss: 4.2.4

---

## Architecture Patterns

### System Architecture Diagram

```
浏览器 (Browser)
    │
    │ HTTPS (域名: 已购)
    ▼
Cloudflare Workers (OpenNext 适配器)
    │  ── Next.js App Router
    │  ── middleware.ts (Supabase Auth token 刷新 + 路由守卫)
    │  ── /app/login            → LoginPage (Server Component)
    │  ── /app/dashboard        → DashboardPage (Client: 过滤Tab + KPI卡片)
    │  ── /app/calendar         → CalendarPage (Client: dynamic import)
    │  ── /app/map              → MapPage (Client: dynamic import)
    │  ── /app/setting          → SettingPage (admin only)
    │  ── /app/api/dashboard    → Route Handler (聚合查询)
    │  ── /app/api/brands/[id]  → Route Handler (打标 PATCH)
    │  ── /app/api/users        → Route Handler (admin 用户管理)
    │
    ├─── Supabase PostgreSQL (DB)
    │       └── exhibition_brand, exhibition_edition,
    │           data_provenance, crawl_log, manual_tag_history
    │           (users 表由 Supabase Auth 内置 auth.users 管理)
    │
    └─── Supabase Auth (认证)
            └── email+password, app_metadata.role (admin/manager/readonly)
                Custom Access Token Hook → JWT claim 注入 role
```

### Recommended Project Structure

```
mwlab-dashboard/
├── app/
│   ├── layout.tsx              # 根布局，Sidebar + Auth检查
│   ├── login/
│   │   └── page.tsx            # 登录页
│   ├── dashboard/
│   │   └── page.tsx            # Dashboard主页
│   ├── calendar/
│   │   └── page.tsx            # Calendar日历视图
│   ├── map/
│   │   └── page.tsx            # Map地理分布
│   ├── setting/
│   │   └── page.tsx            # Setting（admin only）
│   └── api/
│       ├── dashboard/route.ts  # GET: 聚合查询
│       ├── brands/[id]/
│       │   ├── route.ts        # GET: 品牌详情
│       │   └── tags/route.ts   # PATCH: 打标（tag_api.py 重写）
│       └── users/route.ts      # GET: 用户列表（admin）
├── components/
│   ├── Sidebar.tsx             # 侧边栏（含角色条件渲染）
│   ├── KpiCard.tsx             # KPI卡片组件
│   ├── FilterTabs.tsx          # 三排过滤Tab
│   ├── IndustryPieChart.tsx    # 行业分布圆饼图
│   ├── CalendarView.tsx        # react-big-calendar封装（client）
│   └── MapView.tsx             # Leaflet封装（client, dynamic）
├── lib/
│   ├── supabase/
│   │   ├── client.ts           # 浏览器端 supabase client
│   │   └── server.ts           # 服务端 createServerClient
│   └── types.ts                # DB类型定义（从Supabase生成）
├── middleware.ts               # Auth token刷新 + 路由守卫
├── scripts/
│   └── seed-users.ts           # 30用户初始化脚本
├── supabase/
│   └── migrations/
│       └── 001_init.sql        # PostgreSQL建表DDL
├── wrangler.jsonc              # Cloudflare Workers配置
├── open-next.config.ts         # OpenNext适配器配置
└── .env.local                  # NEXT_PUBLIC_SUPABASE_URL, SERVICE_ROLE_KEY
```

### Pattern 1: Supabase @supabase/ssr — middleware.ts（必须）

**What:** middleware 在每个请求到达 page/API 前刷新 Supabase Auth token，将最新 session 写回 cookie
**When to use:** 所有需要服务端认证的请求

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/nextjs
// middleware.ts
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
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // MUST use getUser() not getSession() for security
  const { data: { user } } = await supabase.auth.getUser()

  // 路由守卫
  if (!user && !request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  // Setting页 admin-only
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

### Pattern 2: Supabase 服务端 client（API Routes / Server Components）

```typescript
// Source: https://supabase.com/docs/guides/auth/server-side/creating-a-client
// lib/supabase/server.ts
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
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}
```

### Pattern 3: Leaflet / react-leaflet — dynamic import（必须）

```typescript
// Source: https://xxlsteve.net/blog/react-leaflet-on-next-15/
// app/map/page.tsx
import dynamic from 'next/dynamic'

const MapView = dynamic(() => import('@/components/MapView'), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-100 animate-pulse rounded-xl" />,
})

export default function MapPage() {
  return <MapView />
}

// components/MapView.tsx — "use client" + leaflet CSS
'use client'
import 'leaflet/dist/leaflet.css'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
// ... 热力点实现
```

### Pattern 4: seed-users.ts 脚本

```typescript
// Source: https://supabase.com/docs/reference/javascript/auth-admin-createuser
// scripts/seed-users.ts — 使用 SERVICE_ROLE_KEY（不使用 anon key）
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!  // admin 权限
)

const users = [
  { email: 'admin@mwlab.internal', password: process.env.ADMIN_PASSWORD!, role: 'admin' },
  { email: 'manager1@company.com', password: 'Manager2026!', role: 'manager' },
  // ... 30 users
]

for (const u of users) {
  const { error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: u.password,
    email_confirm: true,       // 跳过邮件验证
    app_metadata: { role: u.role },  // app_metadata 而非 user_metadata（角色权限用）
  })
  if (error) console.error(`Failed: ${u.email}`, error.message)
  else console.log(`Created: ${u.email} [${u.role}]`)
}
```

### Pattern 5: OpenNext Cloudflare Workers 配置

```jsonc
// wrangler.jsonc — 必须设置 nodejs_compat + compatibility_date >= 2024-09-23
{
  "name": "mwlab-dashboard",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-04-01",  // >= 2025-04-01 才能使 process.env 正常
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

```json
// package.json scripts
{
  "scripts": {
    "build": "next build",
    "preview": "opennextjs-cloudflare build && opennextjs-cloudflare preview",
    "deploy": "opennextjs-cloudflare build && opennextjs-cloudflare deploy"
  }
}
```

**关键注意：** 移除所有源文件中的 `export const runtime = 'edge'`。OpenNext 使用 Node.js runtime，edge runtime 在 @opennextjs/cloudflare 中暂不支持。[VERIFIED: opennext.js.org/cloudflare/get-started]

### Anti-Patterns to Avoid

- **使用 @cloudflare/next-on-pages：** 已废弃，仅支持 edge runtime，大量 Next.js 功能无法使用。改用 @opennextjs/cloudflare
- **使用 @supabase/auth-helpers：** 已废弃，改用 @supabase/ssr
- **使用 supabase.auth.getSession() 做安全检查：** 不安全（只读本地 cookie），改用 supabase.auth.getUser()（每次请求验证 token）
- **在 user_metadata 存储角色：** user_metadata 用户可自行修改，角色必须存于 app_metadata
- **在 middleware 直接连接 DB：** middleware 运行在 edge，应只做 token 刷新和路由守卫，业务逻辑在 API Routes
- **直接 import Leaflet/react-leaflet（不用 dynamic）：** 导致 "window is not defined" SSR 错误

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth 会话管理 | 手写 JWT 验证逻辑 | @supabase/ssr + middleware.ts | token 刷新、cookie 管理、SSR 边界处理极复杂 |
| 角色权限过滤 | 应用层 if-else 过滤 | Supabase RLS Policies | RLS 在 DB 层强制，应用层绕过不影响数据安全 |
| 地图渲染 | 原生 Canvas/SVG 地图 | Leaflet + react-leaflet | 经纬度投影、tile 加载、交互已有成熟方案 |
| 日历视图 | 自研月/周日历组件 | react-big-calendar | 月/周/日切换、事件跨天渲染逻辑复杂 |
| DB 类型定义 | 手写 TypeScript 接口 | Supabase CLI 自动生成（npx supabase gen types） | 与 DB schema 保持同步，避免手写错误 |

**Key insight:** Cloudflare Workers + Node.js runtime（via OpenNext）解锁了完整 Node.js API 支持，无需为 edge 限制做大量兼容性工作。

---

## SQLite → PostgreSQL DDL 转换（6张表）

[VERIFIED: 直接分析 schema/init_db.sql]

### 完整转换规则

| SQLite | PostgreSQL | 说明 |
|--------|-----------|------|
| `TEXT PRIMARY KEY` | `TEXT PRIMARY KEY` | 字符串主键（brand_id/edition_id/record_id）保持 TEXT |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `BIGSERIAL PRIMARY KEY` | 数值自增主键（crawl_log.id, user.user_id, manual_tag_history.id） |
| `INTEGER` | `INTEGER` 或 `BIGINT` | 普通整数字段保持 INTEGER |
| `REAL` | `FLOAT` 或 `DOUBLE PRECISION` | overseas_exhibitor_pct |
| `TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))` | `TIMESTAMPTZ NOT NULL DEFAULT NOW()` | 时间戳字段统一改为 TIMESTAMPTZ |
| `TEXT` (for dates) | `DATE` 或 `TEXT` | date_start/date_end 建议改为 DATE 类型 |
| `CHECK (col IN ('a', 'b'))` | 保持相同语法 | PostgreSQL CHECK 语法兼容 |
| `REFERENCES tbl(col) ON DELETE CASCADE` | 保持相同语法 | 外键语法兼容 |
| `PRAGMA foreign_keys = ON` | 删除（PostgreSQL 默认启用） | |
| `PRAGMA journal_mode = WAL` | 删除（Supabase 管理） | |

### users 表处理

**重要：** `users` 表（D-11，Phase 3 JWT auth）**不需要迁移到 PostgreSQL**。Supabase Auth 内置 `auth.users` 表管理所有用户。Phase 4 不需要单独的 `public.users` 表，角色信息通过 `auth.users.app_metadata.role` 管理。

如需在前端展示用户列表（Setting页），直接调用 `supabase.auth.admin.listUsers()`（API Route 中用 SERVICE_ROLE_KEY）。

### 需要迁移的5张表（users 表替换为 Supabase Auth）

1. `exhibition_brand` — 主表，brand_id TEXT PK
2. `exhibition_edition` — 届次表，edition_id TEXT PK
3. `data_provenance` — 溯源表，record_id TEXT PK
4. `crawl_log` — 日志表，id BIGSERIAL PK
5. `manual_tag_history` — 打标历史，id BIGSERIAL PK

---

## Supabase RLS Policies（3角色）

[VERIFIED: Supabase 官方文档 + Context7]

### 策略设计原则

- 所有表启用 RLS（`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`）
- 展览数据（exhibition_brand/edition/provenance）：所有登录用户可读，admin/manager 可写
- manual_tag_history：admin/manager 可写（打标权限），所有登录用户可读
- crawl_log：只读（系统写入）

### 标准 RLS 模板

```sql
-- 从 JWT app_metadata 读取角色的函数
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- exhibition_brand: 所有登录用户可读
CREATE POLICY "authenticated_read" ON exhibition_brand
  FOR SELECT TO authenticated USING (true);

-- exhibition_brand: 仅 admin/manager 可写
CREATE POLICY "manager_write" ON exhibition_brand
  FOR ALL TO authenticated
  USING (get_user_role() IN ('admin', 'manager'))
  WITH CHECK (get_user_role() IN ('admin', 'manager'));

-- crawl_log: 仅可读（系统写入）
CREATE POLICY "readonly_crawl_log" ON crawl_log
  FOR SELECT TO authenticated USING (true);
```

**注意：** Custom Access Token Hook 将 `app_metadata.role` 注入 JWT，middleware 和 RLS 都可以读取。[CITED: supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac]

---

## Common Pitfalls

### Pitfall 1: 使用废弃的 next-on-pages 适配器

**What goes wrong:** @cloudflare/next-on-pages 仅支持 edge runtime，大量 Node.js API（如 crypto、Buffer 完整实现）不可用，API Routes 行为与预期不符
**Why it happens:** 旧文档/博客仍引用 next-on-pages
**How to avoid:** 使用 `@opennextjs/cloudflare`，移除所有 `export const runtime = 'edge'`
**Warning signs:** wrangler deploy 报错 "Node.js API not available in edge runtime"

### Pitfall 2: wrangler.jsonc 的 compatibility_date 过旧

**What goes wrong:** `process.env` 在 Cloudflare Workers 中为空，环境变量无法读取
**Why it happens:** `nodejs_compat_populate_process_env` flag 在 2025-04-01 之前不自动启用
**How to avoid:** 设置 `"compatibility_date": "2025-04-01"` 或更新的日期
**Warning signs:** 所有 `process.env.XXX` 返回 undefined

### Pitfall 3: Leaflet 在 Next.js 中不使用 dynamic import

**What goes wrong:** 服务端渲染时抛出 "window is not defined" 错误，构建失败
**Why it happens:** Leaflet 在模块加载时访问 `window` 对象
**How to avoid:** 始终用 `dynamic(() => import('@/components/MapView'), { ssr: false })`；`"use client"` 不够，还需要 dynamic + ssr:false
**Warning signs:** 构建时报错，或页面空白

### Pitfall 4: 用 user_metadata 存储角色

**What goes wrong:** 用户可以通过 `supabase.auth.updateUser()` 自行修改 user_metadata，等于用户可以自提权
**Why it happens:** user_metadata 和 app_metadata 都在 auth.users，容易混淆
**How to avoid:** 角色必须存于 `app_metadata`，只有 SERVICE_ROLE_KEY 可修改
**Warning signs:** 用户能访问不应访问的页面

### Pitfall 5: react-big-calendar 缺少 CSS 导入

**What goes wrong:** 日历渲染出来但没有样式，布局混乱
**Why it happens:** react-big-calendar 需要手动导入 CSS
**How to avoid:** 在 CalendarView.tsx 顶部 `import 'react-big-calendar/lib/css/react-big-calendar.css'`；同时需要一个 `localizer`（moment 或 date-fns）

### Pitfall 6: Supabase 免费层项目休眠

**What goes wrong:** 超过 1 周无活动后，Supabase 免费层项目进入休眠，首次请求需等待几秒唤醒
**Why it happens:** Supabase 免费层策略
**How to avoid:** 生产环境可考虑 Pro 层（$25/月），或设置定时 ping；开发阶段休眠可接受
**Warning signs:** 首次请求延迟 5-10 秒

### Pitfall 7: Supabase Auth 不传 email_confirm: true 导致 seed 用户无法登录

**What goes wrong:** createUser 后用户无法登录，因为邮件未确认
**Why it happens:** Supabase Auth 默认要求邮件验证
**How to avoid:** seed 脚本中 `createUser({ ..., email_confirm: true })`
**Warning signs:** 登录返回 "Email not confirmed" 错误

---

## Runtime State Inventory

> Phase 4 是新建前端项目，同时涉及 SQLite → Supabase PostgreSQL 数据迁移

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | SQLite mwlab.db：约10MB，6张表（exhibition_brand, exhibition_edition, data_provenance, crawl_log, manual_tag_history, user） | 数据迁移脚本：将 SQLite 数据导出并导入 Supabase PostgreSQL（一次性任务） |
| Live service config | FastAPI 服务（tag_api.py, merge_engine.py）在 uvicorn 运行 | 废弃（D-06），功能在 Next.js API Routes 中 TypeScript 重写 |
| OS-registered state | scheduler.py 定时任务（周一增量/月初全量） | 调度器目前直接写 SQLite，Phase 1b 完成后 Hermes 改写入 Supabase PostgreSQL；Phase 4 不直接修改 scheduler |
| Secrets/env vars | 现有 FastAPI JWT secret（在 Python 代码中） | 废弃，Supabase Auth 接管认证；新建 .env.local 含 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY |
| Build artifacts | Docker 镜像（Phase 3 产出，包含 FastAPI 服务） | Phase 4 完成后废弃，不用于新前端 |

**user 表处理：** 现有 SQLite `user` 表（30人上限，JWT 认证）**不迁移数据**——通过 seed-users.ts 在 Supabase Auth 中全量重建，避免密码 hash 兼容问题。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js 构建/运行 | ✓ | 24.14.0 | — |
| npm | 包管理 | ✓ | 11.9.0 | — |
| git | 版本控制/CI | ✓ | 2.50.1 | — |
| wrangler (global) | Cloudflare Workers 部署 | ✗ | — | npx wrangler（无需全局安装）|
| cloudflared | Cloudflare Tunnel | ✗ | — | 不需要（域名直连 Workers）|
| Supabase project | DB + Auth | ✗ (未创建) | — | 需在 supabase.com 创建免费项目，获取 URL + keys |
| Cloudflare account | Workers 部署 | ✗ (未确认) | — | 需要 Cloudflare 账号 + Workers 已开通 |

**Missing dependencies with no fallback:**
- Supabase 项目未创建：Wave 0 任务必须先创建 Supabase 项目并获取 SUPABASE_URL + ANON_KEY + SERVICE_ROLE_KEY
- Cloudflare Workers 账号：需确认 Cloudflare 账号已开通 Workers（免费层支持）

**Missing dependencies with fallback:**
- wrangler 全局安装 → npx wrangler 即可，无需全局

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react（Next.js 项目标配） |
| Config file | vitest.config.ts — Wave 0 创建 |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-POOL-AUTH | 未登录访问 /dashboard 重定向到 /login | integration | `npx vitest run tests/middleware.test.ts` | ❌ Wave 0 |
| UI-POOL-AUTH | admin 访问 /setting 成功，manager 重定向 | integration | `npx vitest run tests/middleware.test.ts` | ❌ Wave 0 |
| UI-POOL-DASH | /api/dashboard 返回正确聚合数据（industry_l2, relation, mds 三参数过滤） | unit | `npx vitest run tests/api/dashboard.test.ts` | ❌ Wave 0 |
| UI-POOL-TAGS | PATCH /api/brands/[id]/tags 写入 exhibition_brand 并记录 manual_tag_history | unit | `npx vitest run tests/api/tags.test.ts` | ❌ Wave 0 |
| UI-POOL-SEED | seed-users.ts 脚本创建30用户无报错 | manual-only | — | ❌ Wave 0（smoke test 手动验证）|

### Sampling Rate

- **Per task commit:** `npx vitest run --reporter=dot`（快速冒烟）
- **Per wave merge:** `npx vitest run`（全量）
- **Phase gate:** 全量通过 + Cloudflare Workers preview 手动验证后 `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `tests/middleware.test.ts` — 路由守卫 + 角色权限测试
- [ ] `tests/api/dashboard.test.ts` — 聚合查询 API 单元测试
- [ ] `tests/api/tags.test.ts` — 打标 API 单元测试
- [ ] `vitest.config.ts` — 测试框架配置
- [ ] Framework install: `npm install -D vitest @testing-library/react @vitejs/plugin-react`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth（email+password，无 OAuth，不手写 JWT） |
| V3 Session Management | yes | @supabase/ssr cookie-based session，middleware.ts 每请求刷新 |
| V4 Access Control | yes | middleware.ts 路由守卫 + Supabase RLS Policies（双重保护） |
| V5 Input Validation | yes | TypeScript 类型 + Supabase 参数化查询（防 SQL 注入）；打标字段白名单从 TAGGABLE_FIELDS 移植 |
| V6 Cryptography | no（由 Supabase 管理） | Supabase Auth 内置 bcrypt 密码 hash，不手写加密 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 用户自提权（修改 user_metadata.role） | Elevation of Privilege | 角色只存 app_metadata（仅 service_role 可写） |
| 未授权访问展览数据 | Information Disclosure | RLS + middleware 双重保护 |
| 打标 API 越权修改 | Tampering | middleware 验证角色；TAGGABLE_FIELDS 白名单（从 tag_api.py 移植） |
| Service Role Key 泄露 | Information Disclosure | SERVICE_ROLE_KEY 只存 .env.local，不提交 git，不暴露客户端 |
| Setting 页未鉴权访问 | Elevation of Privilege | middleware 中 admin-only 路由守卫 + 侧边栏条件渲染（UI层辅助） |

---

## Code Examples

### Dashboard API Route（聚合查询）

```typescript
// Source: tag_api.py 移植参照 + Supabase 官方文档
// app/api/dashboard/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const industry_l2 = searchParams.get('industry_l2')
  const relation = searchParams.get('relation')      // 竞争对手/潜在伙伴/新进入者/全部
  const mds = searchParams.get('mds')               // 全部/MFC/Reha China/无

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

  // KPI 聚合
  const kpi = {
    area_sqm: data.reduce((s, b) => s + (b.exhibition_edition?.[0]?.area_sqm ?? 0), 0),
    exhibitors_count: data.reduce((s, b) => s + (b.exhibition_edition?.[0]?.exhibitors_count ?? 0), 0),
    visitors_count: data.reduce((s, b) => s + (b.exhibition_edition?.[0]?.visitors_count ?? 0), 0),
    organizer_count: new Set(data.map(b => b.organizer).filter(Boolean)).size,
  }

  return NextResponse.json({ brands: data, kpi })
}
```

### PostgreSQL 建表 DDL（exhibition_brand 示例）

```sql
-- supabase/migrations/001_init.sql
-- Source: schema/init_db.sql 转换
CREATE TABLE IF NOT EXISTS exhibition_brand (
    brand_id              TEXT    PRIMARY KEY,
    name_cn               TEXT    NOT NULL,
    name_en               TEXT    NOT NULL DEFAULT '',
    first_year            INTEGER,
    organizer             TEXT    NOT NULL DEFAULT '',
    co_organizer          TEXT    NOT NULL DEFAULT '',
    city                  TEXT    NOT NULL DEFAULT '',
    frequency             TEXT    NOT NULL DEFAULT '',
    industry_l1           TEXT    NOT NULL DEFAULT '',
    industry_l2           TEXT    NOT NULL DEFAULT '',
    competition_relation  TEXT    NOT NULL DEFAULT ''
                              CHECK (competition_relation IN ('是', '否', '')),
    mds_related           TEXT    NOT NULL DEFAULT '',
    scale_score           INTEGER CHECK (scale_score IS NULL OR scale_score BETWEEN 1 AND 10),
    is_international      INTEGER NOT NULL DEFAULT 0,
    is_ufi_certified      INTEGER NOT NULL DEFAULT 0,
    ma_potential          INTEGER CHECK (ma_potential IS NULL OR ma_potential BETWEEN 1 AND 5),
    strategic_relevance   INTEGER CHECK (strategic_relevance IS NULL OR strategic_relevance BETWEEN 1 AND 5),
    competitor_group      TEXT    NOT NULL DEFAULT '',
    website               TEXT    NOT NULL DEFAULT '',
    notes                 TEXT    NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- crawl_log: AUTOINCREMENT → BIGSERIAL
CREATE TABLE IF NOT EXISTS crawl_log (
    id              BIGSERIAL PRIMARY KEY,
    batch_id        TEXT    NOT NULL UNIQUE,
    source_site     TEXT    NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ,
    status          TEXT    NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'success', 'failed', 'partial')),
    total_fetched   INTEGER NOT NULL DEFAULT 0,
    total_inserted  INTEGER NOT NULL DEFAULT 0,
    total_skipped   INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT    NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| @cloudflare/next-on-pages | @opennextjs/cloudflare | 2024-2025 | 官方废弃，切换 Workers，获得完整 Node.js runtime |
| @supabase/auth-helpers | @supabase/ssr | 2023-2024 | 官方废弃，新 API 支持 App Router cookies |
| supabase.auth.getSession() 做安全检查 | supabase.auth.getUser() | 2024 | getSession() 不验证 token，存在安全风险 |
| Cloudflare Pages (next-on-pages) | Cloudflare Workers (opennext) | 2025 | 部署目标变更：D-02 "Cloudflare Pages" 实际应为 Cloudflare Workers |

**Deprecated/outdated:**
- `@cloudflare/next-on-pages`：废弃，改用 @opennextjs/cloudflare
- `@supabase/auth-helpers`：废弃，改用 @supabase/ssr
- `export const runtime = 'edge'` in source files：与 @opennextjs/cloudflare 不兼容，必须移除

---

## Open Questions (RESOLVED)

1. **D-02 精化：Cloudflare Workers vs Cloudflare Pages**
   - What we know: @cloudflare/next-on-pages 已废弃；@opennextjs/cloudflare 部署到 Cloudflare Workers（不是 Pages）
   - What's unclear: 用户购买的域名是绑定在 Cloudflare Pages 还是 Cloudflare 账号级别
   - Recommendation: 将 D-02 理解为"Cloudflare 平台"，实际部署单元为 Cloudflare Workers；域名可通过 Cloudflare DNS 绑定到 Workers，无需 Pages

2. **Supabase Custom Access Token Hook 激活**
   - What we know: Hook 需在 Supabase 控制台手动激活（Database → Hooks）
   - What's unclear: 免费层是否支持 Custom Access Token Hook
   - Recommendation: Wave 0 创建 Supabase 项目时立即验证；如不支持，备用方案：在 middleware 中手动解码 JWT 并读 app_metadata

3. **数据迁移时机（SQLite → Supabase）**
   - What we know: D-20 允许前端开发初期连接本地 SQLite（约3.4K条），迁移后切换
   - What's unclear: 本地 SQLite 访问方式在 Next.js API Routes 中（edge 环境无法访问本地文件）
   - Recommendation: 跳过 SQLite 中间态，直接用 Supabase PostgreSQL 从 Wave 1 开始；用现有 mwlab.db 数据做一次性 pgloader/pg_dump 导入作为 seed data
   - **RESOLVED: 计划采用直接迁移方案，Wave 1 直接连接 Supabase**

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Cloudflare Workers 免费层足够支撑内部工具（30用户，低并发）| Environment | 如需 Workers Paid，成本 $5/月，可接受 |
| A2 | Supabase 免费层支持 Custom Access Token Hook | Security Domain / RLS | 如不支持，需改用 middleware 读 app_metadata 替代 JWT claim |
| A3 | react-big-calendar 1.19.4 兼容 React 19 | Standard Stack | 如有兼容问题，降级 React 18 或改用 FullCalendar |
| A4 | 用户已有 Cloudflare 账号且域名已在 Cloudflare DNS 管理 | Environment | 如域名在其他注册商，需额外 DNS 迁移步骤 |

---

## Sources

### Primary (HIGH confidence)
- [Context7 /vercel/next.js] — App Router middleware auth, edge runtime outputs
- [Context7 /supabase/supabase] — @supabase/ssr patterns, RLS policies, admin createUser, seed scripts
- [npm registry] — 所有包版本验证（2026-05-06）
- [schema/init_db.sql] — 直接读取，SQLite DDL 完整分析
- [opennext.js.org/cloudflare/get-started] — @opennextjs/cloudflare 配置步骤，Known Limitations

### Secondary (MEDIUM confidence)
- [developers.cloudflare.com/workers/framework-guides/web-apps/nextjs] — Cloudflare 官方 Next.js 部署指南
- [supabase.com/docs/guides/database/postgres/custom-claims-and-role-based-access-control-rbac] — RBAC + Custom Token Hook 官方文档
- [xxlsteve.net/blog/react-leaflet-on-next-15] — react-leaflet Next.js 15 App Router 实测方案

### Tertiary (LOW confidence)
- WebSearch 结果关于 react-big-calendar + Cloudflare 兼容性 — 未直接找到官方说明，推断基于 "纯客户端组件无 edge 限制"

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — npm 版本全部验证，@opennextjs/cloudflare 和 @supabase/ssr 均为官方当前推荐
- Architecture: HIGH — OpenNext 官方文档 + Supabase 官方 Next.js 教程验证
- SQLite → PostgreSQL DDL: HIGH — 直接分析 init_db.sql 源文件
- Calendar 库选型: MEDIUM — react-big-calendar 兼容性基于文档推断，未实测 React 19
- Pitfalls: HIGH — 大多数来自官方废弃说明

**Research date:** 2026-05-06
**Valid until:** 2026-06-06（OpenNext 和 Supabase 快速迭代，30天后建议重新验证版本）
