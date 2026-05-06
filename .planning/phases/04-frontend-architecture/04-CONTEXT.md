# Phase 4: 前端架构全面迁移 + Dashboard UI - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

本 Phase 交付完整的可访问前端系统：技术栈从 FastAPI+SQLite 全面迁移至 Next.js+Supabase，实现用户登录、Dashboard数据可视化、Calendar展会日历、Map地理分布四个模块，并部署至 Cloudflare Pages（域名已购）。

Phase 1b（全集采集）和 Phase 3b（打标工具）与本 Phase 并行推进，不构成前端启动的前置阻塞。

</domain>

<decisions>
## Implementation Decisions

### 技术栈 & 部署

- **D-01:** 前端框架 → **Next.js**（React生态，SSR/SSG均可，Cloudflare Pages原生支持）
- **D-02:** 前端托管 → **Cloudflare Pages**（域名已购，免费，静态+Edge Functions）
- **D-03:** 数据库 → **Supabase PostgreSQL**（免费层，500MB存储，当前数据约10MB，足够）
- **D-04:** 认证系统 → **Supabase Auth**（email+password，替代现有 FastAPI JWT）
- **D-05:** 后端逻辑 → **Next.js API Routes**（替代FastAPI，TypeScript实现，部署在CF Pages的Edge Functions）
- **D-06:** 现有 FastAPI（`tag_api.py`、`merge_engine.py`等Python代码）→ **废弃，功能在API Routes中重写**

> 注：Cloudflare Pages不支持Python运行时，FastAPI无法直接迁移，需要用TypeScript重写业务逻辑。

### UI 界面结构

- **D-07:** 左侧边栏4项 →
  - Dashboard（所有角色可见）
  - Calendar（所有角色可见）
  - Map（所有角色可见）
  - Setting（**仅 admin 可见**）
- **D-08:** 界面参考风格 → Hirezy Dashboard（Image #1）：白色背景，圆角卡片，绿色主色调，浅紫色辅色卡片，现代简洁扁平风格
- **D-09:** Dashboard 三排过滤 Tab（与PRD §5三个点选控件完全对齐）：
  - **排1（行业筛选）**：单选 industry_l1，联动显示 industry_l2 子选项
  - **排2（关系筛选）**：多选：全部 / 竞争对手 / 潜在伙伴 / 新进入者
  - **排3（MDS相关性）**：单选：全部 / MFC / Reha China / 无
- **D-10:** Dashboard KPI卡片区（与Image #2卡片样式完全一致，大数字+趋势徽章）：
  - 卡片1：**展览面积**（area_sqm，显示过滤后总量，单位㎡）
  - 卡片2：**展商数量**（exhibitors_count，过滤后合计）
  - 卡片3：**观众数量**（visitors_count，过滤后合计）
  - 卡片4：**展览集团**（organizer字段去重计数，即有多少个不同主办方）
  - 趋势徽章：**年比年趋势**（yoy_trend字段，上升/平稳/下降 → 绿/灰/红 + ↑/→/↓）
  - 图表区：**行业标签细分**（industry_l2分布，参考Image #2"Application by Department"圆饼图样式）

### 登录 & 账号系统

- **D-11:** 登录方式 → 账号密码登录（Supabase Auth，email+password，无SSO/OAuth）
- **D-12:** 账号总数 → 30个账号（Supabase免费层支持）
- **D-13:** 权限角色 → 延用现有三角色定义（Phase 3已实现）：
  - `admin`：全功能 + Setting页 + 打标权限
  - `manager`：Dashboard + Calendar + Map + 打标权限，无Setting
  - `readonly`：Dashboard + Calendar + Map，仅查看，不可打标
- **D-14:** 账号初始化 → **seed脚本**（`scripts/seed-users.ts`），包含30个账号+密码+角色，一次性执行，账号修改通过Supabase控制台
- **D-15:** Admin密码 → 通过seed脚本单独设置（明文写在seed脚本的环境变量中，`.env.local`隔离）

### Calendar 模块

- **D-16:** 功能范围 → **展会日历视图**：按月/周视图显示展会 `date_start`/`date_end`，点击展会显示详情弹窗（name_cn, venue, city, exhibitors_count）

### Map 模块

- **D-17:** 功能范围 → **全球展会地理分布图**（国内+国际），按 `city` 字段聚合展会数量，热力点显示。推荐使用 Leaflet（免费，无API Key限制）

### Phase 执行顺序

