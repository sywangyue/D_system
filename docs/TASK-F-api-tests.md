# 任务 F · 8 个新 API 端点补测试

**前置**：C（含 C 新增页面的冒烟）
**参照实现**：`tests/api/dashboard.test.ts`（vitest + `_db-mock`），**先读它**
**运行**：`npm test`（vitest run）
**验收**：见 §5

---

## 1. 现状

阶段 4 新增了 8 个端点，**零测试**：

```
/api/opportunity           GET 列表 + POST
/api/opportunity/[id]      GET 详情 + PATCH + DELETE
/api/company               GET 列表 + POST
/api/company/[id]          GET 详情 + PATCH
/api/research              GET 列表 + POST
/api/research/[id]         GET 详情 + PATCH
/api/resource              GET 列表（只读）
/api/resource/[id]/download GET 文件流
/api/expo                  GET 列表
/api/overview              GET 聚合
```

现有 `tests/api/` 只覆盖 auth / dashboard / setting。

---

## 2. 每个端点必测的项

不要追求行覆盖率，**测下面这些「出过事或容易出事」的点**：

### 2.1 所有列表端点（opportunity / company / research / resource / expo）

| # | 断言 |
|---|---|
| 1 | 未带 `x-user-*` 头 → 401 |
| 2 | `size=9999` → 响应里 `size` 为 **200**（静默截断，不是报错） |
| 3 | `sort` 传非白名单值（如 `1;DROP TABLE x`）→ **不报错**，回退默认排序 |
| 4 | `total` 是**筛选后**的数，不是全表数：带筛选与不带筛选的 `total` 应不同 |
| 5 | 一阶字段与规格完全一致 —— **多一个字段也算失败** |

第 5 项对 `/api/research` 尤其重要：响应里**不得出现 `report_md` 或 `params_json`**。
这是最容易破坏二阶式原则的地方。

### 2.2 写端点（opportunity / company / research 的 POST 与 PATCH）

| # | 断言 |
|---|---|
| 1 | `role=readonly` → 403 |
| 2 | 枚举非法（如 `type='bogus'`、`priority=99`）→ **400 且响应体有可读中文**，不是 500 |
| 3 | `PATCH` 只更新请求体里出现的字段，**未传的字段保持原值**（这是整行覆盖 bug 的防线） |
| 4 | 请求体里不在白名单的键被**静默忽略**，不报错 |
| 5 | `updated_at` 由服务端写 —— 客户端传一个假时间应被忽略 |

### 2.3 `/api/opportunity/[id]` 的 PATCH 特有

**阶段变更必须写一条 `opportunity_event`**。断言：
把 `stage` 从 A 改成 B 后，`opportunity_event` 里新增一条
`event_type='stage_change'`、`content='A → B'`。

这条事件是日后计算阶段驻留天数与转化率的**唯一数据源**，
静默丢失不会有任何报错，只会在几个月后发现算不出来。

### 2.4 `/api/resource/[id]/download` —— 安全测试，优先级最高

`resource.file_path` 来自数据库，而数据库是可写的，所以它**不是可信输入**。
一条 `file_path='../../.env.local'` 就能读走 `JWT_SECRET` 与企查查密钥。

必测这 6 种穿越姿势，**全部应返回 400**：

```
../../../../etc/passwd
reports/../../.env.local
.env.local
/etc/passwd
reports/./../.env.local
reports\..\..\.env.local
```

再加一条正向：合法路径应返回文件流，`Content-Type` 正确。

### 2.5 `/api/expo` —— 连接扇出

有 **8 个品牌在同一年有两届**（春秋两季）。断言：
`total` 等于 `display_ready=1` 的品牌数（**7,378**），
且返回的 `items` 里 `brand_id` 无重复。

这个 bug 真实发生过：用 `e.year = MAX(year)` 连接导致 `total` 报 7,386。

### 2.6 `/api/overview`

- `funnel` 必须**五档齐全**，没有数据的补 0（不能只返回有数据的档）
- `resources.total` 与 `resource` 表行数一致
- 顶层键：`kpi` / `tasks` / `reports` / `funnel` / `resources` / `week_end`

---

## 3. ⚠️ 四个陷阱

### 3.1 `lib/queries/overview.ts` 是共享模块

`/api/overview` 与 `app/overview/page.tsx` 共用它。
测接口时 mock 的是 `@/lib/db`，不是那个模块本身。

### 3.2 写端点用 `getWritableDb()`，读端点用 `getDb()`

两者是不同的导出，mock 时都要处理，否则写端点的测试会拿到只读连接。
参照现有 `_db-mock.ts` 的做法，需要的话扩展它而不是另起一套。

### 3.3 不要连真库

`tests/` 下所有测试必须 mock 掉 `@/lib/db`。
误连 `data/mwlab.db` 的写测试会污染 Max 正在录入的真实数据。

### 3.4 `params` 是 Promise

Next 16 的动态路由里 `{ params }` 是 `Promise<{ id: string }>`，
测试里要传 `{ params: Promise.resolve({ id: "1" }) }`，不是裸对象。

---

## 4. 文件组织

```
tests/api/opportunity.test.ts
tests/api/company.test.ts
tests/api/research.test.ts
tests/api/resource.test.ts        ← 含 download 的穿越测试
tests/api/expo.test.ts
tests/api/overview.test.ts
```

---

## 5. 验收

```bash
npm test                      # 全绿
python3 -m pytest tests/ -q   # 全绿

npx tsc --noEmit && npm run build   # 零错误零告警
```

新增测试数应不少于 **40 条**。
穿越测试（§2.4）与 `stage_change` 留痕（§2.3）**必须有**，缺任一视为未完成。
