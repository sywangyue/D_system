# Phase 4: UI/UX 全面重新架构 — Research

**Researched:** 2026-05-07  
**Domain:** Next.js 16 + Leaflet + MD Corporate Design + FastAPI Integration  
**Confidence:** HIGH (MD brand colors verified from PDF); MEDIUM (architecture tradeoffs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**MD 品牌规范集成（NEW — 2026-05-07 replan）**
- D-01: 品牌色彩体系 → 严格遵循 Messe Düsseldorf Corporate Design Manual 中的官方色板
- D-02: 品牌字体 → 遵循 CD Manual 字体规范（Inter / Arial 体系），建立 Tailwind fontFamily token
- D-03: Logo 与品牌标识 → 登录页 + Dashboard 全局导航栏使用 MD 官方 Logo
- D-04: 布局网格 → 遵循 CD Manual 定义的网格系统和间距规范

**Dashboard 分层架构（NEW）**
- D-05: Dashboard 至少 4 层，每层 4-6 个标签栏
- D-06: 导航结构 → 左侧边栏或顶部导航栏，支持 4 层 Dashboard 快速跳转

**地图模块（CHANGED）**
- D-07: 地图方案 → Leaflet + OpenStreetMap 瓦片，仅做城市级聚合标注
- D-08: 地图功能范围 → 按 city 聚合展会数量，城市标记点，点击显示展会列表

**UI/UX 样式方向（NEW）**
- D-09: 整体风格 → 科技感 + 非技术人员友好：深色主题、高对比度数据卡片、大号数字
- D-10: 点选交互 → Pill/Tag 风格（圆角胶囊），选中态使用 MD 品牌主色
- D-11: 响应式 → 桌面端大屏优先（1920×1080 基准），移动端做基本可读适配

**数据接入验证（NEW）**
- D-12: 所有 UI 组件必须连接真实 mwlab.db 数据进行验证
- D-13: 验证清单：KPI 卡片数字准确、过滤联动正确、地图聚合数量与实际一致

**技术栈（保留）**
- D-14: 前端框架 → Next.js（React 生态）
- D-15: 数据库 → SQLite（mwlab.db 直连）
- D-16: 认证 → 保留现有 JWT 3 角色体系（admin / manager / readonly）
- D-17: 后端 API → 保留现有 FastAPI Dashboard API，前端通过 REST API 调用

**自治执行方案**
- D-18: 执行方式 → Ralph 自治循环（用户离开 6 小时），GSD 规划 + Superpowers 执行
- D-19: 时间预算 → 2-8 小时

### Claude's Discretion

以下领域可自主决定：
- Auth 端点具体实现（FastAPI 新建 auth_api.py 或在 tag_api.py 中扩展）
- Leaflet MarkerCluster 插件选型
- 4 层 Dashboard 的具体 Tab 名称和内容组织方式
- 深色/浅色主题切换实现细节
- 微动效使用 Framer Motion 还是纯 CSS
- 地图城市坐标映射表维护方式

### Deferred Ideas (OUT OF SCOPE)

- 打标前端界面 → Phase 5 或 Phase 3b 扩展
- AI 推荐功能 → 永久排除
- 移动端深度适配 → 仅做基本可读
- 3D 地球 / WebGL 大屏效果 → 过度，不做

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| UI-POOL | Claude Design Phase 4 正式 UI — 完整可访问前端系统：登录、4 层 Dashboard、Calendar、Map、Setting；基于 MD 品牌规范；连接真实 mwlab.db；科技感 UI | 本文档全部章节直接支持此需求 |
</phase_requirements>

---

## Summary

Phase 4 的核心任务是将项目从旧版 Hirezy 风格的初始前端全面升级为 **Messe Düsseldorf 品牌规范的 4 层 Dashboard + 科技感 UI**。

### 关键发现

1. **项目已有完整 Next.js 前端** — 旧版 04-RESEARCH.md 已初始化项目（app/、components/、所有依赖包已安装，包括 leaflet、recharts、react-big-calendar、better-sqlite3）。不需要从零初始化。

2. **现有 API 路由全部使用 Supabase** — `app/api/` 下所有 route.ts 文件使用 `@supabase/sm`。根据新决策（保留 FastAPI + SQLite），这些路由需要重写。

3. **FastAPI 后端无 Auth 端点** — tag_api.py 仅包含品牌查询和打标 PATCH 端点，没有 `/api/auth/login` 或 JWT 签发端点。需要新建 auth_api.py。

4. **原有 3 层 Filter + 单页 Dashboard 需要重构为 4 层架构** — 现有 DashboardContent.tsx 是单页三排 Filter + KPI 卡片 + 饼图。需要拆分为 Layer 1-4 的可切换视图。

5. **MD 品牌色板已从 PDF 提取** — 详见下文 Standard Stack 章节。

6. **现有 CSS globals.css 使用绿色系（Hirezy 风格）** — 需要全部替换为 MD Orange 系。

### 架构核心决策

由于 D-17（保留 FastAPI）和 D-15（SQLite 直连），且 `better-sqlite3` 已安装在项目依赖中，推荐 **BFF 混合架构**：

- **数据查询（Dashboard 聚合 / 地图标注 / 日历事件）**: Next.js API Routes → `better-sqlite3` → `mwlab.db`
- **标签操作（PATCH brand tags）**: Next.js frontend → FastAPI `tag_api.py` → `mwlab.db`
- **认证（Login / JWT）**: Next.js frontend → FastAPI `auth_api.py`（新建）→ `mwlab.db` `user` 表

理由：避免 FastAPI-CORS 和部署复杂性，利用 already-installed `better-sqlite3` 实现毫秒级数据查询，FastAPI 仅处理需要业务逻辑校验的操作。

**Primary recommendation:** 采用 BFF 混合架构。Next.js API Routes 使用 `better-sqlite3` 直连 SQLite 做读查询，FastAPI 处理写操作（tags + auth）。

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 用户登录 / JWT 签发 | API / Backend (FastAPI auth_api.py) | Browser / Client (localStorage token storage) | 密码验证必须在服务端，JWT secret 不暴露给客户端 |
| Dashboard 数据聚合 | API / Backend (Next.js API Route → better-sqlite3) | Database (SQLite mwlab.db) | 聚合查询 SQL 在服务端执行，避免跨域问题 |
| Dashboard Layer 交互（过滤/切换） | Browser / Client | — | Tab 切换和滤镜状态管理纯客户端 |
| 行业分布图表（recharts） | Browser / Client | — | 纯客户端 SVG 渲染，无需 SSR |
| 日历视图（react-big-calendar） | Browser / Client | — | 纯客户端，dynamic import + ssr:false |
| 地图（Leaflet） | Browser / Client | — | 依赖 window/document，必须 dynamic import |
| Setting 页用户管理 | API / Backend (FastAPI → SQLite) | Browser / Client | 用户列表查询在 FastAPI 执行 |
| 打标操作（PATCH tags） | API / Backend (FastAPI tag_api.py) | — | 标签验证逻辑在 tag_api.py 现有实现 |
| 静态资产 / CSS | CDN / Static (Next.js build output) | — | Next.js 构建产出的静态文件由 CDN 缓存 |

---

## Standard Stack

### MD Brand Design Tokens（从 CD Manual PDF 提取）

以下为从 Messe Düsseldorf Corporate Design Manual 页面 6、24-26 提取的官方色板：

```css
/* MD 品牌色板 — 从 CD Manual PDF 第 6、24-26 页提取 [VERIFIED: PDF pag.24-26] */

/* === 主色 === */
--md-orange: #fe5c00;        /* 品牌 Logo 色 — Pantone Orange 021 C */
                              /* CMYK: C0 M72 Y100 K0 / RGB: 254,92,0 */
--md-red: #FF3400;           /* MD Red — Pantone Warm Red C */
                              /* CMYK: C0 M85 Y100 K0 / RGB: 255,52,0 */
--md-magenta: #e60070;       /* MD Magenta — Pantone 226 C（新增补充色） */
                              /* CMYK: C0 M100 Y15 K0 / RGB: 230,0,112 */
--md-light-orange: #ff8c00;  /* MD Light Orange — Pantone 151 C */
                              /* CMYK: C0 M53 Y100 K0 / RGB: 255,140,0 */
--md-yellow: #ffc500;        /* MD Yellow — Pantone 116 C */
                              /* CMYK: C0 M27 Y100 K0 / RGB: 255,197,0 */
--md-grey: #9c9c9c;          /* MD Grey（中性基础色） */
                              /* CMYK: C37 M28 Y28 K15 / RGB: 156,156,156 */

/* === 渐变色（MD Gradient 1 — 表面用，45° 角）=== */
/* Magenta → Red → Light Orange → Yellow */
/* 用于卡片背景、面积区域 */

/* === 渐变色（MD Gradient 2 — 文字/图标/线条用）=== */
/* 同色系调整后用于小面积元素 */

/* === 中性色延伸（PDF p.25 — 图表用色阶）=== */
--md-grey-20: {20% of #9c9c9c}
--md-grey-40: {40% of #9c9c9c}
--md-grey-60: {60% of #9c9c9c}
--md-grey-80: {80% of #9c9c9c}
```

**设计 Token 映射建议（CSS 变量 → Tailwind）：**

```css
@theme {
  /* MD 品牌色 */
  --color-md-orange: #fe5c00;
  --color-md-orange-dark: #e55300;
  --color-md-red: #FF3400;
  --color-md-magenta: #e60070;
  --color-md-light-orange: #ff8c00;
  --color-md-yellow: #ffc500;
  --color-md-grey: #9c9c9c;

  /* 语义 Token */
  --color-surface: #F4F6F8;      /* 保持 — 背景色 */
  --color-surface-card: #FFFFFF;
  --color-surface-dark: #1a1a2e; /* 深色主题背景（可选） */
  --color-accent: var(--color-md-orange);        /* UI 主色调替换绿色 */
  --color-accent-dark: var(--color-md-orange-dark);
  --color-accent-surface: #fff3ec;  /* MD Orange 10% 透明度 */
  --color-destructive: #EF4444;     /* 保留红色 */
  --color-border: #E5E7EB;         /* 保留 */
  --color-text-primary: #111827;   /* 保留 */
  --color-text-secondary: #6B7280; /* 保留 */
}
```

**关键调整：** 旧 UI-SPEC 使用绿色（#22C55E）作为主色调。新规使用 MD Orange（#fe5c00）替代。

### MD 字体规范

从 CD Manual PDF 页面 28-30 提取 [VERIFIED: PDF p.28-30]：

```css
/* House Font — Inter（静态 Inter 18pt + Variable Font 均可） */
/* 下载源：https://fonts.google.com/specimen/Inter */
/* 替代字体（无法使用 Inter 时）：Arial */

--font-family: 'Inter', 'Arial', ui-sans-serif, system-ui, -apple-system, sans-serif;

/* 字号规范（PDF p.32 — 行距） */
--line-height-body: 1.3;    /* 正文 130% */
--line-height-heading: 1.1; /* 标题 110% */

/* 文字对齐：左对齐，右侧自由边距（ragged margins） */
```

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | ^16.2.4 | React 全栈框架（App Router） | **已安装**，保留 D-14 |
| react | ^19.2.5 | UI 库 | Next.js peer dependency，**已安装** |
| better-sqlite3 | ^11.9.1 | SQLite 同步查询（BFF 层） | **已安装**，性能极佳，足够内部工具 30 用户并发 |
| react-leaflet | ^5.0.0 | Leaflet React 封装 | **已安装**，D-07 指定 |
| leaflet | ^1.9.4 | 地图底层库 | **已安装** |
| recharts | ^2.15.4 | 图表库（饼图/柱状图） | **已安装** |
| lucide-react | ^0.532.0 | 图标库 | **已安装**，无 API key 需求 |
| tailwindcss | ^4.2.4 | 原子化 CSS | **已安装**，与 @theme 自定义 Token 配合使用 |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-big-calendar | ^1.19.4 | 展会日历视图 | Calendar 页面，dynamic import + ssr:false |
| moment | ^2.30.1 | react-big-calendar localizer | **已安装**，与 react-big-calendar 配合 |
| @types/better-sqlite3 | ^7.6.13 | SQLite 类型 | **已安装**，dev dep |
| fastapi | (Python) | 后端 API（auth + tags） | **已有**（tag_api.py），需扩展 auth |
| pyjwt / python-jose | (Python) | JWT 签发和验证 | 新建 auth_api.py 需要 |
| passlib + bcrypt | (Python) | 密码哈希验证 | 新建 auth_api.py 需要 |

### Installation（新增依赖）

```bash
# Python 后端新增依赖
pip install pyjwt passlib[bcrypt]

# 前端 — 所有核心库已安装
npm list better-sqlite3 leaflet react-leaflet recharts lucide-react react-big-calendar
```

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| better-sqlite3（BFF 层查数据） | 全部走 FastAPI REST | better-sqlite3 延迟 <1ms，减少一次 HTTP 跳转；FastAPI 仍用于 auth + tag 写入 |
| react-big-calendar | 自研日历 | recharts 已有 calendar 视图逻辑，不应自研 |
| Leaflet MarkerCluster | 自研城市聚合 | MarkerCluster 插件成熟，30 分钟集成 |

---

## Architecture Patterns

### System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│                      浏览器 (Browser)                          │
│                                                               │
│  ┌──────────┐  ┌──────────────────────────────────────────┐   │
│  │ Sidebar  │  │  Main Content Area                       │   │
│  │ (MD Logo)│  │  ┌─ Layer 1: 概览 (KPI 大卡) ─────────┐ │   │
│  │          │  │  │  Tab: 总览/趋势/集团               │ │   │
│  │ Layer 1  │  │  ├─ Layer 2: 分析 (图表) ────────────┤ │   │
│  │ Layer 2  │  │  │  Tab: 行业分布/竞争关系/热力     │ │   │
│  │ Layer 3  │  │  ├─ Layer 3: 地理 ───────────────────┘ │   │
│  │ Layer 4  │  │  │  Tab: 城市分布/场馆/国内外对比     │   │
│  │ ───────  │  │  ├─ Layer 4: 明细 ───────────────────┘   │   │
│  │ 设置     │  │  │  Tab: 品牌列表/届次列表/搜索/排序 │     │
│  │ 退出     │  │  └──────────────────────────────────────┘   │
│  └──────────┘  │                                            │
│       │         │                                            │
│       │ fetch() │  REST API (JSON)                          │
│       ▼         │                                            │
└───────┬──────────────────────────────────────────────────────┘
        │
        ├──────────────────┐
        │                  │
        ▼                  ▼
┌─────────────────┐  ┌──────────────────────┐
│  Next.js API    │  │  FastAPI (2 个服务)   │
│  Routes (BFF)   │  │                      │
│                 │  │  auth_api.py:        │
│  GET /api/      │  │  POST /api/auth/     │
│   dashboard/*   │  │   login              │
│  GET /api/map/* │  │                      │
│  GET /api/      │  │  tag_api.py:         │
│   calendar/*    │  │  PATCH /api/brands/  │
│  GET /api/      │  │   {id}/tags          │
│   brands/*      │  │  GET /api/brands/    │
└────────┬────────┘  │   {id}               │
         │           └──────────┬───────────┘
         │                      │
         │    better-sqlite3    │    sqlite3
         ▼                      ▼
┌──────────────────────────────────────────────┐
│              mwlab.db (SQLite)                │
│   exhibition_brand / exhibition_edition       │
│   data_provenance / manual_tag_history        │
│   user / crawl_log                            │
└──────────────────────────────────────────────┘
```

### Data Flow — 核心查询模式

```
用户操作 → 前端状态更新 → fetch(`/api/dashboard?industry_l2=X&relation=Y`)
  → Next.js API Route
    → better-sqlite3.prepare(SQL).all(params)
    → JSON Response
  → 前端渲染（KPI 卡片/图表/列表）

用户登录 → POST /api/auth/login { email, password }
  → FastAPI auth_api.py
    → bcrypt 验证密码
    → JWT 签发（含 role claim）
    → { token, role, email }
  → 前端 localStorage 存储 token
  → 所有后续请求 Header: Authorization: Bearer <token>

用户打标 → PATCH /api/brands/{id}/tags { field_name, new_value, changed_by }
  → FastAPI tag_api.py
    → 字段白名单验证
    → 写入 exhibition_brand
    → 写入 manual_tag_history
    → 返回更新后品牌
```

### 4-Layer Dashboard 组件树

```
DashboardPage
├── LayerTabs（4 个主 Tab 切换器）
│   ├── Tab: 概览层（Layer 1）
│   ├── Tab: 分析层（Layer 2）
│   ├── Tab: 地理层（Layer 3）
│   └── Tab: 明细层（Layer 4）
│
├── SubTabs（每层内部 4-6 个子 Tab）
│
├── [Layer 1 — 概览层]
│   ├── SubTab: 总览 → KpiCardRow（展览面积/展商/观众/集团 + 年比趋势）
│   ├── SubTab: 趋势 → YearTrendChart（折线图 + KPI 年比变化）
│   ├── SubTab: 集团 → OrganizerBreakdown（主办方 Top 10）
│   └── SubTab: 快照 → QuickStats（数据概览文本摘要）
│
├── [Layer 2 — 分析层]
│   ├── SubTab: 行业分布 → IndustryPieChart + IndustryBarChart
│   ├── SubTab: 竞争关系 → RelationPieChart（竞争对手/潜在伙伴/新进入者占比）
│   ├── SubTab: MDS 相关 → MdsCardGrid（MFC/Reha China 等品牌卡片）
│   ├── SubTab: 热力 → HeatTable（行业×城市交叉矩阵）
│   └── SubTab: 标签 → TagSummary（打标覆盖/缺口分析）
│
├── [Layer 3 — 地理层]
│   ├── SubTab: 城市分布 → MapView（Leaflet + MarkerCluster，city 聚合）
│   ├── SubTab: 场馆分布 → VenueList（按场馆聚合 Top 列表）
│   ├── SubTab: 国内外对比 → ChinaVsIntlBar（国内外数量/面积对比）
│   ├── SubTab: 城市排名 → CityRankTable（城市按展览数排序）
│   └── SubTab: 场馆排名 → VenueRankTable（场馆按展览数排序）
│
└── [Layer 4 — 明细层]
    ├── SubTab: 品牌列表 → BrandTable（排序/搜索/分页）
    ├── SubTab: 届次列表 → EditionTable（按年份排序）
    ├── SubTab: 搜索 → SearchPanel（全文搜索品牌→届次）
    └── SubTab: 导出 → ExportPanel（品牌/届次 CSV 导出）
```

**每层 SubTab 数量：** 概览 4、分析 5、地理 5、明细 4（均符合 D-05 的 4-6 范围）

### Auth Flow（需新建 auth_api.py）

```
FastAPI: auth_api.py
  POST /api/auth/login
    请求: { email: string, password: string }
    验证: 查询 SQLite user 表 → bcrypt.verify(password, user.password_hash)
    签发: JWT(payload: { user_id, email, role, exp })
          使用 python-jose 或 PyJWT，HS256
    Secret: 从环境变量 JWT_SECRET 读取（默认开发可硬编码，生产必须环境变量）
    响应: { token: string, email: string, role: string }

  GET /api/auth/verify
    Header: Authorization: Bearer <token>
    验证: 解码 JWT，查 user 表确认 is_active
    响应: { valid: boolean, email: string, role: string }

  GET /api/auth/users（admin only）
    Header: Authorization: Bearer <token>
    验证: JWT → role === 'admin'
    响应: [{ user_id, email, role, is_active, last_login }]
```

### Next.js API Route — BFF 模式

```typescript
// app/api/dashboard/route.ts — 使用 better-sqlite3 替代 Supabase
// Source: [ASSUMED — better-sqlite3 官方文档模式]
import { NextRequest, NextResponse } from 'next/server'
import Database from 'better-sqlite3'
import path from 'path'

const db = new Database(path.join(process.cwd(), 'mwlab.db'), { readonly: true })

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const industryL2 = searchParams.get('industry_l2')
  const relation = searchParams.get('competition_relation')
  const mds = searchParams.get('mds_related')

  let where = 'WHERE 1=1'
  const params: any[] = []
  if (industryL2) { where += ' AND b.industry_l2 = ?'; params.push(industryL2) }
  if (relation && relation !== '全部') { where += ' AND b.competition_relation = ?'; params.push(relation) }
  if (mds && mds !== '全部') { where += ' AND b.mds_related = ?'; params.push(mds) }

  // KPI 聚合（使用最新届次数据）
  const kpiRow = db.prepare(`
    SELECT
      COALESCE(SUM(e.area_sqm), 0) as total_area,
      COALESCE(SUM(e.exhibitors_count), 0) as total_exhibitors,
      COALESCE(SUM(e.visitors_count), 0) as total_visitors,
      COUNT(DISTINCT b.organizer) as total_organizers
    FROM exhibition_brand b
    JOIN exhibition_edition e ON e.brand_id = b.brand_id
    ${where}
  `).get(...params)

  // 品牌列表
  const brands = db.prepare(`
    SELECT b.* FROM exhibition_brand b ${where} ORDER BY b.name_cn
  `).all(...params)

  // 行业分布
  const industryDistribution = db.prepare(`
    SELECT industry_l2 as name, COUNT(*) as value
    FROM exhibition_brand
    ${where}
    GROUP BY industry_l2
    ORDER BY value DESC
  `).all(...params)

  return NextResponse.json({ kpis: kpiRow, brands, industryDistribution })
}
```

### Dashboard 4 层 SQL 查询模式

```sql
-- Layer 1 — 概览 KPI（已有）
SELECT SUM(area_sqm), SUM(exhibitors_count), SUM(visitors_count), COUNT(DISTINCT organizer)
FROM exhibition_brand b JOIN exhibition_edition e ON e.brand_id = b.brand_id

-- Layer 2 — 行业分布
SELECT industry_l2, COUNT(*) as cnt
FROM exhibition_brand WHERE industry_l2 != ''
GROUP BY industry_l2 ORDER BY cnt DESC LIMIT 20

-- Layer 2 — 竞争关系分布
SELECT competition_relation, COUNT(*) as cnt
FROM exhibition_brand WHERE competition_relation != ''
GROUP BY competition_relation

-- Layer 3 — 城市聚合（地图）
SELECT e.city, COUNT(DISTINCT b.brand_id) as exhibition_count,
       GROUP_CONCAT(DISTINCT b.name_cn, ', ') as exhibition_names
FROM exhibition_brand b
JOIN exhibition_edition e ON e.brand_id = b.brand_id
WHERE e.city != ''
GROUP BY e.city ORDER BY exhibition_count DESC

-- Layer 3 — 国内外对比
SELECT b.is_international, COUNT(*) as cnt, SUM(e.area_sqm) as total_area
FROM exhibition_brand b JOIN exhibition_edition e ON e.brand_id = b.brand_id
GROUP BY b.is_international

-- Layer 4 — 品牌列表（含届次数）
SELECT b.*, COUNT(e.edition_id) as edition_count,
       MAX(e.year) as latest_year
FROM exhibition_brand b
LEFT JOIN exhibition_edition e ON e.brand_id = b.brand_id
GROUP BY b.brand_id ORDER BY b.name_cn
```

### Recommended Project Structure

```
mwlab-dashboard/
├── app/
│   ├── layout.tsx              # 根布局（MD Logo Sidebar, 字体 Inter）
│   ├── globals.css             # Tailwind + MD 品牌 Token
│   ├── page.tsx                # 重定向 → /dashboard
│   ├── login/
│   │   └── page.tsx            # 登录页（MD 品牌风格）
│   ├── dashboard/
│   │   ├── page.tsx            # Dashboard 容器
│   │   ├── layer-1-overview/   # 概览层组件
│   │   ├── layer-2-analysis/   # 分析层组件
│   │   ├── layer-3-geo/        # 地理层组件
│   │   └── layer-4-detail/     # 明细层组件
│   ├── calendar/
│   │   └── page.tsx            # 日历视图
│   ├── map/
│   │   └── page.tsx            # 简化地图
│   ├── setting/
│   │   └── page.tsx            # 设置页（admin only）
│   └── api/
│       ├── dashboard/route.ts  # BFF: 聚合查询 + 过滤
│       ├── brands/[id]/
│       │   ├── route.ts        # BFF: 品牌详情 (better-sqlite3)
│       │   └── tags/route.ts   # Proxy: → FastAPI PATCH tags
│       ├── calendar/route.ts   # BFF: 日历事件
│       ├── map/route.ts        # BFF: 地图标注
│       └── users/route.ts      # Proxy: → FastAPI GET users
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx        # 根布局壳（修改：MD Logo）
│   │   └── Sidebar.tsx         # 4 层导航（修改：MD 品牌色）
│   ├── dashboard/
│   │   ├── LayerTabs.tsx       # 4 层主 Tab 切换器
│   │   ├── SubTabs.tsx         # 每层内部的子 Tab
│   │   ├── KpiCardRow.tsx      # KPI 卡片行（科技感样式）
│   │   ├── KpiCard.tsx         # 单张 KPI 卡片（玻璃态）
│   │   ├── TrendBadge.tsx      # 趋势徽章（MD 橙色调）
│   │   ├── FilterTabs.tsx      # 三排过滤（MD 胶囊色）
│   │   ├── YearTrendChart.tsx  # 年比趋势图（recharts）
│   │   ├── RelationPieChart.tsx # 竞争关系饼图
│   │   ├── OrganizerTable.tsx  # 主办方排名表
│   │   └── BrandTable.tsx      # 品牌明细表
│   ├── charts/
│   │   └── IndustryPieChart.tsx # 行业分布饼图（保留，改色）
│   ├── map/
│   │   ├── MapView.tsx         # Leaflet 地图（简化版）
│   │   └── MarkerCluster.tsx   # 城市聚合标注（可选插件）
│   └── ui/
│       ├── GlassCard.tsx       # 玻璃态卡片通用组件
│       ├── Skeleton.tsx        # 骨架屏组件
│       └── ThemeToggle.tsx     # 深色/浅色主题切换
├── lib/
│   ├── db.ts                   # better-sqlite3 连接单例
│   ├── auth.ts                 # JWT 解码/验证工具函数
│   └── types.ts                # TypeScript 类型（保留，更新）
├── middleware.ts               # 路由守卫（验证 JWT token cookie）
└── tailwind.config.ts          # MD 品牌 Token（Tailwind v3 用，v4 用 CSS @theme）
```

### Pattern 1: better-sqlite3 连接单例

```typescript
// lib/db.ts — SQLite 连接管理 [ASSUMED: better-sqlite3 best practice]
import Database from 'better-sqlite3'
import path from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(process.cwd(), 'mwlab.db'), {
      readonly: true,       // BFF 层只读
      fileMustExist: true,  // 数据库不存在时报错
    })
    db.pragma('journal_mode = WAL')
    db.pragma('cache_size = -64000') // 64MB 缓存
  }
  return db
}

// API Routes 中使用：
// import { getDb } from '@/lib/db'
// const rows = getDb().prepare('SELECT ...').all(params)
```

### Pattern 2: Middleware JWT 验证（替代 Supabase）

```typescript
// middleware.ts — JWT Cookie 验证 [ASSUMED: 手写 JWT 验证模式]
import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose' // 或 jsonwebtoken

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret')

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('session')?.value
  const { pathname } = request.nextUrl

  // 公开路径
  if (pathname === '/login' || pathname.startsWith('/_next') || pathname.startsWith('/api/auth')) {
    return NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, JWT_SECRET)
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-email', payload.email as string)
    requestHeaders.set('x-user-role', payload.role as string)

    // admin-only 路由守卫
    if (pathname.startsWith('/setting') && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

### Pattern 3: Leaflet MarkerCluster 城市聚合

```typescript
// components/map/MapView.tsx — 简化的 Leaflet 地图 [CITED: leaflet + react-leaflet docs]
'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import 'leaflet/dist/leaflet.css'

const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
)

// MarkerCluster wrapper — 需要单独处理
// 使用 leaflet.markercluster + react-leaflet-cluster 或自行封装

export default function MapView() {
  const [markers, setMarkers] = useState<CityMarker[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/map/markers')
      .then(r => r.json())
      .then(data => {
        setMarkers(data.markers)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return <div className="h-[500px] bg-gray-100 rounded-xl animate-pulse" />
  }

  return (
    <MapContainer center={[35, 105]} zoom={4} className="h-[500px] rounded-xl z-0">
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a>'
      />
      {/* MarkerCluster 城市聚合标注 */}
      <MarkerCluster markers={markers} />
    </MapContainer>
  )
}
```

### Anti-Patterns to Avoid

- **继续使用 Supabase Auth**: 新决策 D-16 排除 Supabase，必须改为 FastAPI JWT。现有 lib/supabase/ 目录需要清理。
- **在 BFF 层做写操作**: `better-sqlite3` 以 `readonly` 模式打开数据库。写操作（标签 PATCH）必须走 FastAPI（含字段验证逻辑）。
- **Server Component 直接查询数据库**: `better-sqlite3` 是 Node.js 原生模块，在 Server Components 中可能引发问题。统一通过 API Routes 查询。
- **Dynamic import 忽略 Leaflet 地图**: 必须使用 `dynamic(() => import(...), { ssr: false })`，否则 "window is not defined"。
- **保留绿色调**: 旧 UI-SPEC 使用绿色（#22C55E）作为主色。新 MD 品牌使用橙色（#fe5c00）。必须全局替换。
- **混淆 app_metadata 和 user_metadata**: 无 Supabase 后不再适用。JWT payload 直接包含 `{ user_id, email, role }`。

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 图表渲染 | 自研 SVG/Canvas 图表 | recharts（已安装） | 饼图/柱状图已有成熟封装，PRD 无复杂图表需求 |
| 地图渲染 | 原生 Google Maps API / Canvas 地图 | Leaflet + react-leaflet（已安装） | D-07 锁定 Leaflet + OSM，免费无 API key |
| 日历视图 | 自研月/周日历 | react-big-calendar（已安装） | 月/周切换、事件渲染逻辑复杂，不应自研 |
| 数据库类型 | 手写 Interface | 从 init_db.sql 生成 | 已有 types.ts，保持同步即可 |
| 图标 | 自绘 SVG | lucide-react（已安装） | 标准开源图标库，MD 风格也可找近似图标 |
| JWT 签发 | 手写加密逻辑 | PyJWT / python-jose | 标准库，防签名绕过漏洞 |

**Key insight:** 项目已安装几乎所有所需库。核心工作是 **改造现有代码**，非从零搭建。最大工作量为：API 路由改写（Supabase → better-sqlite3 + FastAPI）、CSS 品牌色替换（绿色 → 橙色）、4 层 Layout 重构。

---

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | mwlab.db: 5,941 brands, 6,084 editions, SQLite 约 20MB | 代码层连接（无需迁移），BFF 以 readonly 模式打开 |
| Live service config | FastAPI tag_api.py 在 port 8000 运行 | 保留，新增 auth_api.py 在相同端口；scheduler.py 写入 SQLite — 不变 |
| OS-registered state | 无（所有代码在 git 中） | None |
| Secrets/env vars | `.env.local` 含 Supabase URL + keys（旧计划） | **需要更新**：移除 Supabase keys，添加 `JWT_SECRET`、`FASTAPI_URL=http://localhost:8000` |
| Build artifacts | `.next/` 和 `.open-next/` 目录（旧计划构建产出） | 建议清理后重建（`rm -rf .next .open-next`），避免旧构建污染 |