- **D-18:** Phase 1b（Hermes全集采集）与 Phase 4（前端开发）**并行推进**，互不阻塞
- **D-19:** Phase 3b（Cursor打标工具）与 Phase 4（前端开发）**并行推进**
- **D-20:** 前端开发初期可连接现有 SQLite 数据（3.4K条）进行界面开发和验证，Supabase 迁移完成后无缝切换

### Agent 分工

- **D-21:** **CC（Claude Code）**→ Phase 4 架构层：Next.js项目初始化、Supabase接入配置、DB Schema迁移（SQLite→PostgreSQL）、Next.js API Routes设计与实现、Supabase Auth接入
- **D-22:** **Cursor**→ 界面开发主力：所有页面组件实现（Dashboard/Calendar/Map/Login/Setting），在CC定义的API Routes和数据结构上开发
- **D-23:** **Claude Design**（一次性）→ 在CC完成项目初始化后、Cursor开始界面开发前，生成完整UI规范（Tailwind配置、颜色Token、组件样式规范），Cursor照规范实现
- **D-24:** **Hermes**→ 继续执行 Phase 1b（Jufair全集补采5K条 + cnexpo全量 + 合并引擎），与前端并行

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### PRD & 需求

- `MWLAB-2026-PRD-v1.1-merged.md` §5 — 前端约束（3个点选控件定义，严格遵守）
- `MWLAB-2026-PRD-v1.1-merged.md` §3 — 数据架构（6张表字段定义，展览面积/展商/观众字段来源）
- `MWLAB-2026-PRD-v1.1-merged.md` §6 — 部署目标（域名、用户管理30人上限）
- `MWLAB-2026-PRD-v1.1-merged.md` §7 Phase 4 — UI/UX范围定义

### 数据架构

- `schema/init_db.sql` — 当前SQLite Schema（6张表），迁移至PostgreSQL时的参照
- `AGENTS.md` — 数据字段定义权威来源、文件索引

### 现有实现（待废弃/参考）

- `tag_api.py` — 现有打标API逻辑（TypeScript重写时的参照）
- `merge_engine.py` — 合并引擎逻辑（仅参考，不迁移）

### 状态

- `.planning/STATE.md` — 当前Phase状态
- `.planning/ROADMAP.md` — Phase定义和顺序

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `schema/init_db.sql`：6张表的完整DDL，直接转为PostgreSQL语法（SQLite→PostgreSQL差异极小，主要是AUTO INCREMENT→SERIAL/BIGSERIAL，BLOB→BYTEA）
- `tag_api.py`：打标API的业务逻辑（PATCH /api/brands/{id}，manual_tag_history写入），作为 Next.js API Routes 实现的参照
- 现有 JWT 3角色系统（admin/manager/readonly）：角色定义迁移到 Supabase Auth metadata

### Established Patterns
- 字段命名全部 `snake_case`（保持，Supabase PostgreSQL一致）
- API端点风格：`/api/资源-名/动作`，小写连字符（保持）
- 数据源双优先级规则（展商/观众数/面积取较大值）：在API Routes查询层实现

### Integration Points
- Phase 1b 的爬虫（Hermes）直接写入 Supabase PostgreSQL，无需中间层
- Phase 3b 的 Excel 导入工具（`tools/import_tags.py`）需改为连接 Supabase 而非本地SQLite
- Supabase Row Level Security（RLS）实现角色权限控制

</code_context>

<specifics>
## Specific Ideas

- **界面参考**：`dashboard_references.png`（项目根目录）— Hirezy风格截图，左侧边栏+顶部KPI卡片+图表区布局
- **KPI卡片样式**：完全参照Image #2结构：高亮主卡（绿色背景大数字）+ 3个次级卡（白色背景），每卡有趋势徽章（↑↓→ + 百分比）
- **三排Tab风格**：pill样式（圆角胶囊形），选中态绿色，与侧边栏选中态一致
- **Setting页**：仅admin可见（侧边栏中条件渲染）；初期功能：用户列表展示 + 数据更新状态面板
- **地图库**：Leaflet（开源免费，无需API Key，Cloudflare Pages可直接使用）

</specifics>

<deferred>
## Deferred Ideas

- **打标前端界面**（Setting页内嵌打标功能）→ Phase 5 或 Phase 3b 扩展，当前 Setting 仅做用户管理
- **AI推荐功能**（PRD已明确不做）→ 永久排除
- **移动端适配** → 当前为桌面端大屏优先，移动端未定义

</deferred>

---

*Phase: 04-frontend-architecture*
*Context gathered: 2026-05-06*
