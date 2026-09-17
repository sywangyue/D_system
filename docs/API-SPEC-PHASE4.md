# 阶段 4 · 后端 API 规格

**日期**：2026-09-17
**参考实现**：`app/api/opportunity/route.ts` + `app/api/opportunity/[id]/route.ts`
**用法**：其余端点照参考实现套。**先读完参考实现的代码再动手。**

---

## §0 一条核心原则：二阶式

> 本系统的核心是**存储报告与采集来的资源**，不是展示后台数据。
> 列表页只给最少的列，点详情才看全部。

| 阶 | 端点 | 返回 | 典型体积 |
|---|---|---|---|
| **一阶** | `GET /api/{res}` | 精简字段 + 分页 + 服务端筛选排序 | 每页 ≤ 50 条 × 5 字段 |
| **二阶** | `GET /api/{res}/{id}` | 全字段 + 关联对象 + 关联资源 | 单条 |

**反面教材**：现有 `/api/dashboard` 一次返回全部 5,332 条品牌，前端做纯客户端过滤。
新端点一律不许这样。分页与筛选必须在 SQL 里做。

---

## §1 列表端点契约

### 请求

```
GET /api/opportunity?type=ma&stage=dd&owner=x@y.cn&q=半导体&page=1&size=50&sort=updated_at&order=desc
```

| 参数 | 说明 |
|---|---|
| `page` | 从 1 起，默认 1 |
| `size` | 默认 50，**上限 200**（超过按 200 截断，不报错） |
| `sort` | **必须走列白名单**，不在白名单一律回退默认列 |
| `order` | `asc` / `desc`，非法值回退 `desc` |
| `q` | 模糊搜索，`LIKE '%q%'`，只查 1–2 个主字段 |
| 其余 | 每个资源自定义的筛选白名单 |

> ⚠️ `sort` 与 `order` **绝不能拼进 SQL 字符串**，必须先在白名单里查到映射再用。
> 其余参数一律走 `?` 占位符。

### 响应

```json
{
  "items": [ { …精简字段… } ],
  "page": 1,
  "size": 50,
  "total": 137
}
```

`total` 是筛选后的总数（同一套 WHERE 再跑一次 `COUNT(*)`），不是全表数。

---

## §2 详情端点契约

```json
{
  "opportunity": { …全字段，detail_json 已解析成对象… },
  "company":     { …关联公司，可为 null… },
  "brand":       { …关联展会品牌，可为 null… },
  "resources":   [ { resource_id, kind, title, file_path, size_bytes, collected_at } ],
  "events":      [ { event_id, event_type, content, occurred_at, created_by, created_at } ],
  "reports":     [ { id, title, report_type, status, updated_at } ]
}
```

**详情端点必须带 `resources`** —— 这是本系统的核心功能，所有详情页都要能看到并下载该对象的资源。
`company` / `research` 的详情端点同理。

---

## §3 写操作

| 方法 | 端点 | 权限 |
|---|---|---|
| `POST` | `/api/{res}` | `requireWriter` |
| `PATCH` | `/api/{res}/{id}` | `requireWriter` |
| `DELETE` | `/api/{res}/{id}` | `requireWriter`，**软删除**（`is_archived=1`），不物理删 |

规则：

1. 写操作用 `getWritableDb()`，**必须 `try/finally` 里 `close()`**，
   否则 WAL 连接泄漏。读操作用 `getDb()`（单例只读，不要 close）。
2. `updated_at` 由服务端写，**不接受客户端传入**。
3. `PATCH` 只更新请求体里出现的字段，缺省字段不动（不要整行覆盖）。
4. 字段白名单：请求体里不在白名单的键**静默忽略**，不报错。
5. 枚举值在写库前校验一遍（DB 有 CHECK 约束兜底，但要给出可读的 400 而不是 500）。

---

## §4 错误码

| 码 | 场景 | 响应体 |
|---|---|---|
| 400 | 参数/枚举非法 | `{ "error": "可读中文说明" }` |
| 401 | 未认证或账号被禁用 | `{ "error": "unauthorized" }` |
| 403 | readonly 角色写操作 | `{ "error": "forbidden" }` |
| 404 | 资源不存在 | `{ "error": "not found" }` |
| 409 | 唯一约束冲突 | `{ "error": "可读中文说明" }` |

---

## §5 待实现端点

| 端点 | 一阶字段 | 筛选白名单 | 谁做 |
|---|---|---|---|
| `/api/opportunity` ✅ | title, type, stage, owner, updated_at | type, stage, owner, priority, q | **参考实现（已完成）** |
| `/api/company` | name, type, company_status, city, updated_at | type, company_status, source_type, q | DeepSeek |
| `/api/research` | title, report_type, status, target_company, updated_at | report_type, status, q | DeepSeek |
| `/api/resource` | kind, title, size_bytes, collected_at | kind, company_id, opp_id, source, q | DeepSeek |
| `/api/resource/[id]/download` | — 返回文件流 | — | **我做**（路径穿越防护） |
| `/api/overview` | 聚合，无列表 | — | **我做** |
| `/api/dashboard` 瘦身 | 改为分页 | — | DeepSeek |

---

## §6 验收

```bash
# 分页与总数
curl -b "session=$T" '/api/opportunity?size=2' | jq '{n:(.items|length), total, page, size}'

# 筛选生效（total 应随之变化）
curl -b "session=$T" '/api/opportunity?type=ma' | jq .total

# sort 注入防护：非法列名不应报错，应回退默认排序
curl -b "session=$T" '/api/opportunity?sort=1;DROP+TABLE+opportunity' | jq .total

# 详情带 resources
curl -b "session=$T" '/api/opportunity/1' | jq 'keys'

# readonly 写操作应 403
curl -b "session=$T_READONLY" -X POST '/api/opportunity' -d '{}' | jq .
```