**重要变更：** 旧计划 .env.local 包含 `NEXT_PUBLIC_SUPABASE_URL` 等密钥。新计划应替换为：
```
JWT_SECRET=your-development-secret
FASTAPI_URL=http://localhost:8000
```

---

## Common Pitfalls

### Pitfall 1: better-sqlite3 在 Edge Runtime 中不可用
**What goes wrong:** 如果 API Route 使用了 `export const runtime = 'edge'`，`better-sqlite3` 的 Node.js 原生模块会报错。
**Why it happens:** Edge Runtime 不支持 Node.js 原生模块。
**How to avoid:** 在 `app/api/**/*/route.ts` 中不要设置 `runtime = 'edge'`，保持默认的 Node.js runtime（`export const runtime = 'nodejs'` 或省略——Next.js 16 默认 Node.js）。
**Warning signs:** 报错 "Cannot find module 'better-sqlite3'" 或 "Module not found"。

### Pitfall 2: MD 品牌色替换不彻底
**What goes wrong:** 部分组件仍使用绿色（#22C55E）而漏改为橙色（#fe5c00）。
**Why it happens:** 旧 UI-SPEC 大量使用绿色系 token（--color-accent / --color-accent-surface），全局搜索难以覆盖所有引用。
**How to avoid:** 在 globals.css 中重新定义 `--color-accent` 指向 `--md-orange`，然后逐个检查组件覆写。在 REVIEW 阶段使用 `grep -r "#22C55E\|green-"` 确认无残留。
**Warning signs:** 界面中出现绿色元素，与 MD Orange 不协调。

