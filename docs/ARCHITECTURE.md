# 架构 · MWLAB 万象（V2）

Next.js 16 单进程（App Router）+ SQLite（better-sqlite3），部署在阿里云轻量服务器，见 `DEPLOY.md`。
数据采集与治理是 Python 管道，跑在 Max 本机 crontab，产出 `data/mwlab.db` 后随部署上传。

## 1. 数据模型

中心实体是**公司**；展会数据降级为被引用的字典（底图）。

```
company ─┬─ opportunity ── opportunity_event（时间线；stage_change 是驻留天数的唯一数据源）
         ├─ intel_report（调研报告，主键是裸 id）
         ├─ resource（文件索引：reports/ exports/ research/ 下的原文件）
         └─ exhibition_brand ── exhibition_edition / brand_organizer / brand_geo_tag
user（3 个账号）· schema_version（当前 17）
```

- 时间一律**本地时间、无时区**，写库用 `lib/time.ts`，不要用 `toISOString()`。
- 「品牌 → 最新一届」只有一份写法：`lib/queries/edition.ts`。
- 只展示 `exhibition_brand.display_ready = 1`（7,378 条）。
- 闭集取值只有一份：业务线 / 阶段 / 交易形式在 `app/opportunity/types.ts`，其余在 `lib/enums.ts`。
- 知识库不在库里：`knowledge/<slug>/index.md`（服务端读）+ `public/knowledge/<slug>/images/`（公开静态）。

## 2. 目录

| 路径 | 作用 |
|---|---|
| `app/<页面>/` | 服务端壳 `page.tsx` + 客户端组件；首屏数据由服务端直接调 `lib/queries/*` |
| `app/api/` | 一阶列表 / 二阶详情端点；错误只回错误码，前端 `errorText()` 查字典 |
| `lib/queries/` | 聚合查询，页面与接口共用，避免口径漂移 |
| `lib/i18n.ts` / `lib/i18n-shared.ts` | 语言只认 cookie `mwlab_locale`；前者服务端专用 |
| `locales/zh.json` `en.json` | 两份键必须完全对齐，en 不得含中文 |
| `components/` | 共用组件（资源列表、地图、落地页、外壳） |
| `proxy.ts` | 中间件（鉴权） |
| `tests/` | vitest（接口，模拟库）+ pytest（Python 工具） |
| `crawlers/` `scripts/` `tools/` `schema/` | Python 采集、治理、迁移 |

## 3. 鉴权

- `proxy.ts` 验 JWT，剥离客户端传入的 `x-user-*` 再注入可信值；`/api/*` 无效令牌 401，页面 307 到 `/login`。
- **`/api/*` 不走静态资源放行**：以 `.png` 等结尾的接口路径曾可伪造身份（V2-14 修复），matcher 单列 `/api/:path*`。
- `requireUser()` 读注入的身份并查库校验 `is_active`；`requireWriter()` 拒绝 readonly。
- 公开路径：`/`（落地页，打 `x-mwlab-bare` 标记不渲染侧栏）、`/login`、静态资源、`/countries-110m.json`。
- `public/` 不经中间件：**只有能被陌生人看到也无所谓的文件才放 `public/`**。

## 4. 写接口约定

- 白名单字段、只更新传入的列；NOT NULL 列显式传 null 要回 400，不能撞约束变 500。
- 改阶段与写 `stage_change` 在同一事务。
- 写连接 `getWritableDb()` 必须 `finally` 关闭；读用单例 `getDb()`（只读）。
- 文件读取端点的路径校验在字符串层完成，根目录写字面量（Turbopack 文件追踪要求）。

历次设计取舍的原始讨论见 `archive/`。
