---
phase: 06-code-audit
reviewed: 2026-06-11
scope: server-side (middleware.ts, lib/auth.ts, lib/db.ts, app/api/**, tests/)
depth: deep
files_reviewed: 19
findings:
  critical: 4
  warning: 3
  info: 4
status: issues_found
---

# MWLAB-2026 服务端 API 安全审计报告

**审计日期**：2026-06-11
**范围**：middleware.ts、lib/auth.ts、lib/db.ts、app/api/ 全部 14 个 route、tests/、仓库密钥卫生
**结论**：发现 4 个 🔴 严重、3 个 🟠 高危、4 个 🟡 中低危问题。SQL 注入方面全部参数化查询，未发现注入点（🟢）。

---

## 概览

认证架构为：middleware.ts 验证 `session` cookie 中的 JWT，将身份注入 `x-user-email` / `x-user-role` 请求头，由各 route handler 读取该头做鉴权。**该架构存在根本性缺陷**：middleware 在无 token / token 无效时直接放行原始请求，且不剥离客户端自带的 `x-user-*` 头，导致整套鉴权可被任意请求头伪造完全绕过。叠加多个 GET 路由完全无鉴权检查、写操作无角色校验，当前 API 层对未认证攻击者实质上是全开放的。仓库卫生方面，含密码哈希的 mwlab.db 已被 git 跟踪并推送至 GitHub 远端，属最高优先级处置项。

---

## 发现

### API-01 🔴 `x-user-*` 请求头可伪造 → 认证与 RBAC 完全绕过

- **位置**：`middleware.ts:23, 31`；受影响：所有依赖 `x-user-email` / `x-user-role` 的 route（users、setting/status、preferences、people、exhibition 全部写接口）
- **问题**：无 token（L23）或 token 验签失败（L31 catch）时，middleware 执行 `NextResponse.next()` **原样放行客户端请求头**，未删除外部传入的 `x-user-email` / `x-user-role`。攻击者不持有任何 JWT，直接发送 `curl -H "x-user-role: admin" /api/users` 即获得 admin 视图；发送 `-H "x-user-email: victim@x"` 即可冒充任意用户写入数据、篡改他人 preferences。
- **证据**：`users/route.ts:6` `const role = request.headers.get('x-user-role') || 'readonly'`——该值在无 token 路径下完全由客户端控制。
- **修复方向**：middleware 入口处先 `requestHeaders.delete('x-user-email'); delete('x-user-role')` 再按验签结果注入；无 token 的 `/api/*` 直接返回 401 而非放行。

### API-02 🔴 `/api/dashboard` 零鉴权 → 未认证全量业务数据导出

- **位置**：`app/api/dashboard/route.ts:8-130`
- **问题**：handler 不读取任何身份头、不做任何检查。middleware 对无 token 的 API 请求放行（注释称"401 由 handler 处理"），但本 handler 从未处理。匿名请求可直接拉取全部品牌、KPI、行业分布、年度趋势——即本项目的核心竞争情报资产。
- **证据**：`tests/api/dashboard.test.ts:26-28` 显式断言无任何认证头时返回 200，已将该漏洞固化为预期行为。
- **修复方向**：handler 开头校验 `x-user-email`，缺失返回 401（配合 API-01 修复才有效）。

### API-03 🔴 people / exhibition GET 路由零鉴权 → 联系人 PII 未认证泄露

- **位置**：`app/api/people/route.ts:4-16`（GET）、`app/api/people/[id]/route.ts:4-40`、`app/api/exhibition/[id]/route.ts:4-63`
- **问题**：三个 GET handler 均无身份检查。`person` 表含 name/title/company/linkedin/email/phone/notes，`exhibition/[id]` 还联表返回联系人 email/linkedin。匿名攻击者可枚举 `person_id`（自增整数）批量爬取全部人脉数据。
- **证据**：`people/route.ts:6` `SELECT p.*` 直接返回 person 全部字段，handler 第 4 行 `export async function GET()` 连 request 参数都未接收。
- **修复方向**：所有 GET handler 增加 `x-user-email` 401 校验（同 API-02）。

### API-04 🟠 写操作无角色校验 → readonly 角色可增删数据

- **位置**：`app/api/people/route.ts:18-20`（POST）、`people/[id]/contacts/route.ts:8-9`、`people/[id]/relations/route.ts:8-9`、`exhibition/[id]/relations/route.ts:8-9`、`exhibition/[id]/timeline/route.ts:8-9`、`timeline/[eventId]/route.ts:8-9`（DELETE）
- **问题**：全部写接口仅检查 `x-user-email` 存在性，从不检查 `x-user-role`。三级角色（admin/manager/readonly）中 readonly 持有合法 token 即可新增联系人、建立关系、删除 timeline 事件。全项目只有 `/api/users` 和 `/api/setting/status` 两个只读端点做了角色判断，写端点反而一个都没有。
- **修复方向**：写接口统一校验 `role !== 'readonly'`（或白名单 admin/manager），403 拒绝。

### API-05 🟠 token 经 JSON body 下发，cookie 由前端 JS 设置 → 非 HttpOnly，XSS 可窃取会话

- **位置**：`app/api/auth/login/route.ts:54-59`（返回 token 于 body，未 Set-Cookie）；`lib/auth.ts:16-18, 49`（token 存 localStorage + `document.cookie` 操作）；前端 `app/login/page.tsx:136` 以 JS 写 cookie，无 `HttpOnly`、无 `Secure`
- **问题**：登录响应应由服务端 `Set-Cookie: session=...; HttpOnly; Secure; SameSite=Lax` 下发。现状是 token 同时暴露在 localStorage 和非 HttpOnly cookie 中，任何 XSS 即可窃取 24 小时有效的会话凭证；无 Secure 标志时 HTTP 明文传输亦可被截获。
- **修复方向**：login route 改为 `response.cookies.set('session', token, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 86400 })`，body 不再返回 token，移除 localStorage 存储。

### API-06 🟡 logout 无服务端 token 失效机制

- **位置**：`app/api/auth/logout/route.ts:3-7`
- **问题**：JWT 无状态、无撤销表/黑名单，logout 仅清 cookie；已泄露或存于 localStorage 的 token 在 24h 内持续有效。被禁用用户（`is_active=0`）的存量 token 同样继续有效——middleware 验签不查库。内部系统可接受，但需知悉该窗口。
- **修复方向**：短期可在验签后增加 `is_active` 查库校验；或缩短 token 有效期。

### API-07 🟡 写路由 `req.json()` 未捕获异常、动态参数与 body 字段无类型校验

- **位置**：`people/route.ts:22`、`people/[id]/contacts/route.ts:12`、`people/[id]/relations/route.ts:12`、`exhibition/[id]/relations/route.ts:12`、`exhibition/[id]/timeline/route.ts:12`
- **问题**：与 login（有 try/catch，:11-14）不同，上述路由的 `await req.json()` 无捕获，畸形 JSON 直接抛 500。`Number(id)` 对非数字 path 参数得 NaN，better-sqlite3 绑定 NaN/对象类型抛 TypeError 同样 500（dev 模式泄露堆栈）。body 字段（title/notes 等）未校验类型与长度，传入对象/数组即 500。
- **修复方向**：统一 try/catch 包裹 json 解析返回 400；`Number.isInteger(Number(id))` 校验 path 参数。

### API-08 🟡 exhibition relations 插入后回查条件不含主键 → 可能返回旧重复行

- **位置**：`app/api/exhibition/[id]/relations/route.ts:30-35`
- **问题**：INSERT 后用 `(from_brand_id, to_brand_id, relation_type)` 回查而非 `lastInsertRowid`（对比 `people/route.ts:41` 的正确写法）。无唯一约束时重复提交会返回最早一条而非新插入行，且重复关系可无限累积。
- **修复方向**：改用 `WHERE r.id = ?` + `result.lastInsertRowid` 回查；考虑加唯一索引。

### API-09 🟢 SQL 注入：未发现

全部 14 个 route 使用 better-sqlite3 `prepare` + `?` 占位符绑定。`dashboard/route.ts:17` 的 `yearSet` 字符串插值来源为 `new Date().getFullYear()`（非用户输入），`IN (${placeholders})` 为按数组长度生成的 `?` 序列，均安全。

### API-10 🟢 用户端点无密码哈希泄露

`users/route.ts:14` 显式列出 `user_id, email, role, is_active, last_login`；login route 虽 `SELECT *` 但响应只回传 4 个白名单字段。`setting/status` 返回 node 版本/构建时间，admin-only（在 API-01 修复后）可接受。

---

## 密钥与仓库卫生

### HYG-01 🔴 mwlab.db 已被 git 跟踪并推送至 GitHub 远端（含密码哈希）

- **证据**：`git ls-files` 包含 `mwlab.db`；远端为 `https://github.com/sywangyue/D_system.git`；库内 `user` 表 3 条记录均含 bcrypt `password_hash`。`.gitignore` 的 `*.db` 规则对已跟踪文件无效（git status 显示 `M mwlab.db` 即为证明）。
- **影响**：密码哈希 + 全量业务数据（品牌/届次/联系人 PII）随每次 push 进入远端历史。若仓库曾经或将来转公开，等同全量泄露。
- **修复方向**：`git rm --cached mwlab.db` 并提交；用 git-filter-repo 清理历史；重置全部用户密码；确认仓库可见性。

### HYG-02 🟠 MWlab.pem（RSA 私钥）置于仓库根目录且 `.gitignore` 无 `*.pem` 规则

- **证据**：根目录 `MWlab.pem`，文件头 `-----BEGIN RSA PRIVATE KEY-----`，当前未跟踪；但 `.gitignore`（已审 73 行）无任何 pem/key 规则，一次 `git add .` 即会提交阿里云服务器 SSH 私钥。
- **修复方向**：将私钥移出仓库目录（如 `~/.ssh/`）；`.gitignore` 增加 `*.pem`。

### HYG-03 🟢 JWT_SECRET 来源规范

`middleware.ts:4` 与 `login/route.ts:6` 均从 `process.env.JWT_SECRET` 读取，**无硬编码、无默认 fallback**，缺失时启动即抛错（fail-fast，正确）。`.env.local` 含 JWT_SECRET 但已被 `.gitignore` 的 `.env.*` 规则覆盖，未被 git 跟踪。

### HYG-04 🟡 根目录杂物

`.gitignore.bak`（旧版 ignore 备份）、4 个 `mwlab_backup_*.db`、`MWlab-2026_系统能力简报.docx`、xlsx 清单等散落根目录，均未跟踪但增加误提交面；`*.bak` 已被忽略，备份 db 依赖 `*.db` 规则覆盖。建议归档至已忽略的专用目录。

---

## 测试覆盖

| 文件 | 状态 | 评估 |
|------|------|------|
| `tests/middleware.test.ts` | 🟠 全部为 skeleton 占位 | 4 个用例均为 `expect(true).toBe(true)` + TODO 注释，**对 62 行核心鉴权代码的实际覆盖为零**。API-01 这类缺陷正是 middleware 测试缺失的直接后果。 |
| `tests/api/users.test.ts` | 部分有效 | 覆盖 admin 200 / 非 admin 403。但测试通过直接注入 `x-user-role` 头调用 handler，恰好印证"信任请求头"模型——单元层面通过，集成层面（头可伪造）完全失守。 |
| `tests/api/setting.test.ts` | 部分有效 | 同上模式，覆盖角色矩阵与空 crawl_log 边界。 |
| `tests/api/dashboard.test.ts` | 🟠 固化漏洞 | `:26-28` 断言**无任何认证返回 200**，将 API-02 写成了预期行为。 |
| 无测试的路由 | 🟠 | `auth/login`（密码校验、统一 401、JWT 签发——最关键路径）、`auth/logout`、`user/preferences`、`people/*`（4 个）、`exhibition/*`（4 个）共 10 个 route 零测试，含全部写操作与 DELETE。 |

**总评**：14 个 route 中仅 3 个有实质测试；middleware 零覆盖；现有测试以可伪造的头作为鉴权契约，无法发现本报告的任何 🔴 问题。修复 API-01～04 后应补充：middleware 头剥离测试、未认证 401 测试、readonly 写操作 403 测试、login 错误口令 401 测试。

---

_Reviewer: Claude (gsd-code-reviewer) · Depth: deep · 仅审计，未改动任何源文件_