### Pitfall 3: Leaflet marker 图标在 production build 中缺失
**What goes wrong:** Leaflet 默认的蓝色 marker 图标在生产构建中显示为破碎的图标方块。
**Why it happens:** Leaflet 的默认 marker 图片路径在 webpack 打包后不正确。
**How to avoid:** 手动配置 marker icon URL（已有业界标准修复代码），或使用 `L.divIcon` / `CircleMarker`（本阶段推荐使用 CircleMarker 城市聚合，无需默认 marker icon）。
**Warning signs:** 地图标注显示为小方块或空白。

### Pitfall 4: react-big-calendar 缺少 CSS 导入
**What goes wrong:** 日历渲染出来但无样式，布局混乱。
**Why it happens:** react-big-calendar 需要手动导入 CSS。
**How to avoid:** 在 CalendarView 组件中顶部 `import 'react-big-calendar/lib/css/react-big-calendar.css'`；同时设置 `localizer`（使用已安装的 moment）。
**Warning signs:** 日历表格错位，无网格线。

### Pitfall 5: FastAPI CORS 限制前端调用
**What goes wrong:** Next.js dev server (localhost:3000) 向 FastAPI (localhost:8000) 发请求时被 CORS 拦截。
**Why it happens:** FastAPI 默认不允许跨域请求。
**How to avoid:** 在 FastAPI 中添加 CORS middleware：`app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000", "http://localhost:3001"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])`。
**Warning signs:** 浏览器 Console 报 CORS 错误。

