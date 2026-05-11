# ECD · Claude Code 整改指令集

**性质**: 分批执行的架构简化指令  
**执行规则**: 每批完成后等待客户确认再进入下一批，不跳批，不自行合并  
**禁止**: 自行引入任何新的框架、服务或依赖  

---

## 前置任务：全局摸底 ✅ 已完成（2026-05-09）

**结论摘要**：
- Supabase 为僵尸依赖：包已安装、env 有值，源码零引用
- FastAPI 拆分为两个文件（auth_api.py / tag_api.py），决策见下方架构说明
- 数据流已是 Next.js API Routes → SQLite 直连，无缓存层
- 共 62 个 .md 文档，根目录 5 个有效文档，其余在 .planning/
- mwlab.db 共 9 张表，核心数据：品牌 5,941 条、届次 6,084 条

**架构决策（已与用户确认）**：  
数据月更、用户 3 人、纯查询看板场景下，FastAPI 是过度设计。  
目标架构：`Browser → Next.js（前端 + API Routes）→ SQLite`，一个进程，一种语言。  
auth 和 tags 两个功能迁入 Next.js API Routes 后，auth_api.py 和 tag_api.py 整体删除。

---

## 第一批：清除 Supabase ✅ 已完成（2026-05-09）

**执行结果**：

