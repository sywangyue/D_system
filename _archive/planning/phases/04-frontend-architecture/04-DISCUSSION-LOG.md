# Phase 4: 前端架构全面迁移 + Dashboard UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 04-frontend-architecture
**Areas discussed:** 前端技术栈+Cloudflare部署, PostgreSQL平台+迁移时机, Calendar/Map功能范围, 账号管理方式, Phase执行顺序+Agent分工, Dashboard布局

---

## 前端技术栈

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js | React生态，SSR/SSG，Cloudflare Pages原生支持 | ✓ |
| React SPA | 纯静态，部署最简单，无SSR | |
| Vue 3 + Nuxt | 语法简洁，国内开发者友好 | |

**User's choice:** Next.js
**Notes:** 用户直接选择推荐选项，无额外说明

---

## 后端部署平台

| Option | Description | Selected |
|--------|-------------|----------|
| Railway | Python+PostgreSQL一起部署，Docker导入，$5-20/月 | |
| Render | 类似Railway，免费层会休眠 | |
| 自管VPS | 完全控制，运维成本高 | |
| **免费方案（用户提出）** | Cloudflare Pages + Supabase，DB约10MB | ✓ |

**User's choice:** 询问能否用免费方案（Vercel/Cloudflare + Supabase）
**Notes:** 用户主动提出免费方案需求，数据库只有10MB

---

## 后端架构取舍

| Option | Description | Selected |
|--------|-------------|----------|
| 抛弃FastAPI，全面免费 | 业务逻辑迁入Next.js API Routes，Supabase Auth替代JWT | ✓ |
| 保留FastAPI + Supabase PostgreSQL | FastAPI换PostgreSQL，部署到Fly.io免费层或Railway | |

**User's choice:** 抛弃FastAPI，全面免费
**Notes:** 用户明确接受现有Python代码废弃，换取零运维费用

---

## Calendar 模块

| Option | Description | Selected |
|--------|-------------|----------|
| 展会日历视图 | 按月/周显示即将举办的展会，点击看详情 | ✓ |
| 日期过滤器 | Calendar只是Dashboard的日期筛选控件 | |
| 先占位后期再设计 | 当前仅显示"开发中"占位符 | |

**User's choice:** 展会日历视图

---

## Map 模块

| Option | Description | Selected |
|--------|-------------|----------|
| 中国城市分布 | 国内展会热力图，按city聚合 | |
| 全球展会分布 | 国内+国际全部，全球地图 | ✓ |
| 先占位后期再设计 | 当前仅显示"开发中"占位符 | |

**User's choice:** 全球展会分布

---

## 账号创建方式

| Option | Description | Selected |
|--------|-------------|----------|
| seed脚本初始化 | 写seed.ts，包含30个账号+密码+角色，一次性执行 | ✓ |
| Admin管理界面 | 前端Setting页做增删账号功能，工作量更大 | |

**User's choice:** seed脚本初始化
**Notes:** 账号修改通过Supabase控制台直接操作

---

## 权限角色定义

| Option | Description | Selected |
|--------|-------------|----------|
| 延用现有三角色 | admin/manager/readonly，Phase 3已定义 | ✓ |
| 重新定义角色 | 用户未提出新需求 | |

**User's choice:** 延用现有三角色

---

## Phase执行顺序

| Option | Description | Selected |
|--------|-------------|----------|
| 并行推进 | 1b+3b由Hermes/Cursor执行，前端同时开工 | ✓ |
| 串行（先数据再前端） | 等全集数据完成再启动前端，确保数据完整 | |

**User's choice:** 并行推进
**Notes:** 前端可先用现有3.4K数据开发，不等全集采集完成

---

## Agent分工

| Option | Description | Selected |
|--------|-------------|----------|
| CC: 架构设计+DB迁移 | Next.js初始化、Supabase接入、API Routes设计 | ✓ |
| Cursor: 界面开发主力 | 所有页面组件，在CC定义的架构上开发 | ✓ |
| Claude Design: 界面规范 | 一次性生成Tailwind配置和组件样式规范 | ✓ |
| Hermes: 1b全集采集 | 继续Phase 1b，与前端并行 | ✓ |

**User's choice:** 全选（CC+Cursor+Claude Design+Hermes）
**Notes:** Claude Design在CC完成初始化后、Cursor开始界面前使用（一次性）

---

## Dashboard布局

| Option | Description | Selected |
|--------|-------------|----------|
| 三排过滤tab | 行业/关系/MDS三排选择器，与PRD §5完全对齐 | ✓ |
| 三排KPI卡片 | 面积/展商/观众/集团四张大卡+趋势图+列表 | |
| 过滤tab+KPI卡片组合 | 上半过滤，下半KPI和展会列表 | |

**User's choice:** 三排过滤tab
**Notes:** 确认PRD §5的三个点选控件以"排"形式展现（pill tab样式）

---

## Claude's Discretion

- 地图库选型 → Leaflet（开源免费，无API Key）
- KPI卡片下方图表类型 → 圆饼图（参考Image #2 "Application by Department"样式）
- Supabase Row Level Security 实现权限控制的具体策略

## Deferred Ideas

- **打标前端界面**（Setting页内嵌）→ Phase 5 或 Phase 3b 扩展
- **AI推荐功能** → PRD已明确永久排除
- **移动端适配** → 未来另立Phase