### Pitfall 6: 4 层 Dashboard 数据加载体验差
**What goes wrong:** 每次切换 Layer 时都需重新加载数据，造成频繁 loading 状态。
**Why it happens:** 各 Layer 数据独立，组件卸载/挂载触发重复请求。
**How to avoid:** 使用 React Query（tanstack-query）或 SWR 做数据缓存和 stale-while-revalidate。保守方案：使用 `useRef` + `useEffect` + 首屏预加载所有 Layers 数据。
**Warning signs:** 用户切换 Tab 时看到白色 flash 或骨架屏闪烁。

### Pitfall 7: 玻璃态卡片（glassmorphism）影响可读性
**What goes wrong:** 玻璃效果（backdrop-filter: blur）导致文字虚化，尤其在小字号标签上。
**Why it happens:** backdrop-filter 和低对比度前景色组合引发的视觉模糊。
**How to avoid:** 玻璃态仅用于装饰性背景卡片（如侧边栏底部）。数据卡片保持 solid 背景 + 轻微阴影。文字始终使用高对比度（WCAG AA 4.5:1 以上）。
**Warning signs:** 用户反馈"看不清数字"。

---

## Code Examples

### FastAPI auth_api.py（新建文件）

```python
# auth_api.py — JWT 认证 API [ASSUMED: PyJWT + passlib 标准模式]
"""
启动: uvicorn auth_api:app --reload --port 8000（与 tag_api.py 同端口需用 router 合并）
或作为独立服务: uvicorn auth_api:app --reload --port 8001
"""
from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import jwt
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from passlib.context import CryptContext
from pydantic import BaseModel

BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "mwlab.db"
JWT_SECRET = os.environ.get("JWT_SECRET", "mwlab-dev-secret-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

app = FastAPI(title="MWLAB Auth API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    token: str
    email: str
    role: str
    display_name: str

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

@app.post("/api/auth/login", response_model=LoginResponse)
def login(req: LoginRequest):
    conn = get_db()
    user = conn.execute(
        "SELECT * FROM user WHERE email = ? AND is_active = 1",
        (req.email.strip().lower(),)
    ).fetchone()
    conn.close()

    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="邮箱或密码错误")

    payload = {
        "user_id": user["user_id"],
        "email": user["email"],
        "role": user["role"],
        "exp": datetime.utcnow() + timedelta(hours=JWT_EXPIRY_HOURS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    return LoginResponse(
        token=token,
        email=user["email"],
        role=user["role"],
        display_name=user["display_name"],
    )

@app.get("/api/auth/verify")
def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(
            credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM]
        )
        return {"valid": True, "email": payload["email"], "role": payload["role"]}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token 已过期")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="无效 Token")
```