| 操作 | 内容 |
|------|------|
| 卸载 npm 包 | `@supabase/ssr`、`@supabase/supabase-js`（共移除 11 个包） |
| 清理 .env.local | 删除 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` |
| 占位注释 | 无需——源码中本无任何 Supabase import 或调用 |

**启动状态**：TypeScript 编译零错误，无任何 Supabase 残留引用。

---

## 第二批：拆除 FastAPI，迁移 Auth + Tags 进 Next.js ✅ 已完成（2026-05-09）

**执行结果**：

| 操作 | 内容 |
|------|------|
| 新建 `app/api/auth/login/route.ts` | bcryptjs 验密码 + jose 签 JWT + 更新 last_login，直接读写 mwlab.db |
| 新建 `app/api/auth/logout/route.ts` | 清除 session Cookie |
| 更新 `app/login/page.tsx` | fetch 目标从 `localhost:8000/api/auth/login` 改为 `/api/auth/login` |
| 更新 `app/api/brands/[id]/tags/route.ts` | 移除代理，改为直接写 SQLite（UPDATE + INSERT manual_tag_history） |
| 更新 `app/api/filter-options/route.ts` | 移除 FastAPI proxy，改为直接 getDb() 查 distinct 值 |
| 更新 `lib/db.ts` | 新增 `getWritableDb()`，供写操作使用（每次新建连接，用完关闭） |
| 更新 `components/settings/SystemInfoBlock.tsx` | 移除 FastAPI URL 展示行 |
| 删除 `auth_api.py` | FastAPI 认证服务 |
| 删除 `tag_api.py` | FastAPI 打标服务 |
| 安装 `bcryptjs` + `@types/bcryptjs` | 密码验签 |

**编译状态**：TypeScript 零错误，零残留 FastAPI 引用。  
**进程数变化**：启动时只需运行 `next dev`，无需再单独启动 `uvicorn`。

---

## 第三批：数据同步层清理 ✅ 已完成（2026-05-09）

**实际发现**：同步层从未真正实现。`sync_queue` 表不存在于 schema 和 DB，Python 脚本中无任何 Supabase 引用，无 WebSocket 或实时订阅代码。无需清理同步层本身。

**实际执行**：清理第二批删除 `tag_api.py` 后遗留的破损引用。

| 操作 | 内容 |
|------|------|
| 修复 `tools/import_tags.py` | 移除 `from tag_api import ...`，内联 `DB_PATH`、`TAGGABLE_FIELDS`、`validate_value` |
| 修复 `tools/export_for_tagging.py` | 移除 `from tag_api import ...`，内联 `DB_PATH`、`TAGGABLE_FIELDS` |
| 修复 `tests/test_tagging_tools.py` | 将 `from tag_api import TAGGABLE_FIELDS` 改为 `from tools.import_tags import TAGGABLE_FIELDS` |
| 删除 `tests/test_tag_api.py` | 完全依赖已删除的 `tag_api.py`，无法运行 |
| 清理 `lib/auth.ts` 注释 | 删除过时的 "替代 Supabase Auth 客户端" 注释 |

**数据链路确认**（已通畅）：  
`crawlers/*.py` → `mwlab.db` → `Next.js API Routes (better-sqlite3)` → 前端

**编译状态**：Python 语法检查全部通过，TypeScript 零错误，零残留 `tag_api`/`auth_api`/`supabase` 引用。

---

## 第四批：UI 层简化 ✅ 已完成（2026-05-09）

**审查结论：**

| 检查项 | 结果 |
|--------|------|
| 不可见组件 | `TrendBadge`：KpiCardRow 从不传 trend → 永远 render null（API 无此字段）；`EventModal`：点击日历才出现 |
| 状态传递链深度 | 最深 2 层（DashboardContent → 子组件），合格 |
| 加载状态数量 | 4 态（loading / error / empty / data），保留 error 态，其余合理 |
| 额外页面 | Calendar / Map 存在于侧边栏，属现有功能，待用户决策是否保留 |

**三层结构确认（已就位）：**
- 顶层：`SlicerBar`（始终挂载，不参与状态切换）✅
- 中层：`KpiCardRow`（4 张卡片，跟随筛选联动）✅
- 底层：`TrendChart + IndustryPieChart + BrandTable`（跟随筛选联动）✅

**数据流确认：**  
用户点选筛选器 → state 变更 → `useEffect` → `fetch(/api/dashboard?params)` → `better-sqlite3` 查 SQLite → JSON → 重渲染。无缓存层、无订阅。✅

**执行内容：**

| 操作 | 文件 |
|------|------|
| 修复退出登录 bug | `Sidebar.tsx`：`handleLogout` 改为 async，先 `POST /api/auth/logout` 清服务端 Cookie，再 `clearAuth()` 清客户端，最后 `router.push('/login')` 跳转 |
| 删除 `TrendBadge` 组件 | `components/ui/TrendBadge.tsx` 整体删除；`KpiCard.tsx` 移除 import、`trend` prop、`<TrendBadge />` 渲染（功能未启用，API 无此字段） |

---

## 第五批：项目文档清理 ✅ 已完成（2026-05-09）

**归档内容：** 整个 `.planning/` 目录（56 个 md 文件）→ `_archive/planning/`

包含：7 个 Phase 的 PLAN、SUMMARY、RESEARCH、VERIFICATION、VALIDATION、REVIEW、CONTEXT、DISCUSSION-LOG、HUMAN-UAT、PATTERNS、UI-SPEC，以及 ROADMAP、STATE、PROJECT、REQUIREMENTS、research/ 子目录、debug/ 子目录。

**根目录保留文档（6 个）：**

| 文件 | 性质 |
|------|------|
| `README.md` | 部署/使用说明 |
| `CLAUDE.md` | Claude Code 行为约束（工具必需） |
| `AGENTS.md` | 项目上下文，CLAUDE.md 引用 |
| `MWLAB-2026-PRD-v1.1-merged.md` | 权威需求文档 |
| `ECD-claude-code-refactor.md` | 整改指令（本文件） |
| `docs/ARCHITECTURE.md` | 架构说明 |

---

## 收尾确认（全部批次完成后）

所有批次执行完毕后，输出一份最终状态报告，回答：

1. 架构从几层变成了几层
2. 需要同时运行的进程从几个变成了几个
3. 项目总代码行数变化
4. 前端到数据的完整调用链，用一行描述

---

*ECD-2026 · Claude Code 整改指令集 · 分批执行版*
