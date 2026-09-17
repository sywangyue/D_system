# 任务 B · 套写剩余 API 端点

**交给**：hermes + DeepSeek
**前置必读**：`docs/API-SPEC-PHASE4.md`，以及**参考实现的源码**：
- `app/api/opportunity/route.ts`（一阶列表 + POST）
- `app/api/opportunity/[id]/route.ts`（二阶详情 + PATCH + DELETE）

**动手前先把这两个文件完整读一遍。** 本任务是照它们套，不是重新发明。

**验收**：`npx tsc --noEmit` 与 `npm run build` 均零错误零告警；§6 的 curl 检查全过。

---

## 1. 要写的文件（5 个）

| 文件 | 内容 |
|---|---|
| `app/api/company/route.ts` | GET 列表 + POST |
| `app/api/company/[id]/route.ts` | GET 详情 + PATCH |
| `app/api/research/route.ts` | GET 列表 + POST |
| `app/api/research/[id]/route.ts` | GET 详情 + PATCH |
| `app/api/resource/route.ts` | GET 列表**（只读，不写 POST）** |

---

## 2. ⚠️ 五个陷阱（踩了就是 bug）

### 2.1 四张表的主键名各不相同

```
opportunity   → opp_id
company       → company_id
resource      → resource_id
intel_report  → id          ← 只有这张是裸 id
```

照抄参考实现时**逐处核对主键名**，不要把 `opp_id` 一路复制过去。

### 2.2 只有 `opportunity` 有 `is_archived`

参考实现里每条查询都带 `WHERE o.is_archived = 0`。
`company` / `intel_report` / `resource` **没有这一列**，照抄会直接
`no such column: is_archived`。这三个资源的列表端点**没有软删除过滤**，
`[id]` 路由也**不要写 DELETE**。

### 2.3 `intel_report` 的大字段绝不能进一阶

```
params_json  JSON 字符串
report_md    报告全文，可以是几万字
```

一阶列表**只能**返回 §3 列出的字段。
若要给列表页做摘要，用 `SUBSTR(report_md, 1, 160) AS excerpt`，
**不要** `SELECT *`，更不要把 `report_md` 整个吐出来 —— 那就违背二阶式了。

### 2.4 不要碰 `/api/dashboard`

它现在**仍在给线上的 `public/dashboard.html` 和 `app/profile/page.tsx` 供数**。
改它的响应形状会当场打断线上看板。
它会在阶段 5 随 `dashboard.html` 一起退役，**本任务不要动它一行**。
新前端要的分页展会端点是 `/api/expo`，见 §4，那是新建文件，不影响现状。

### 2.5 `/api/resource/[id]/download` 已经写好了

不要重写、不要改动。本任务只新增 `app/api/resource/route.ts`（列表）。
`resource` 的列表端点**不返回文件内容**，只返回元信息。

---

## 3. 逐端点规格

### 3.1 `/api/company`

```
一阶字段     company_id, name, type, company_status, city, updated_at
排序白名单   updated_at(默认) / created_at / name / prospect_score
筛选白名单   type, company_status, source_type, brand_id, intel_report_id
模糊搜索 q   name LIKE ? OR credit_code LIKE ?
POST 必填    name, source_type（取值 qcc_search|manual|db_match）
写字段白名单 name, name_en, type, city, country, credit_code, oper_name,
             start_date, company_status, reg_no, address, email,
             prospect_score, contact_status, notes, brand_id, intel_report_id
```

**详情返回**：

```json
{ "company": {...全字段},
  "brand": {...关联展会品牌，可为 null},
  "resources": [...该公司名下全部资源，collected_at 倒序],
  "opportunities": [...引用该公司的机会，一阶字段],
  "reports": [...company_id 指向它的 intel_report，不含 report_md] }
```

校验：`prospect_score` 若传，必须是 1–5 整数；
`contact_status` 取值 `未接触|已接触|谈判中|合作中|放弃|''`。

### 3.2 `/api/research`（对应 `intel_report` 表）