### globals.css — MD 品牌 Token + 科技感基础样式

```css
@import "tailwindcss";

@theme {
  /* MD 品牌色板 — 从 CD Manual 提取 [VERIFIED: PDF] */
  --color-md-orange: #fe5c00;
  --color-md-orange-dark: #e55300;
  --color-md-red: #FF3400;
  --color-md-magenta: #e60070;
  --color-md-light-orange: #ff8c00;
  --color-md-yellow: #ffc500;
  --color-md-grey: #9c9c9c;

  /* 语义 Token */
  --color-surface: #F4F6F8;
  --color-surface-card: #FFFFFF;
  --color-accent: var(--color-md-orange);
  --color-accent-dark: var(--color-md-orange-dark);
  --color-accent-surface: #fff3ec;     /* MD Orange 10% 透明 */
  --color-destructive: #EF4444;
  --color-border: #E5E7EB;
  --color-text-primary: #111827;
  --color-text-secondary: #6B7280;

  /* 科技感增强 */
  --color-glass-bg: rgba(255, 255, 255, 0.7);
  --color-glass-border: rgba(255, 255, 255, 0.3);

  /* 布局常量 */
  --spacing-sidebar: 220px;
  --spacing-nav-item: 44px;
}

@layer base {
  html {
    font-family: "Inter", "Arial", ui-sans-serif, system-ui, -apple-system, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  body {
    color: var(--color-text-primary);
    background-color: var(--color-surface);
  }
}

/* 玻璃态卡片（装饰用） */
@layer components {
  .glass-card {
    background: var(--color-glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--color-glass-border);
    border-radius: 12px;
  }
  .kpi-value {
    font-size: 2.25rem;
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.02em;
  }
}
```

