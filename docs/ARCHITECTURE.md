# MWLAB-2026 · Architecture & Technical Reference

**最后更新**：2026-05-28（Railway → 阿里云迁移完成后重写）

---

## 当前系统架构

```
浏览器
  │  HTTPS (Cloudflare Flexible SSL)
  ▼
Cloudflare CDN (orange cloud)
  │  HTTP
  ▼
Nginx (80) ── 反向代理 ──► Next.js 16 (3000) ── better-sqlite3 ──► mwlab.db
                                │
                           JWT middleware
                           (edge runtime)

定时任务（独立进程，cron 驱动）
  scheduler.py ──► jufair_crawler.py  ──┐
               └──► cnexpo_crawler.py ──┴──► mwlab.db (raw_* + crawl_log)
```

---

## 技术栈（实际生产状态）

| 层级 | 选择 | 说明 |
|------|------|------|
| 框架 | Next.js 16.2.4 (App Router) | 前后端一体，API Routes 替代原 FastAPI |
| 运行时 | Node.js 20 (via nvm) | PM2 守护，开机自启 |
| 数据库驱动 | better-sqlite3 11.9.1 | 同步 API，WAL 模式，64MB 缓存 |
| 认证 | jose 6.2.3 (JWT HS256) | 24h token，httpOnly cookie |
| 样式 | Tailwind CSS 4.2.4 | PostCSS 8 |
| 图标 | lucide-react 0.532.0 | |
| 密码哈希 | bcryptjs 3.0.3 | |
| 爬虫 | Python 3.10 + requests + beautifulsoup4 | 独立 venv (.venv) |
| 进程管理 | PM2 7.0.1 | `mwlab-dashboard` 进程 |
| 反向代理 | Nginx 1.18.0 | HTTP → localhost:3000 |
| SSL | Cloudflare Universal SSL (Flexible) | 无需服务器证书 |

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `middleware.ts` | JWT 验证 + 路由保护 + 角色守卫（Next.js 16 edge runtime） |
| `lib/db.ts` | better-sqlite3 单例，`getDb()` 只读 / `getWritableDb()` 写 |
| `lib/auth.ts` | 客户端 localStorage auth state 管理 |
| `app/api/dashboard/route.ts` | 核心 KPI 聚合 API，多维筛选 + gzip 压缩 |
| `app/api/auth/login/route.ts` | 登录，bcrypt 验证，JWT 签发 |
| `schema/init_db.sql` | 完整 Schema 定义 |
| `schema/migrations/` | 增量迁移（001–003 已执行） |
| `scheduler.py` | 爬虫调度入口，支持 `--cron` / `--run-now` / `--status` |
| `crawlers/jufair_crawler.py` | Jufair 爬取（写 raw_jufair，timeout=30s） |
| `crawlers/cnexpo_crawler.py` | Cnexpo 爬取（写 raw_cnexpo，timeout=30s） |
| `requirements.txt` | Python 依赖：requests + beautifulsoup4 |

---

## 数据库 Schema（6 张核心表）

```
exhibition_brand      ← 品牌主表（变化慢）
  └── exhibition_edition    ← 届次时序数据（每年一条）
  └── data_provenance       ← 原始来源溯源
  └── manual_tag_history    ← 人工打标审计日志

crawl_log             ← 爬虫执行日志
user                  ← 用户账号 + RBAC + dashboard_prefs
schema_version        ← 迁移版本追踪
```

**已执行迁移**：
- `001_initial.sql` — schema_version 表
- `002_display_ready.sql` — exhibition_brand.display_ready 字段
- `003_user_prefs.sql` — user.dashboard_prefs JSON 字段

---

## 已实现能力

| 能力 | 入口 |
|------|------|
| JWT 登录 / 登出 | `/api/auth/login` · `/api/auth/logout` |
| 多维筛选 Dashboard | `/api/dashboard?industry_l1[]=...` |
| 用户偏好持久化 | `/api/user/preferences` |
| 系统状态 / 爬取日志 | `/api/setting/status` |
| 用户管理（admin） | `/api/users` |
| 定时爬取 | cron → `scheduler.py --cron`，每周一 02:00 |

---

## 规划中的扩展方向

| 方向 | 技术方案 | 迁移成本 |
|------|---------|---------|
| 时间线 + 关系图谱 | Schema 迁移 004/005（新增表） | 低 |
| 人员关系网络 | 新增 person / exhibition_contact / contact_relation 表 | 低 |
| 前端筛选重构 | 现有 App Router 框架内改 | 中 |
| EIR 一次性检索 | Flask sidecar（PM2 独立进程，:5001）← 从 Geckos 迁移 | 中 |

---

## 反模式（维持不变）

- ❌ 在服务器上执行 `npm run build`（内存不足 OOM）
- ❌ 把 `@opennextjs/cloudflare` 放进 `dependencies`（非 Cloudflare 环境会 crash）
- ❌ 爬虫 sqlite3.connect 不设 timeout（遇 WAL 写锁立即报错）
- ❌ 关闭 Cloudflare 代理（灰云）再测 HTTPS（直连服务器只有 HTTP）