```
一阶字段     id, title, report_type, status, company_id, updated_at,
             SUBSTR(report_md,1,160) AS excerpt
排序白名单   updated_at(默认) / created_at / report_type
筛选白名单   report_type, status, company_id, brand_id, industry_l1, opp_id
模糊搜索 q   title LIKE ? OR target_company LIKE ?
POST 必填    report_type, title
写字段白名单 title, report_type, status, report_md, report_file,
             params_json, company_id, brand_id, opp_id,
             industry_l1, industry_l2, target_company
```

**详情返回**：

```json
{ "report": {...全字段，含完整 report_md},
  "company": {...可为 null},
  "resources": [...report_id 指向它的资源] }
```

注意：`intel_report` 的 `params_json` / `report_md` / `report_file` / `status` /
`created_by` 都是 `NOT NULL`，新建时若未提供要补空字符串，否则 INSERT 失败。

### 3.3 `/api/resource`（只读列表）

```
一阶字段     resource_id, kind, title, mime, size_bytes, collected_at, source,
             company_id, opp_id, brand_id
排序白名单   collected_at(默认) / size_bytes / title / kind
筛选白名单   kind, source, company_id, opp_id, brand_id, report_id, industry_l1
模糊搜索 q   title LIKE ? OR file_path LIKE ?
```

**不写 POST / PATCH / DELETE。** 资源登记走 `scripts/index_resources.py`。

---

## 4. `/api/expo`（新建，取代将来要退役的 /api/dashboard）

```
一阶字段     b.brand_id, b.name_cn, b.name_en, b.city, b.industry_l1,
             e.year, e.area_sqm, e.exhibitors_count, e.visitors_count
来源         exhibition_brand b LEFT JOIN exhibition_edition e
             ON e.brand_id=b.brand_id AND e.year=(SELECT MAX(year) …)
过滤         b.display_ready = 1
排序白名单   area_sqm(默认) / exhibitors_count / visitors_count / name_cn / year
筛选白名单   industry_l1, industry_l2, city, country_cn
模糊搜索 q   b.name_cn LIKE ? OR b.name_en LIKE ?
```

只读，不写任何写方法。

---

## 5. 通用要求（照参考实现，不要自创）

1. 读用 `getDb()`（单例只读，**不要 close**）；写用 `getWritableDb()` 且
   **必须 `try/finally` 里 `close()`**，否则泄漏 WAL 连接。
2. `sort` / `order` **走白名单映射查表**，查不到回退默认。绝不拼进 SQL 字符串。
   其余参数一律 `?` 占位符。
3. `size` 默认 50、上限 200，越界**静默截断**，不报错。
4. `total` 用同一套 WHERE 再跑一次 `COUNT(*)`，不是全表数。
5. `PATCH` 只更新请求体里出现的字段，**不做整行覆盖**；请求体里不在白名单的键静默忽略。
6. `updated_at` 由服务端写，不接受客户端传入。
7. 枚举非法给**可读中文 400**，不要让 DB 的 CHECK 抛 500。
8. 捕获 `FOREIGN KEY` / `CHECK` 错误转成 400。

---

## 6. 验收

```bash
npx tsc --noEmit                    # 零错误
npm run build                       # 零错误、零 Turbopack 告警

# 起服务后（T 为 admin 的 session token）
curl -s -b "session=$T" '/api/company?size=2'        | jq '{n:(.items|length),total,size}'
curl -s -b "session=$T" '/api/company?size=9999'     | jq .size        # 应为 200
curl -s -b "session=$T" '/api/research?size=5'       | jq '.items[0]|keys'  # 不得含 report_md
curl -s -b "session=$T" '/api/resource?kind=report'  | jq .total       # 应为 11
curl -s -b "session=$T" '/api/expo?size=3'           | jq .total
curl -s -b "session=$T" '/api/company?sort=1;DROP+TABLE+company' | jq .total  # 不报错，回退默认

# 现有数据基线：company 501 条、intel_report 2 条、resource 50 条、
# exhibition_brand display_ready=1 的 5,332 条
```

**特别检查**：`/api/research` 的一阶响应里**不能出现 `report_md` 或 `params_json`**。
这是本任务最容易破坏二阶式原则的一处。