### KpiCard — 科技感版本（MD Orange 主色调）

```tsx
// components/dashboard/KpiCard.tsx — 科技感高对比度
interface KpiCardProps {
  label: string
  value: number | null
  unit?: string
  trend?: '上升' | '平稳' | '下降' | null
  variant?: 'highlight' | 'standard' | 'glass'
}

export default function KpiCard({ label, value, unit, trend, variant = 'standard' }: KpiCardProps) {
  const bgClass = variant === 'highlight'
    ? 'bg-accent-surface border border-md-orange/20'
    : variant === 'glass'
    ? 'glass-card'
    : 'bg-surface-card border border-border shadow-sm'

  return (
    <div className={`flex-1 min-w-[180px] rounded-xl p-5 ${bgClass}
      transition-all duration-150 ease hover:-translate-y-px
      hover:shadow-[0_8px_24px_rgba(254,92,0,0.12)]`}
    >
      <div className="text-xs font-normal text-text-secondary uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="flex items-baseline">
        <span className="kpi-value text-text-primary">{value?.toLocaleString('en-US') ?? '--'}</span>
        {unit && <span className="text-sm text-text-secondary ml-1">{unit}</span>}
      </div>
      {trend && <TrendBadge trend={trend} />}
    </div>
  )
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Supabase Auth + RLS | FastAPI JWT (PyJWT + passlib) | 2026-05-07 replan | 移除 @supabase/ssr 依赖，新建 auth_api.py，middleware 重写 |
| Supabase PostgreSQL | SQLite mwlab.db (better-sqlite3) | 2026-05-07 replan | API Routes 从 supabase.from() 改为 better-sqlite3 查询 |
| Hirezy 绿色主题 (#22C55E) | MD 橙色主题 (#fe5c00) | 2026-05-07 replan | globals.css 全部 Token 重定义，组件色值覆盖 |
| 单页 3-Filter Dashboard | 4 层 x 4-6 Tab Dashboard | 2026-05-07 replan | 组件树重构，新增 LayerTabs/SubTabs 导航 |
| Next.js API Routes 全部 Supabase | 混合：BFF (better-sqlite3) + FastAPI Proxy | 2026-05-07 replan | API 层拆分，读写分离 |
| @opennextjs/cloudflare | 本地 SQLite 直连（无 Cloudflare） | 2026-05-07 replan | wrangler.jsonc 不再需要，部署目标待定 |

**Deprecated/outdated (在项目中可安全清理):**
- `lib/supabase/` 整个目录（server.ts, client.ts, middleware.ts）— 替换为 JWT-based auth
- `supabase/migrations/` — 不需要迁移到 PostgreSQL
- `scripts/seed-users.ts` — 改为 Python seed 脚本直接写 SQLite `user` 表
- `wrangler.jsonc`、`open-next.config.ts` — Cloudflare 部署配置不再需要

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | better-sqlite3 在 Next.js API Routes（Node.js runtime）中无兼容问题 | Architecture | 如不兼容，需全部走 FastAPI 代理，增加延迟和开发量 |
| A2 | SQLite `user` 表中已有 password_hash 字段用 bcrypt 哈希 | Auth | 如密码是明文或其他哈希，需要迁移脚本；已在 init_db.sql 确认是 password_hash 字段 |
| A3 | Passlib 的 bcrypt 可验证现有 password_hash | Auth | 如现有密码不是 bcrypt，需要重置所有用户密码 |
| A4 | 深色主题优先级低于浅色主题（D-09 可选） | UI | 如用户要求必须同时交付深色主题，需要额外 CSS 变量 + ThemeToggle |
| A5 | JWT_SECRET 可以通过环境变量注入 | Security | 硬编码 secret 在生产环境存在安全风险 |

---

## Open Questions

1. **FastAPI auth_api.py 合并还是独立？**
   - What we know: tag_api.py 是单一 FastAPI 实例，在 port 8000 运行。
   - What's unclear: 应该将 auth 端点并入 tag_api.py，还是新建 auth_api.py 独立运行（不同端口）。
   - Recommendation: **并入 tag_api.py**（添加 `/api/auth/login` 路由），避免多端口运维复杂性。在 tag_api.py 顶部添加 CORS middleware。

2. **现有 user 表密码格式？**
   - What we know: SQLite `user` 表有 `password_hash` TEXT 字段。
   - What's unclear: 现有数据的密码是 bcrypt 格式还是明文？需要先查看样本数据。
   - Recommendation: Wave 0 先检查 `SELECT password_hash FROM user LIMIT 1`，如果是明文就运行一次性迁移脚本 `python scripts/hash-passwords.py`。

3. **Leaflet MarkerCluster 插件选择？**
   - What we know: 需要城市级聚合标注，不使用 D3/Deck.gl。
   - What's unclear: react-leaflet-cluster vs 手写 Leaflet.markercluster 封装。
   - Recommendation: 使用 `react-leaflet-cluster`（轻量，1.4K stars）或纯 Leaflet.markercluster + useEffect 集成。因城市标注数量不超过 200 个，甚至可不使用聚合插件，直接用 CircleMarker 聚合（一个城市一个圆点）。

4. **部署目标？**
   - What we know: 旧计划用 Cloudflare Workers，新决策未指定。
   - What's unclear: 最终部署到哪里（本地服务器、VPS、Cloudflare）。
   - Recommendation: 开发阶段 `npm run dev` 本地运行。部署可后续决定（Next.js 标准部署到任何 Node.js 主机）。保留 Dockerfile 选项。

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Next.js dev/build | yes | 22.x | -- |
| npm | 包管理 | yes | 11.x | -- |
| Python 3.12+ | FastAPI backend (auth + tag) | yes | 3.12 | -- |
| better-sqlite3 | BFF 数据查询 | yes | ^11.9.1 | FastAPI proxy 全部数据请求 |
| FastAPI | 认证 + 打标 API | yes (tag_api.py) | Python | -- |
| bcrypt/passlib | 密码验证 | no | -- | 需 pip install |
| PyJWT | JWT 签发 | no | -- | 需 pip install |

**Missing dependencies with no fallback:**
- passlib[bcrypt] + pyjwt: 初始化 FastAPI auth 前必须先安装（pip install passlib[bcrypt] pyjwt）

**Missing dependencies with fallback:**
- 无（所有核心库已安装）

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react |
| Config file | vitest.config.ts（已有） |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| UI-POOL-AUTH | 未登录访问 /dashboard 重定向到 /login | integration | `vitest run tests/middleware.test.ts` | ❌ Wave 0 |
| UI-POOL-AUTH | POST /api/auth/login 返回 JWT（正确密码） | unit | `pytest tests/test_auth_api.py -x -k test_login_success` | ❌ Wave 0 |
| UI-POOL-AUTH | POST /api/auth/login 返回 401（错误密码） | unit | `pytest tests/test_auth_api.py -x -k test_login_fail` | ❌ Wave 0 |
| UI-POOL-DASH | GET /api/dashboard 返回 KPI + brands + distribution | integration | `vitest run tests/api/dashboard.test.ts` | ❌ Wave 0 |
| UI-POOL-MAP | GET /api/map/markers 返回城市聚合数据 | integration | `vitest run tests/api/map.test.ts` | ❌ Wave 0 |
| UI-POOL-TAGS | PATCH /api/brands/{id}/tags 写入 + 记录历史 | integration | `pytest tests/test_tag_api.py -x` | ✅ Wave 0（已有 tag_api 测试） |
| UI-POOL-MD-COLORS | CSS 中无绿色 (#22C55E) 残留 | lint/check | `grep -r "#22C55E\|green-" app/ components/ --include='*.{tsx,css}'` | ❌ Wave 0 |
| UI-POOL-4LAYER | Layer 1-4 切换不报错 | manual | 浏览器手动验证 | -- |

### Wave 0 Gaps

- [ ] `tests/middleware.test.ts` — JWT 路由守卫测试
- [ ] `tests/api/dashboard.test.ts` — better-sqlite3 聚合查询测试
- [ ] `tests/api/map.test.ts` — 地图标注查询测试
- [ ] `tests/test_auth_api.py` — FastAPI auth 端点测试（pytest）
- [ ] 清理 `lib/supabase/` 目录
- [ ] `pip install passlib[bcrypt] pyjwt`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | FastAPI auth_api.py — email + password, bcrypt hash, JWT token |
| V3 Session Management | yes | JWT 24h expiry, httpOnly cookie + Authorization header |
| V4 Access Control | yes | middleware.ts 路由守卫 + JWT role claim |
| V5 Input Validation | yes | Pydantic 模型验证（FastAPI）+ better-sqlite3 参数化查询 |
| V6 Cryptography | yes | bcrypt 密码哈希（passlib），JWT HMAC-SHA256（PyJWT） |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL 注入（BFF 层） | Tampering | better-sqlite3 参数化查询（`?` 占位符），禁止字符串拼接 |
| JWT 伪造 | Spoofing | PyJWT HS256 签名验证，secret 通过环境变量注入 |
| 密码暴力破解 | Tampering | Login 速率限制（可选：前端 3 次后增加延迟） |
| 未授权访问 Dashboard | Information Disclosure | middleware.ts 路由守卫 + API 层 JWT 验证双重保护 |
| 打标 API 越权修改 | Tampering | FastAPI 中验证 JWT role（admin/manager 才可打标） |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: Messe Düsseldorf Corporate Design Manual PDF pages 6, 24-26, 28-30] — 品牌色板（MD Orange #fe5c00, MD Red #FF3400, MD Magenta #e60070, MD Light Orange #ff8c00, MD Yellow #ffc500, MD Grey #9c9c9c）、字体（Inter）、网格系统
- [VERIFIED: schema/init_db.sql] — SQLite Schema 6 张表字段定义
- [VERIFIED: npm registry — package.json] — 所有已安装依赖版本确认
- [VERIFIED: Codebase exploration] — 现有 app/、components/、lib/ 文件结构分析
- [VERIFIED: tag_api.py] — 现有 FastAPI 端点（health / brands / tags）

### Secondary (MEDIUM confidence)
- [ASSUMED: better-sqlite3 npm docs] — 同步查询模式和连接管理最佳实践
- [ASSUMED: PyJWT + passlib 标准模式] — FastAPI JWT 认证常见实现模式
- [CITED: react-leaflet docs] — MapContainer, TileLayer, CircleMarker API
- [CITED: recharts docs] — PieChart, BarChart, Tooltip API
- [CITED: react-big-calendar docs] — Calendar, momentLocalizer, event styling

### Tertiary (LOW confidence)
- [ASSUMED] — Leaflet MarkerCluster 插件在 react-leaflet 5.x 中的兼容性（未实测）
- [ASSUMED] — better-sqlite3 在 Next.js 16 App Router 中的稳定表现（未实测）

---

## Metadata

**Confidence breakdown:**
- MD Brand Colors: HIGH — 直接从 CD Manual PDF 页面 6、24-26 提取 hex 值
- Standard Stack: HIGH — 所有库已安装，版本号从 package.json 确认
- Architecture: MEDIUM — BFF 混合架构基于现有代码环境推断，实际性能需验证
- Auth Implementation: MEDIUM — 新建 auth_api.py 模式为标准 FastAPI JWT 实现，但现有 user 表密码格式未知
- 4-Layer Dashboard: MEDIUM — Tab 结构和 SQL 查询基于数据表分析，具体 UX 需在实现中调整
- Pitfalls: HIGH — 大部分基于已知的技术限制（Edge runtime、Leaflet SSR、CORS）

**Research date:** 2026-05-07  
**Valid until:** 2026-06-07（Next.js 和 FastAPI 版本稳定，30 天内有效）

---

## 执行建议

### Wave 0（基础设施 — 30 分钟）
1. `pip install passlib[bcrypt] pyjwt` — Python 依赖
2. 检查 `SELECT password_hash FROM user LIMIT 1` — 确认密码格式
3. 创建 `auth_api.py`（扩展 tag_api.py 或独立）— 含 login + verify 端点
4. 更新 `.env.local` — 移除 Supabase keys，添加 `JWT_SECRET`、`FASTAPI_URL`
5. 清理 `lib/supabase/` 目录
6. 清理 `supabase/migrations/`、`wrangler.jsonc`、`open-next.config.ts`
7. `rm -rf .next .open-next`（旧构建产出）

### Wave 1（核心架构 — 2 小时）
1. 创建 `lib/db.ts` — better-sqlite3 单例
2. 重写 `app/api/dashboard/route.ts` — better-sqlite3 聚合查询
3. 重写 `app/api/map/markers/route.ts` — better-sqlite3 城市聚合
4. 重写 `app/api/calendar/events/route.ts` — better-sqlite3 届次查询
5. 重写 `app/api/brands/[id]/route.ts` — better-sqlite3 品牌详情
6. 重写 `middleware.ts` — JWT cookie 验证（替换 Supabase）

### Wave 2（MD 品牌重塑 — 1.5 小时）
1. 更新 `globals.css` — 全部 Token 替换为 MD 色板
2. 更新 `app/layout.tsx` — Inter font + MD Logo
3. 更新 `components/layout/Sidebar.tsx` — MD 品牌色 + 4 层导航
4. 更新 `components/layout/AppShell.tsx` — 4 层布局骨架
5. 更新 `components/ui/KpiCard.tsx` — 科技感 + MD 橙色调
6. 更新 `components/ui/FilterTabs.tsx` — MD 橙色胶囊选中态
7. 更新 `components/ui/TrendBadge.tsx` — 橙色系趋势徽章

### Wave 3（4 层 Dashboard — 2 小时）
1. 创建 `components/dashboard/LayerTabs.tsx` — 4 层切换器
2. 创建 `components/dashboard/SubTabs.tsx` — 层内 Tab
3. 创建 `app/dashboard/layer-1-overview/` — KPI 大卡 + 趋势 + 集团
4. 创建 `app/dashboard/layer-2-analysis/` — 行业/竞争/MDS 分析
5. 创建 `app/dashboard/layer-3-geo/` — 地图/城市/场馆
6. 创建 `app/dashboard/layer-4-detail/` — 品牌列表/搜索/导出
7. 重构 `app/dashboard/page.tsx` — 整合四层导航

### Wave 4（地图 + 日历简化 — 1 小时）
1. 简化 `components/map/MapView.tsx` — 移除热力图/路径线，仅 MarkerCluster
2. 更新 `app/map/page.tsx` — dynamic import
3. 更新 `components/calendar/CalendarView.tsx` — MD 品牌色调
4. 更新 `app/calendar/page.tsx` — dynamic import

### Wave 5（登录 + 设置 + 验证 — 1 小时）
1. 更新 `app/login/page.tsx` — MD Logo + JWT login flow
2. 更新 `app/setting/page.tsx` — admin-only 用户管理 + 爬虫状态
3. 数据验证：KPI 数字准确性、过滤联动、地图聚合数量

### REVIEW 清单
- [ ] `grep -r "#22C55E\|green-" app/ components/ --include='*.{tsx,css}'` — 0 残留
- [ ] `grep -r "supabase" app/ lib/ components/ --include='*.{tsx,ts}'` — 0 引用
- [ ] `npx vitest run` — 绿
- [ ] `npm run dev` + 浏览器验证 4 层切换
- [ ] VS Code `Ctrl+Shift+P` → `Simple Browser` → `http://localhost:3000` → UI audit with gstack /browse
