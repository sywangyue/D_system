# V2 万象重构 · 任务规格与返工单原文

> **归档文件**：以下为已执行完毕的原始文档合并，内容保持原样、不再维护。
> 文中「阶段 X / 任务 X / Phase X」与统一编码的对应关系见 `docs/HISTORY.md`。
> 文中对其他 docs 文件的引用，文件已并入 `docs/` 下的新文件或本目录。

## 目录

1. V2-03 · 任务 A 改名适配
2. V2-04 · 任务 B 套写 API 端点
3. V2-06 · 任务 D 历史 docx 回填
4. V2-07 · 任务 G 机会详情页
5. V2-07 · 任务 G 返工单
6. V2-08 · 任务 C 公司库 + 调研库
7. V2-09 · 任务 E 全站 i18n
8. V2-09 · 任务 E 返工单
9. V2-10 · 任务 K 知识库
10. V2-11 · 任务 F 接口测试
11. V2-12 · 任务 H 展会底图
12. V2-13 · 任务 I 设置 / 个人资料收尾
13. V2-14 · 任务 J 官网落地页


---

## V2-03 · 任务 A 改名适配

<!-- 原文件：docs/TASK-A-rename-adaptation.md -->

### 任务 A · customer_prospect → company 改名适配

**交给**：hermes + DeepSeek（纯机械查找替换，有测试当验收标准）
**前置**：迁移 014 + 015 已应用于 `data/mwlab.db`（`schema_version = 15`）
**验收**：`python3 -m pytest tests/ -q` 的失败数从 **8** 降到 **1**
（任务 B/C 已完成，把基线从 9 降到了 8）
（剩下那 1 条 `test_jufair_insert_batch_dedup_count` 是先前就存在的签名漂移，**不属于本任务，不要动它**）

---

#### 1. 改名对照表

| 类别 | 旧 | 新 |
|---|---|---|
| 表名 | `customer_prospect` | `company` |
| 列名 | `id` | `company_id` |
| 列名 | `company_name` | `name` |

**新增列（本任务不需要写入，知道存在即可）**：`name_en` `type` `city` `country`
**`intel_report_id` 保持不变** —— 014 曾误删，015 已恢复，仍在 `company` 表上。

---

#### 2. 要改的文件（共 7 个）

| 文件 | 出现次数 | 说明 |
|---|---|---|
| `tools/intel/insert_prospects.py` | 表 ×4，列 ×10 | 含字段映射字典 `_FIELDS` |
| `tools/intel/import_qcc_batch.py` | 表 ×9，列 ×11 | 含 SELECT / UPDATE / INSERT 三种语句 |
| `tools/intel/export_prospects.py` | 表 ×4，列 ×3 | 含 `_COLUMNS` 列表与中文表头映射 |
| `scripts/dedup.py` | 表 ×1 | 第 518 行的 `("customer_prospect", "brand_id")` 元组 |
| `schema/db.py` | 表 ×2 | 第 109、116 行，见 §4 特别说明 |
| `tests/test_intel_tools.py` | 表 ×7，列 ×7 | |
| `tests/test_schema.py` | 表 ×2 | 第 245、247 行 |

---

#### 3. ⚠️ 三个不能碰的地方（改了就是 bug）

##### 3.1 `tools/intel/db_query.py` 整个文件不要动

它第 208 行有 `def company_history(company_name: str)` —— 这个 `company_name` 是
**Python 函数参数名**，不是数据库列名，全文件 4 处都是。该文件不访问 `customer_prospect` 表。

##### 3.2 `schema/migrations/*.sql` 全部不要动

历史迁移是已发生事实的记录，改了会让迁移链对不上。
`006_intel_tables.sql` 里的 `CREATE TABLE customer_prospect` 必须原样保留 ——
全新库会先建 `customer_prospect`，再由 014 改名成 `company`。

##### 3.3 `scripts/verify_migration_014.py` 不要动

它要对照**迁移前**的备份库，里面出现 `customer_prospect` 是故意的。

---

#### 4. `schema/db.py` 的特别处理

第 109–116 行是生产库对账逻辑，判断版本 6 是否已应用：

```python
if 'intel_report' in tables and 'customer_prospect' in tables:
```

改名后这个判断在新库上永远为假。改成同时接受两种表名：

```python
if 'intel_report' in tables and ('customer_prospect' in tables or 'company' in tables):
```

**不要简单替换成 `'company' in tables`** —— 那会让尚未应用 014 的旧生产库对账失败。

---

#### 5. 逐文件要点

##### `insert_prospects.py`
- `_FIELDS` 字典里 `"company_name": "company_name"` → `"company_name": "name"`
  （左边是外部输入的 JSON 键，**保持 `company_name` 不变**；右边是数据库列名，改成 `name`）
- 查重 SQL：`SELECT 1 FROM customer_prospect WHERE brand_id IS ? AND company_name = ?`
  → `FROM company WHERE brand_id IS ? AND name = ?`
- Python 局部变量 `company_name = p.get("company_name")` 可以保留原名，只改 SQL 里的列名
- 报错文案里的「customer_prospect 表」改成「company 表」

##### `import_qcc_batch.py`
- `_COL_MAP` 里的 `"company_name": 1` 是 **Excel 列索引映射，键名不要改**
- 三处 SQL 全改：`SELECT id, ... FROM customer_prospect WHERE credit_code = ?`
  → `SELECT company_id, ... FROM company WHERE credit_code = ?`
- `UPDATE customer_prospect SET company_name = ?` → `UPDATE company SET name = ?`
- `INSERT INTO customer_prospect (source_type, company_name, ...)`
  → `INSERT INTO company (source_type, name, ...)`
- 注意：取回的 `id` 变成 `company_id`，下游用到这个值的地方要跟着改

##### `export_prospects.py`
- `_COLUMNS` 列表：`"id"` → `"company_id"`，`"company_name"` → `"name"`
- 中文表头映射 `_HEADERS` 的**键**跟着改，**值（中文）不改**：
  `"company_name": "公司名称"` → `"name": "公司名称"`
- 三条 SQL 的 `FROM customer_prospect ... ORDER BY id` → `FROM company ... ORDER BY company_id`
- `--report-id` 过滤仍然有效（`intel_report_id` 列还在）
- 列宽配置 `"company_name": 30` 的键跟着改

##### `tests/test_intel_tools.py`
- 所有 `INSERT INTO customer_prospect (company_name, ...)` → `INTO company (name, ...)`
- 所有 `SELECT ... FROM customer_prospect` → `FROM company`
- 测试数据字典里的 `{'company_name': '幂等公司甲', ...}` 是**喂给工具的输入**，
  键名保持 `company_name` 不变（对应 `insert_prospects._FIELDS` 的左边）
- 类的 docstring「intel_report / customer_prospect 的 CHECK 约束」改成 `company`

##### `tests/test_schema.py`
- 第 247 行 `self.assertIn('customer_prospect', tables)` → `assertIn('company', tables)`
- 同文件里关于 `exhibition_timeline` / `person` 等表的断言**已由任务 B 改好**，不要再动

---

#### 6. 验收

```bash
# 1. 跑测试，失败数应为 1（只剩 test_jufair_insert_batch_dedup_count）
python3 -m pytest tests/ -q

# 2. 除指定豁免文件外，代码里不应再出现旧表名
grep -rn "customer_prospect" --include="*.py" . \
  | grep -v node_modules \
  | grep -v "schema/migrations/" \
  | grep -v "scripts/verify_migration_014.py" \
  | grep -v "schema/db.py"        # db.py 里保留一处用于旧库对账，见 §4

# 3. 工具能跑通（只读，不写库）
python3 tools/intel/export_prospects.py --help
```

三条都过 = 任务 A 完成。

---

## V2-04 · 任务 B 套写 API 端点

<!-- 原文件：docs/TASK-B-api-endpoints.md -->

### 任务 B · 套写剩余 API 端点

**交给**：hermes + DeepSeek
**前置必读**：`docs/API-SPEC-PHASE4.md`，以及**参考实现的源码**：
- `app/api/opportunity/route.ts`（一阶列表 + POST）
- `app/api/opportunity/[id]/route.ts`（二阶详情 + PATCH + DELETE）

**动手前先把这两个文件完整读一遍。** 本任务是照它们套，不是重新发明。

**验收**：`npx tsc --noEmit` 与 `npm run build` 均零错误零告警；§6 的 curl 检查全过。

---

#### 1. 要写的文件（5 个）

| 文件 | 内容 |
|---|---|
| `app/api/company/route.ts` | GET 列表 + POST |
| `app/api/company/[id]/route.ts` | GET 详情 + PATCH |
| `app/api/research/route.ts` | GET 列表 + POST |
| `app/api/research/[id]/route.ts` | GET 详情 + PATCH |
| `app/api/resource/route.ts` | GET 列表**（只读，不写 POST）** |

---

#### 2. ⚠️ 五个陷阱（踩了就是 bug）

##### 2.1 四张表的主键名各不相同

```
opportunity   → opp_id
company       → company_id
resource      → resource_id
intel_report  → id          ← 只有这张是裸 id
```

照抄参考实现时**逐处核对主键名**，不要把 `opp_id` 一路复制过去。

##### 2.2 只有 `opportunity` 有 `is_archived`

参考实现里每条查询都带 `WHERE o.is_archived = 0`。
`company` / `intel_report` / `resource` **没有这一列**，照抄会直接
`no such column: is_archived`。这三个资源的列表端点**没有软删除过滤**，
`[id]` 路由也**不要写 DELETE**。

##### 2.3 `intel_report` 的大字段绝不能进一阶

```
params_json  JSON 字符串
report_md    报告全文，可以是几万字
```

一阶列表**只能**返回 §3 列出的字段。
若要给列表页做摘要，用 `SUBSTR(report_md, 1, 160) AS excerpt`，
**不要** `SELECT *`，更不要把 `report_md` 整个吐出来 —— 那就违背二阶式了。

##### 2.4 不要碰 `/api/dashboard`

它现在**仍在给线上的 `public/dashboard.html` 和 `app/profile/page.tsx` 供数**。
改它的响应形状会当场打断线上看板。
它会在阶段 5 随 `dashboard.html` 一起退役，**本任务不要动它一行**。
新前端要的分页展会端点是 `/api/expo`，见 §4，那是新建文件，不影响现状。

##### 2.5 `/api/resource/[id]/download` 已经写好了

不要重写、不要改动。本任务只新增 `app/api/resource/route.ts`（列表）。
`resource` 的列表端点**不返回文件内容**，只返回元信息。

---

#### 3. 逐端点规格

##### 3.1 `/api/company`

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

##### 3.2 `/api/research`（对应 `intel_report` 表）

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

##### 3.3 `/api/resource`（只读列表）

```
一阶字段     resource_id, kind, title, mime, size_bytes, collected_at, source,
             company_id, opp_id, brand_id
排序白名单   collected_at(默认) / size_bytes / title / kind
筛选白名单   kind, source, company_id, opp_id, brand_id, report_id, industry_l1
模糊搜索 q   title LIKE ? OR file_path LIKE ?
```

**不写 POST / PATCH / DELETE。** 资源登记走 `scripts/index_resources.py`。

---

#### 4. `/api/expo`（新建，取代将来要退役的 /api/dashboard）

```
一阶字段     b.brand_id, b.name_cn, b.name_en, b.city, b.industry_l1,
             e.year, e.area_sqm, e.exhibitors_count, e.visitors_count
来源         exhibition_brand b LEFT JOIN exhibition_edition e
             ⚠️ 取「最新一届」必须锁到单行：有 8 个品牌在同一年有两届（春秋两季），
             用 e.year = MAX(year) 会让 LEFT JOIN 扇出、total 多算、列表出现重复。
             正确写法：
               AND e.edition_id = (SELECT edition_id FROM exhibition_edition
                                   WHERE brand_id = b.brand_id
                                   ORDER BY year DESC, edition_id DESC LIMIT 1)
过滤         b.display_ready = 1
排序白名单   area_sqm(默认) / exhibitors_count / visitors_count / name_cn / year
筛选白名单   industry_l1, industry_l2, city, country_cn
模糊搜索 q   b.name_cn LIKE ? OR b.name_en LIKE ?
```

只读，不写任何写方法。

---

#### 5. 通用要求（照参考实现，不要自创）

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

#### 6. 验收

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
# exhibition_brand display_ready=1 的 7,378 条
# （勘误：本文初稿写的 5,332 是 /api/dashboard 带年份过滤的口径，不是 display_ready）
```

**特别检查**：`/api/research` 的一阶响应里**不能出现 `report_md` 或 `params_json`**。
这是本任务最容易破坏二阶式原则的一处。

---

## V2-06 · 任务 D 历史 docx 回填

<!-- 原文件：docs/TASK-D-backfill-reports.md -->

### 任务 D · 历史 docx 回填 intel_report

**前置**：无。先跑这个，C 的调研库页面才有真内容可展示。
**产出**：`scripts/backfill_reports.py`（可反复重跑）+ 一次实际回填
**验收**：见 §5

---

#### 1. 现状

```
intel_report  只有 2 行
  id=1  industry_research  report_md 长度 0     report_file 空
  id=3  batch_prospect     report_md 长度 207   report_file 空

resource      50 条已登记，其中 kind='report' 共 11 条，全部是 docx
```

**11 份 docx 躺在 `reports/` 下，一份都没进 `intel_report`。**
`resource` 表已经把它们索引了（含 `company_id` 关联），但报告正文不可搜索、
调研库页面打开是空的。本任务把正文抽出来入库。

---

#### 2. 两类文件

| 模式 | 数量 | 对应公司 | report_type |
|---|--:|---|---|
| `reports/customer/qcc_research_{公司}_{时间戳}.docx` | 9 | 文件名可解析，且 `resource.company_id` 已关联 | `company_research` |
| `reports/customer/励泰展览_深度调研报告_20260804.docx` | 1 | 需人工判断 | `company_research` |
| `reports/industry/FPackAsia_深度调研报告_2026-08-24.docx` | 1 | 无公司，属行业 | `industry_research` |

实测结构（`python-docx` 已在 `requirements.txt`，版本 ≥1.1.0）：
每份约 **137 段正文 + 4–7 张表**，前 5 段是固定抬头：

```
Messe Düsseldorf (Shanghai) Co., Ltd.
Messe Düsseldorf China
VERTRAULICHER UNTERSUCHUNGSBERICHT
CONFIDENTIAL INVESTIGATION REPORT
保密企业调研报告
{公司名}          ← 第 6 段才是标题
```

---

#### 3. 要写的脚本

`scripts/backfill_reports.py`，接口与 `scripts/index_resources.py` 保持一致
（**先读那个文件**，命名、参数、dry-run 行为都照它）：

```bash
python3 scripts/backfill_reports.py            # dry-run，只打印
python3 scripts/backfill_reports.py --execute  # 实际写库
```

##### 转换规则

| intel_report 列 | 取值 |
|---|---|
| `title` | docx 第 6 段（跳过前 5 段固定抬头）；为空则用文件名去掉时间戳 |
| `report_type` | `reports/industry/` 下 → `industry_research`；其余 → `company_research` |
| `report_md` | 全文转 Markdown，见下 |
| `report_file` | 相对仓库根的路径，如 `reports/customer/xxx.docx` |
| `company_id` | **从 `resource` 表取**：`SELECT company_id FROM resource WHERE file_path = ?`。不要重新做名称匹配 |
| `status` | `published` |
| `created_by` | `backfill_reports.py` |
| `created_at` / `updated_at` | 文件的 mtime，不是当前时间 |
| `industry_l1` / `industry_l2` / `brand_id` / `opp_id` / `params_json` | 留空（`params_json` 是 NOT NULL，写 `'{}'`） |

##### docx → Markdown

- 段落：直接作为一行，空段跳过
- 标题样式（`p.style.name` 以 `Heading` 开头）：按级别加 `#`
- 表格：转标准 Markdown 表格，第一行当表头
- **不要引入 pandoc 或其他外部二进制**，只用 `python-docx`

##### 回写 resource

入库后把 `resource.report_id` 指到新建的 `intel_report.id`：

```sql
UPDATE resource SET report_id = ? WHERE file_path = ?
```

这样调研库详情页才能列出「这份报告对应的原始文件」。

---

#### 4. ⚠️ 四个陷阱

##### 4.1 幂等

以 `report_file` 为准判重。已存在同路径的记录就 **UPDATE 正文**，不要再插一条。
脚本要能反复跑，将来新增 docx 时直接重跑。

##### 4.2 `intel_report` 五个列是 NOT NULL

```
report_type  params_json  report_md  report_file  status  created_by
```

缺一个 INSERT 就失败。没有值的写空字符串或 `'{}'`，不要写 NULL。

##### 4.3 同一公司有多版本

`杭州川方至医疗器械有限公司` 有 5 份 docx（同一天跑了多轮）。
**每份都单独入库**，不要只取最新 —— 它们是不同时间点的快照，
`resource` 表里也是分别登记的。靠 `created_at` 排序区分。

##### 4.4 不要动 `resource` 表的其他列

只 UPDATE `report_id`。`company_id`、`sha256`、`collected_at` 都是
`index_resources.py` 维护的，改了下次重跑会冲突。

---

#### 5. 验收

```bash
# 1. dry-run 应列出 11 份，且 9 份能从 resource 拿到 company_id
python3 scripts/backfill_reports.py

# 2. 执行后
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM intel_report"          # 应为 13（原 2 + 新 11）
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM intel_report WHERE LENGTH(report_md) > 500"   # ≥ 11
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM resource WHERE report_id IS NOT NULL"         # 应为 11

# 3. 幂等：再跑一次，行数不变
python3 scripts/backfill_reports.py --execute
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM intel_report"          # 仍为 13

# 4. 抽查一份，正文里应能搜到公司名
sqlite3 data/mwlab.db "SELECT title, LENGTH(report_md), report_file FROM intel_report WHERE report_type='company_research' LIMIT 3"

# 5. 接口仍正常，且一阶不含 report_md
curl -s -b "session=$T" '/api/research?size=3' | jq '.items[0]|keys'
```

**改库前先 `cp data/mwlab.db data/backups/mwlab_pre-taskD-$(date +%Y%m%d).db`。**

---

## V2-07 · 任务 G 机会详情页

<!-- 原文件：docs/TASK-G-opportunity-detail.md -->

### 任务 G · 机会详情页 `/opportunity/[id]`

**前置**：D（回填后关联报告才有内容）
**参照**：`app/overview/page.tsx`（服务端聚合页）、`design/MWLAB 六屏精修稿.dc.html` 第 5 屏
**接口**：`/api/opportunity/[id]` **已就绪，六块数据一次返回**
**替换**：现在的 `Placeholder` 占位

**这是全系统价值链的兑现处**：机会挂上公司 → 该公司名下的调研报告与
企查查原始数据自动出现在这里。做砸了，前面所有资源索引工作都白做。

---

#### 1. 接口返回

```json
{
  "opportunity": { …全字段，detail_json 已解析成对象… },
  "company":     { …关联公司全字段，可为 null… },
  "brand":       { …关联展会品牌 + 最新一届数据，可为 null… },
  "resources":   [ { resource_id, kind, title, file_path, mime, size_bytes, collected_at, source } ],
  "events":      [ { event_id, event_type, content, file_path, occurred_at, created_by, created_at } ],
  "reports":     [ { id, title, report_type, status, updated_at } ]
}
```

**`resources` 里既有直接挂在本机会上的，也有挂在其关联公司上的** ——
接口已经合并好了，页面直接渲染，不要再过滤。

---

#### 2. 页面结构

```
┌ 返回机会台
├ 头部：标题 · 业务线徽标 · 五档阶段步进器 · 负责人 · 下一步(带到期日)
├─────────────────────────────────────────────────────┬──────────────┐
│ 左栏 65%：四个 tab                                   │ 右栏 35%     │
│   概览 / 深度调研 / 时间线 / 关联展会                 │  关联公司    │
│                                                      │  对标 MD 品牌 │
│                                                      │  规模数据     │
│                                                      │  资源下载列表 │
└──────────────────────────────────────────────────────┴──────────────┘
```

##### 2.1 头部

- 标题 24px；`type` 徽标用中文（并购标的 / 全新品类 / 项目组支持）
- **五档阶段步进器**：contact → intent → dd → audit → closing，当前档高亮。
  用中性色，**不要用 `--color-brand`**（那是 logo 专用）
- 阶段可点击直接推进，调 `PATCH /api/opportunity/[id]`，
  成功后 `router.refresh()`。机会台的行内改阶段已经是这个做法，照它
- 下一步 + 到期日；逾期用 `--color-error-text`

##### 2.2 左栏 tab

| tab | 内容 | 空态 |
|---|---|---|
| **概览** | `detail_json` 按 `type` 展开：ma 显示对价区间/股权比例/评估基准日；greenfield 显示市场规模/现有玩家/可行性；project_support 显示需求方/交付物 | 「尚未填写详细信息」 |
| **深度调研** | `reports[]` 列表，点开进 `/research/[id]` | 「还没有关联的调研报告」+ 说明「挂上公司后会自动带出该公司名下的报告」 |
| **时间线** | `events[]` 倒序。`stage_change` 显示为「接洽 → 意向」，`note`/`meeting`/`file` 各有形态 | 「还没有记录」 |
| **关联展会** | `brand` 的品牌名/城市/主办方/行业 + 最新一届的面积/展商/观众 | `brand` 为 null 时整个 tab 隐藏，不要显示空 tab |

##### 2.3 右栏

- **关联公司**：公司名 / 统一社会信用代码 / 法定代表人 / 成立日期 / 经营状态。
  为 null 时显示「未关联公司」+ 一句「关联后可自动带出其调研报告与原始数据」
- **规模数据**：`brand` 的面积 / 展商 / 观众三个数，用 `.num` 等宽
- **资源**：`resources[]` 按 `collected_at` 倒序。每行 kind 徽标 + 标题 + 大小 + 下载。
  下载用 `<a href="/api/resource/{id}/download" download>`，
  **不要 fetch + createObjectURL**（会把整个文件读进内存）

---

#### 3. ⚠️ 六个陷阱

##### 3.1 `detail_json` 已经是对象

接口出口已经 `JSON.parse` 过了，**不要再 parse 一次**。
脏数据时接口会降级成 `{}`，页面按空处理即可。

##### 3.2 三个业务线的 `detail_json` 键不同

```
ma               valuation_range · equity_pct · baseline_date · ebitda · audit_confidence
greenfield       market_size · existing_players · dead_brand_ids · feasibility
project_support  requester · deliverable · partner_company_ids
```

按 `opportunity.type` 分支渲染，缺失的键跳过不显示，**不要显示 undefined**。

##### 3.3 `type` 与 `deal_type` 是两个维度

`type` 是业务线（决定 tab 与 detail_json 结构），
`deal_type`（收购/并购/参股/承办/孵化）**只对 `type='ma'` 有意义**，
其余业务线为 null。不要混用，也不要给 greenfield 显示交易形式。

##### 3.4 阶段推进必须走 PATCH

不要直接写库、不要用别的端点。
`PATCH /api/opportunity/[id]` 会**自动写一条 `stage_change` 事件** ——
那是日后计算阶段驻留天数与转化率的唯一数据源，绕过就等于永久丢数据。

##### 3.5 软删除不是硬删

若做归档按钮，调 `DELETE /api/opportunity/[id]`，它是软删除
（`is_archived=1`）。**不要**做物理删除入口 —— 机会记录着尽调过程，
删了会连带丢掉 `opportunity_event` 里的时间线。

##### 3.6 不要动配色与 logo

色板刚由暗转浅、logo 刚重建，两者上线前由 Stitch 整体重做。
只用现成 token，不新增颜色，不碰 `--color-brand`。

---

#### 4. 验收

```bash
npx tsc --noEmit && npm run build    # 零错误零告警

# 造一条挂了公司的机会（上海励泰名下有 2 份资源）
CID=$(sqlite3 data/mwlab.db "SELECT company_id FROM company WHERE name='上海励泰展览服务有限公司'")
curl -s -b "session=$T" -X POST localhost:3000/api/opportunity \
  -H 'Content-Type: application/json' \
  -d "{\"type\":\"ma\",\"title\":\"验收用\",\"stage\":\"dd\",\"company_id\":$CID}"

# 打开详情页，必须同时看到：
#   右栏「关联公司」显示 上海励泰展览服务有限公司 / 桂芳金 / 存续
#   右栏「资源」列出 2 份（1 docx + 1 json），下载按钮可点且下到的是文件不是 HTML
#   深度调研 tab 列出该公司的报告（任务 D 回填后应有 1 份）

# 阶段推进会留痕
curl -s -b "session=$T" -X PATCH localhost:3000/api/opportunity/{id} \
  -H 'Content-Type: application/json' -d '{"stage":"audit"}'
sqlite3 data/mwlab.db "SELECT event_type, content FROM opportunity_event ORDER BY event_id DESC LIMIT 1"
#   应为 stage_change | dd → audit

# 清理验收数据
sqlite3 data/mwlab.db "DELETE FROM opportunity_event WHERE opp_id=(SELECT opp_id FROM opportunity WHERE title='验收用'); DELETE FROM opportunity WHERE title='验收用';"
```

**最关键的一条**：挂了公司的机会，详情页必须能看到该公司的资源并下载成功。
这条不过，整个任务视为未完成。

---

## V2-07 · 任务 G 返工单

<!-- 原文件：docs/TASK-G-REWORK.md -->

### 任务 G · 返工单（第 1 轮）

**日期**：2026-09-17
**质检依据**：`docs/TASK-G-opportunity-detail.md` §4 验收 + §3 陷阱 + `DEV-ORDER-AND-QC.md` §2.2 通用门禁
**结论**：**不合格，四条返工。** 功能主线是通的，最关键一条（挂了公司的机会能看到并下载该公司资源）已过。

按 `DEV-ORDER-AND-QC.md` §2.3，本单只写「哪条失败、期望是什么、实际是什么」，不给实现。

---

#### 先说过了的（不用再动）

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` | 零错误 |
| `npm run build` | 零错误零告警 |
| `npm test` / `pytest` | 29 passed / 135 passed |
| 硬编码色值、Tailwind 内置灰、`color-brand` 三条 grep | 全部干净 |
| 数据基线 §3 十一项 | 全部吻合（`intel_report` 13、`schema_version` 17） |
| §4 关联公司显示 上海励泰 / 桂芳金 / 存续 | 过 |
| §4 资源 2 份，下载到文件不是 HTML | 过（docx 回 OOXML 45,828 B；json 回 JSON 8,615 B） |
| §4 深度调研 tab 列出任务 D 回填的报告 | 过 |
| §4 PATCH 推进阶段写 `stage_change` | 过 |
| §3.1～§3.6 六个陷阱 | 全部没踩 |
| 只读账号 | PATCH 返回 403，界面禁用步进器并提示，正确 |

把六块 SQL 抽到 `lib/queries/opportunity.ts` 让页面与接口共用 —— 规格写的是「接口已就绪」，
严格讲动了不该动的文件，但逐句比对过 SQL 一字未改，且 `lib/queries/overview.ts` 早有同样先例，
服务端组件本来就不该对自己发一次 HTTP。**这个改动认可，保留。**

---

#### G-1 · 验收数据没清理，且留下一个活的管理员账号

**失败的验收条目**：规格 §4 最后一条命令（清理验收数据）。

**期望**：验收跑完后库里不留任何验收痕迹。

**实际**：

```
opportunity        opp_id=2「验收用」               仍在
opportunity_event  opp_id=2 名下 7 条                仍在
user               qc-taskg-admin@mwlab.internal    role=admin     is_active=1
                   qc-taskg-ro@mwlab.internal       role=readonly  is_active=1
```

两点要注意：

1. `user` 表不在 `DEV-ORDER-AND-QC.md` §3 的数据基线里，所以行数核对发现不了这个污染。
   以后自建验收账号，**必须连账号一起清**。
2. `qc-taskg-admin` 是 **role=admin、is_active=1 的活账号**，密码只有 DS 知道。
   留在库里等于多了一把管理员钥匙，这是本单里唯一的安全类缺陷，**优先处理**。

`opportunity_event` 里 `event_id=7`（`closing → audit`）是质检时 PATCH 产生的，不是 DS 的，一并删。

**做完自查**：`user` 表应只剩 3 行（admin / manager / readonly），`opportunity` 只剩 `opp_id=1`。

---

#### G-2 · 时间线的排序字段和显示字段不是同一个

**失败的验收条目**：规格 §2.2「时间线 tab：`events[]` 倒序」。

**期望**：时间线上从上到下，显示出来的时间递减。

**实际**：查询按 `created_at DESC` 排序，界面显示的是 `occurred_at || created_at`
（`app/opportunity/[id]/opportunity-detail.tsx:403`）。两个字段不是一个，于是：

```
记录        2026-09-17 15:33:22
会议        2026-09-20 14:00      ← 排在第二，时间却是全列表最晚的
上传附件    2026-09-17 15:33:22
已完成      2026-09-17 15:33:22
交割 → 审计  2026-09-17 07:38:04
```

只要有人填了 `occurred_at`（补记上周开过的会、预排下周的会），顺序就是乱的。
`occurred_at` 存在的意义就是让事件能脱离录入时间，所以这不是极端情况，是常态。

**要求**：排序键与显示键改成同一个。往哪边统一由 DS 定，但要在 PR 里写明选了哪边、为什么。

注：`ORDER BY created_at DESC` 是原接口带过来的，不是 DS 写的；
显示 `occurred_at` 是 DS 的选择。两者配在一起才出的这个问题。

---

#### G-3 · 删掉右栏的「规模数据」区块

**这不是 DS 的错，是规格重复了** —— §2.2 让关联展会 tab 显示「最新一届的面积/展商/观众」，
§2.3 又让右栏显示「规模数据」，是同样三个数。DS 两处都做了，照规格是对的。

**实际效果**：同一屏上 `110,000 / 1,035 / 54,000` 出现两次。

**Max 已定**：**删右栏那一块，保留「关联展会」tab 里的「最新一届规模」。**
理由是右栏其余三块（关联公司 / 对标 MD 品牌 / 资源）是常驻的，
而规模数据只在 `brand` 存在时才有内容，挂在 tab 里更合适。

规格 §2.3 的「规模数据」条目作废，本单即为修订依据。

---

#### G-4 · 右栏「关联公司」的右上角塞了中文，且内容重复

**失败的验收条目**：无对应验收条目，属界面一致性问题。

**期望**：右栏每个区块右上角是拉丁小字标签，同列节奏一致
—— 现在是 `ENTITY` / `BENCHMARK` / `RESOURCES`。

**实际**：`CompanyRail` 给 `Section` 传了 `note={company.company_status}`，
右上角显示成「存续（在营、开业、在册）」。两个问题：

1. 打断了那一列全拉丁小字的规律，一串中文长文案挤在那儿；
2. 下面「经营状态」行已经显示了同一个值，同一区块里重复了一遍。

**要求**：右上角回到拉丁标签，经营状态只在下面那行出现一次。

---

#### G-5 · 把资源列表提成共用组件

**这也不是 DS 的错** —— 规格里没写过共用要求，`ResourceList` 定义在
`app/opportunity/[id]/opportunity-detail.tsx:542`，是这个文件的局部组件，合理。

但下一个任务 **C（公司库 + 调研库）的公司详情页要的是同一个东西**：
`TASK-C-list-detail-pages.md` §56 的资源区规格与 `TASK-G` §2.3 逐字对得上
—— 同样按 `collected_at` 倒序、同样 kind 徽标 + 标题 + 大小 + 下载按钮。
分两次写就是两份实现，之后要么长期并存要么返工合一份。

**要求**：把它提到 `components/` 下成为共用组件，`app/opportunity/[id]` 改为引用。
组件只接收资源数组，不夹带机会或公司的业务判断 —— 任务 C 要原样复用它。

空态文案是唯一需要留口子的地方：机会详情页现在写的是
「这一机会及其关联公司名下还没有资源」，公司详情页说法不一样。

---

#### 交回前自查

```bash
npx tsc --noEmit && npm run build          # 零错误零告警
npm test && python3 -m pytest tests/ -q    # 两套全绿

sqlite3 data/mwlab.db "SELECT COUNT(*) FROM user"                     # 3
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM opportunity"              # 1
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM opportunity_event WHERE opp_id=2"   # 0
```

界面上再看三眼：时间线时间是否递减、右栏是否只剩三块、关联公司右上角是否回到拉丁标签。

**改库前一律** `cp data/mwlab.db data/backups/mwlab_pre-taskG-rework-$(date +%Y%m%d).db`。

---

## V2-08 · 任务 C 公司库 + 调研库

<!-- 原文件：docs/TASK-C-list-detail-pages.md -->

### 任务 C · 公司库 + 调研库（列表与详情页）

**前置**：D（历史 docx 回填）—— 否则调研库打开是空的。
> 规格初稿写的是「前置：E 先做完」，与 `DEV-ORDER-AND-QC.md` §1 定的 G→C→E→F 顺序相反。
> 以顺序表为准：**C 的界面文案先写死中文**，i18n 由任务 E 一次扫全站接线。
**参照实现**：`app/opportunity/pipeline.tsx`（一阶列表）、`app/overview/page.tsx`（服务端聚合页）
**接口**：`/api/company`、`/api/company/[id]`、`/api/research`、`/api/research/[id]` **均已就绪**
**验收**：见 §6

**动手前把参照实现完整读一遍。本任务是照它套，不是重新设计。**

---

#### 1. 要写的文件（4 个）

| 文件 | 替换 |
|---|---|
| `app/company/page.tsx` | 现在的 `Placeholder` 占位 |
| `app/company/[id]/page.tsx` | 新建 |
| `app/research/page.tsx` | 现在的 `Placeholder` 占位 |
| `app/research/[id]/page.tsx` | 新建 |

列表页若需要交互（筛选/分页/搜索），拆成 `page.tsx`（服务端壳）+
`xxx-list.tsx`（客户端），与机会台的 `page.tsx` + `pipeline.tsx` 同构。

---

#### 2. 公司库

##### 2.1 列表 `/company`

```
一阶列（只要这 5 列，不要加）
  公司名称 · 类型 · 经营状态 · 法定代表人 · 更新时间

筛选   type / company_status / source_type
搜索   q（打到 name 与 credit_code）
排序   updated_at(默认) / name / prospect_score
分页   size 50
```

> 第五列原本是「城市」，但 `company.city` 全表 501 行皆空
> （`prospect_score` / `name_en` / `country` / `contact_status` 同样全空，别拿它们做列）。
> 2026-09-17 改用 `oper_name`（468/501 有值）。city 列仍留在表里，采集到了再议。
> `排序` 里的 `prospect_score` 是空列，排了等于没排，留着是因为接口白名单已有，不碍事。

基线：**501 条**。其中 494 条来自 CIBS2026 展商批量线索，
6 条是做过深度尽调的标的（励泰两家 / 华尔科技 / 杭州川方至 / 仁然 / 奥利弗）。

##### 2.2 详情 `/company/[id]`

接口一次返回五块，全都要落到页面上：

```json
{ "company":{...}, "brand":{...|null}, "resources":[...],
  "opportunities":[...], "reports":[...] }
```

| 区块 | 内容 |
|---|---|
| 头部 | 公司名 + 类型徽标 + 经营状态 |
| 工商信息 | 统一社会信用代码 / 法定代表人 / 成立日期 / 注册号 / 注册地址 / 邮箱 |
| **资源** | `resources[]`，按 `collected_at` 倒序。每行：kind 徽标、标题、大小、采集时间、**下载按钮** |
| 关联机会 | `opportunities[]`，一阶字段，点击进 `/opportunity/[id]` |
| 关联报告 | `reports[]`，点击进 `/research/[id]` |
| 关联展会品牌 | `brand`，为 null 时整块不渲染 |

**资源区是这个页面的重点**。

**这块组件已经存在，直接复用，不要重写**：`components/resource/ResourceList.tsx`。
任务 G 的机会详情页在用同一个，规格与这里的资源区逐字对得上（倒序、kind 徽标、
标题、大小、采集时间、下载按钮），所以它已经从 G 里提出来放进 `components/` 了。
再写一份等于同一张列表维护两处，早晚漂移。

```tsx
<ResourceList resources={data.resources} emptyText="这家公司名下还没有资源" />
```

`emptyText` 是唯一留的口子 —— 机会详情页那边写的是「这一机会及其关联公司名下还没有资源」，
这里的说法不一样。除此之外组件不接任何业务判断，别往里加公司相关的分支。

下载链接由组件自己指向 `/api/resource/{resource_id}/download`，用 `<a href download>`，
不要 fetch 再 createObjectURL —— 那会把整个文件读进内存。

---

#### 3. 调研库

##### 3.1 列表 `/research`

```
一阶列   标题 · 类型 · 状态 · 关联公司 · 更新时间
         外加 excerpt 作为列表项下的一行摘要（接口已返回）
筛选     report_type / status
搜索     q（打到 title 与 target_company）
```

> `company_id` 筛选已从规格删除（2026-09-17）：501 家公司做不成 pill，
> 而公司详情页的「关联报告」区块已经能到达同样的结果。接口仍支持该参数，只是界面不给入口。

`report_type` 的中文映射：

```
batch_prospect     批量线索
industry_research  行业调研
company_research   公司尽调
```

##### 3.2 详情 `/research/[id]`

```json
{ "report":{...含完整 report_md}, "company":{...|null}, "resources":[...] }
```

- **`report_md` 用 Markdown 渲染**，容器加 `className="prose-cjk"`
  （中文排版规范 R3：长文行高 1.8，已在 `globals.css` 里定义好）
- 渲染库用 `react-markdown` + `remark-gfm`（表格）。
  **先检查 `package.json` 有没有；没有就装，并在 commit 里说明新增了依赖。**
- 右栏：关联公司卡片 + `resources[]` 下载列表
- `report_md` 为空时显示空状态，不要渲染成一片空白

---

#### 4. ⚠️ 六个陷阱

##### 4.1 主键名各不相同

```
company       → company_id
intel_report  → id          ← 调研库用的是裸 id
opportunity   → opp_id
resource      → resource_id
```

路由参数、key、跳转链接逐处核对，不要一路复制。

##### 4.2 `company` 与 `intel_report` 没有 `is_archived`

机会台的每条查询都带 `WHERE is_archived = 0`，这两张表**没有这一列**。
照抄会 `no such column`。也**不要**给它们做删除按钮。

##### 4.3 一阶绝不能出现 `report_md`

`intel_report.report_md` 可达几万字。列表页只用接口返回的 `excerpt`
（已经是 `SUBSTR(report_md,1,160)`）。
**不要自己再去请求详情接口来拼列表**。

##### 4.4 下载链接不要做成 fetch + blob

见 §2.2。`/api/resource/[id]/download` 返回的是文件流，
浏览器原生下载即可。中文文件名的 `Content-Disposition` 已经按 RFC 5987 处理过了。

##### 4.5 空状态不要省

四个页面都要有：加载骨架 / 空列表 / 筛选无结果 / 加载失败带重试。
参照 `pipeline.tsx` 里的 `Empty` 组件，直接复用它的形态。
**`/company` 有 501 条不会空，但 `/research` 在任务 D 跑之前只有 2 条**，
筛选一下就空了。

##### 4.6 不要动配色与 logo

色板刚由暗转浅、logo 体系刚重建，两者**上线前都要由 Stitch 整体重做**。
只用现成 token，不要新增颜色、不要改 `BrandLockup`。

---

#### 5. 与 5.5 的边界

`/opportunity/[id]` 机会详情**不在本任务内**，Claude 来做。
但公司详情里的「关联机会」要能跳过去 —— 那个占位页已经存在，跳过去不会 404。

---

#### 6. 验收

```bash
npx tsc --noEmit && npm run build          # 零错误零告警

# 起服务后（T 为 admin session token）
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/company     # 200
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/research    # 200

# 公司详情：取一个有资源的（上海励泰，company_id 见下）
CID=$(sqlite3 data/mwlab.db "SELECT company_id FROM company WHERE name='上海励泰展览服务有限公司'")
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/company/$CID  # 200
#   页面上应能看到 2 份资源（1 docx + 1 json）且下载按钮可点

# 下载确实是文件流，不是 HTML
RID=$(sqlite3 data/mwlab.db "SELECT resource_id FROM resource WHERE file_path LIKE '%上海励泰%.docx'")
curl -s -D - -o /tmp/t.docx -b "session=$T" localhost:3000/api/resource/$RID/download | grep -i content-type
#   应为 application/vnd.openxmlformats-officedocument.wordprocessingml.document
```

人工检查：
- 列表页字段数与 §2.1 / §3.1 完全一致，**没有多塞列**
- 调研库详情的 Markdown 正文容器带 `prose-cjk`
- ~~切到 EN 后页面无中文~~ —— **本任务不验**，i18n 归任务 E，E 做完回来补这一条

---

## V2-09 · 任务 E 全站 i18n

<!-- 原文件：docs/TASK-E-i18n-wiring.md -->

### 任务 E · 全站 i18n 接线

**前置**：无
**验收**：见 §5 的 grep，`app/` 与 `components/` 下界面文案零硬编码中文

---

#### 1. 现状

`locales/zh.json` 与 `locales/en.json` 各 159 键已就绪，
但**只有登录页真正在用**。其余组件的中文全是硬编码：

```
app/opportunity/new-drawer.tsx    27 处
app/overview/page.tsx             23 处
app/opportunity/pipeline.tsx      19 处
app/setting/setting-content.tsx    9 处
components/layout/Sidebar.tsx      8 处
components/settings/*.tsx         17 处
app/profile/profile-content.tsx    3 处
其余占位页                        ~14 处
```

**不接线的后果**：英文版只有登录页是英文，进系统全是中文。
而英文版的读者是德方总部。

---

#### 2. 机制：服务端读字典，往下传 props

**不要引入 Context Provider、不要用 next-intl、不要在客户端读 cookie。**
沿用登录页已验证的模式：

```tsx
// 服务端页面
import { getDict } from "@/lib/i18n"
export default async function Page() {
  const t = await getDict()
  return <ClientThing t={t} />
}
```

```tsx
// 客户端组件
"use client"
import type { Dict } from "@/lib/i18n-shared"
export default function ClientThing({ t }: { t: Dict }) {
  return <h1>{t.pipeline.title}</h1>
}
```

**理由**：语言状态只有 cookie 一处来源。登录态就是因为客户端和服务端
各存一份才出过「前端以为已登录、接口全 401」的事故
（见 `lib/session.ts` 顶部注释）。i18n 不重蹈。

##### 已是服务端组件、直接取字典

`app/layout.tsx` · `app/overview/page.tsx` · `app/profile/page.tsx` ·
`app/company|research|expo/page.tsx` · `app/opportunity/[id]/page.tsx`

##### 需要从上层接 props

`components/layout/Sidebar.tsx` ← 由 `AppShell` 传
（`AppShell` 是服务端组件，在 `layout.tsx` 里已能拿到 `t`，加一个 prop 传下去）

`app/opportunity/pipeline.tsx` 与 `new-drawer.tsx` ← 由 `app/opportunity/page.tsx` 传

`app/setting/setting-content.tsx`、`components/settings/*` ← 由 `app/setting/page.tsx` 传

---

#### 3. 键的增补

现有 159 键覆盖不全。缺的自己加，**两份 JSON 必须同步**，规则：

| 规则 | 说明 |
|---|---|
| 分节 | 按页面分：`pipeline` / `overview` / `company` / `research` / `settings` / `profile` / `placeholder` |
| 复用 | 通用词（保存/取消/搜索/全部/加载中）放 `common`，不要每页复制一份 |
| 插值 | 用 `{count}` `{name}` 这种占位，**禁止字符串拼接**（中英语序不同） |
| **英文取短式** | 表格列头与按钮**不得直译**。`对标 MD 品牌` → `MD brand` 而非 `MD Benchmark Brand`；`录入机会` → `New` 而非 `Create Opportunity`。理由见 `docs/I18N-SPEC.md` §3：机会台 11 列在 1440px 本就放不下 |

---

#### 4. ⚠️ 五个陷阱

##### 4.1 只翻界面文案，不翻数据

用户录入的机会名称、公司名、报告标题**原样显示**，不查字典。
判断标准：这个字符串是从 API 拿来的 → 不翻；是写死在 JSX 里的 → 翻。

##### 4.2 英文版不得出现任何中文字符

已经栽过两次：语言开关标签曾是「中文」、logo 曾带「万象」。
渲染这些字必须加载 CJK 字体，违反「英文版禁止出现中文字体」。
**新增文案同理**：任何在 `lang="en"` 下会显示的字符串，`en.json` 里必须是纯拉丁。

##### 4.3 数字与日期走 Intl，不要手拼

```tsx
new Intl.NumberFormat(locale).format(n)
new Intl.DateTimeFormat(locale, { month: "short", day: "numeric" }).format(d)
```

`04-18` 在英文下应是 `Apr 18`。现有代码里 `.slice(5, 10)` 这种硬切要换掉。

##### 4.4 `lib/i18n.ts` 不能进客户端包

它引了 `next/headers`。客户端组件只能从 **`lib/i18n-shared.ts`** 导入类型和标签。
搞混会直接构建失败（Task E 开始前这个坑已经踩过一次并修复）。

##### 4.5 `.lat` 类要保留

中英混排时拉丁片段包 `<span className="lat">`，
它负责字重升一档 + `margin-inline: .25em` 的间隙（中文排版规范 R1/R7）。
换成 `t()` 时不要把这层包裹丢掉。

---

#### 5. 验收

```bash
# 1. 界面层零硬编码中文（locales/ 除外）
grep -rnE '>[^<>{}]*[一-鿿]+[^<>{}]*<' app/ components/ --include="*.tsx"
grep -rnE '"[^"]*[一-鿿]+[^"]*"' app/ components/ --include="*.tsx" | grep -v "locales"
#   两条都应为空。注释里的中文不算，只看会渲染的字符串。

# 1b. 接口错误文案也是界面文案 —— 客户端会把 error 直接渲染出来
grep -rnE "error: [\`'\"][^\`'\"]*[一-鿿]" app/api/
#   应为空。第一轮质检就是漏了这条：上面两条只扫 .tsx，
#   而错误串在 .ts 路由里，英文界面照样会显示中文报错。

# 2. 两份字典键完全对齐
python3 -c "
import json
f=lambda d,p='':{k2:v2 for k,v in d.items() for k2,v2 in (f(v,f'{p}.{k}' if p else k).items() if isinstance(v,dict) else [(f'{p}.{k}' if p else k,v)])}
z,e=f(json.load(open('locales/zh.json'))),f(json.load(open('locales/en.json')))
print('缺失:',set(z)-set(e) or '无'); print('多余:',set(e)-set(z) or '无')"

# 3. en.json 里不得有中文
python3 -c "
import json,re
s=open('locales/en.json',encoding='utf-8').read()
m=re.findall(r'[一-鿿]+',s); print('en.json 中文残留:', m or '无')"

# 4. 构建
npx tsc --noEmit && npm run build

# 5. 人工：切到 EN，走一遍 登录 → 盘面 → 机会台 → 录入抽屉，
#    页面上不应出现任何中文字符
```

---

## V2-09 · 任务 E 返工单

<!-- 原文件：docs/TASK-E-REWORK.md -->

### 任务 E · 返工单（第 1 轮）

**日期**：2026-09-17
**质检依据**：`docs/TASK-E-i18n-wiring.md` §3 / §4 / §5 + `DEV-ORDER-AND-QC.md` §2.2 通用门禁
**结论**：**不合格，三条返工。** 主体做得扎实，返工的三条里有一条是规格自身的缺口，不全怪 DS。

按 `DEV-ORDER-AND-QC.md` §2.3，本单只写「哪条失败、期望是什么、实际是什么」，不给实现。

---

#### 先说过了的（不用再动）

| 检查 | 结果 |
|---|---|
| `npx tsc --noEmit` / `npm run build` | 零错误零告警 |
| `npm test` / `pytest` | 29 passed / 135 passed |
| 配色三条 grep | 干净 |
| §5.2 两份字典键对齐 | zh 413 = en 413，缺失 0，多余 0 |
| §5.3 `en.json` 中文残留 | 无 |
| §5.1 两条 grep | 只命中 5 处**注释**，规格明确说注释不算 |
| §4.3 数字与日期走 Intl | 日期显示 `Sep 17`；`research-*.tsx` 里两处 `.slice` 是解析失败的兜底路径，不是硬切 |
| §4.4 `lib/i18n.ts` 未进客户端包 | 所有 import 都在 `page.tsx` / `layout.tsx` |
| §4.5 `.lat` 保留 | 8 个文件仍在用 |
| §3 英文取短式 | 「录入机会」→ `New`、`MD BRAND` 而非 `MD Benchmark Brand`，合格 |
| EN 下逐页扫中文 | `/overview` `/opportunity` `/company` `/research` `/expo` `/setting` 的**界面文案**全英文，残留的都是数据（公司名、报告标题、法定代表人、`display_name`） |

另外确认：任务 C 里修过的「注销」筛选没被这次重构带坏。
`lib/enums.ts` 用两条同 slug + 去重取后者处理了带日期后缀的原值，点下去仍出 1 条 —— 这一手比返工单当初要求的到位。

---

#### E-1 · 个人资料页有 8 个中文复选框

**失败的验收条目**：§4.2「英文版不得出现任何中文字符」。

**期望**：EN 下这一页没有中文界面元素。

**实际**：整页英文，中间一整块中文。

```
Customize dashboard industry filter
  □ 休闲       □ 农业与畜牧    □ 化工与能源   □ 医疗和健康
  ☑ 机械和设备  □ 生活方式      □ 科技+        □ 零售贸易和服务
  [ Save preferences ]   1 sectors selected
```

`app/profile/profile-content.tsx:120` 的注释写着「行业名是数据（库里的 `industry_l1`），原样显示」。
按 §4.1 这是一种合理读法，**但和同一批改动里对 `company_status` 的处理不一致**：

- `company_status`（存续 / 在业 / 注销…）同样是「库里的值」，DS 把它放进了 `lib/enums.ts`，
  value 保持中文原值发给接口、标签按 locale 取；
- `industry_l1` 是 `scripts/classify_all_brands.py` 派生的**闭集，全库就 8 个取值**，
  与 `company_status` 完全同性质，却按自由文本处理了。

`lib/enums.ts` 自己的注释定了判断标准：「界面上这些是**闭集**（六七种取值），不是用户录入的自由文本」→ 翻。
行业符合这条。

**要求**：照 `COMPANY_STATUS` 的形态在 `lib/enums.ts` 加一份 `INDUSTRY_L1`，
value 保持库里的中文原值（`/api/user/preferences` 存的就是它，改了会存错），
标签进 `locales/*.json` 的 `enum.industryL1`。

**英文译名由 Max 定**，下面这张表等他填，**别自己编**：

| 库里的值 | 条数 | `en` 标签 |
|---|--:|---|
| 机械和设备 | 2,551 | _待 Max 定_ |
| 生活方式 | 1,710 | _待 Max 定_ |
| 休闲 | 854 | _待 Max 定_ |
| 化工与能源 | 676 | _待 Max 定_ |
| 科技+ | 668 | _待 Max 定_ |
| 医疗和健康 | 435 | _待 Max 定_ |
| 零售贸易和服务 | 279 | _待 Max 定_ |
| 农业与畜牧 | 228 | _待 Max 定_ |

> 「科技+」带一个 `+`，写进 JSON 和 slug 时注意别被当特殊字符处理。

---

#### E-2 · 接口错误文案只有中文，英文界面会原样显示

**失败的验收条目**：§4.2。

**期望**：EN 下报错也是英文。

**实际**（`mwlab_locale=en` 实测）：

```bash
POST /api/opportunity  -d '{"type":"ma","title":""}'
  → {"error":"机会名称必填"}
PATCH /api/opportunity/1 -d '{"stage":"zzz"}'
  → {"error":"阶段只能是 contact / intent / dd / audit / closing"}
POST /api/opportunity  -d '{"company_id":999999}'
  → {"error":"关联的公司或展会品牌不存在"}
```

这些串会直接进界面：`app/opportunity/new-drawer.tsx:96` 把接口的 `error` 接过来，
`:118` 原样渲染；`opportunity-detail.tsx` 的阶段推进、公司库/调研库详情的错误态同理。

**规格 §5 的两条 grep 抓不到它** —— 那两条只扫 `--include="*.tsx"`，
而错误串在 `.ts` 路由里。**这是验收条款的缺口，不全怪 DS。**

##### Max 已定：接口回错误码，前端查字典

接口不再返回中文句子，改返回 slug；前端按 slug 查 `t.error.*`，查不到时回退到
通用的「操作失败」，**不要把 slug 裸露给用户**。

涉及 9 个路由、26 条去重后的文案：

```
app/api/opportunity/route.ts        8 条
app/api/company/route.ts            9 条
app/api/company/[id]/route.ts       8 条
app/api/opportunity/[id]/route.ts   7 条
app/api/research/route.ts           7 条
app/api/research/[id]/route.ts      7 条
app/api/auth/login/route.ts         3 条
app/api/resource/[id]/download/route.ts  3 条
app/api/user/preferences/route.ts   1 条
```

去重后的全量文案（自己去对应路由里找位置）：

```
请求体不是合法 JSON / 请求格式错误 / 没有可更新的字段 / 字段取值不符合约束 / 必填字段不能为空
机会名称必填 / 企业名称必填 / 报告标题必填
业务线只能是… / 阶段只能是… / 交易形式只能是… / 报告类型只能是… / 报告状态只能是…
接触状态只能是… / 来源类型只能是…
优先级需为 1–5 的整数 / 意向评分需为 1–5 的整数
关联的公司或展会品牌不存在 / 关联的展会品牌不存在 / 关联的公司、展会品牌或机会不存在
已存在同名同源的记录
邮箱和密码不能为空 / 邮箱或密码错误
资源路径非法 / 资源不是普通文件 / 文件已不在磁盘上，请重新索引
```

三个注意点：

1. **「只能是 X / Y / Z」这类带枚举的**，枚举值本身是英文 slug（`ma / greenfield / …`），
   不用翻，但句子结构要走字典的插值（`{values}`），别再拼串 —— §3「禁止字符串拼接」。
2. **登录页的两条**（邮箱和密码不能为空 / 邮箱或密码错误）已经是英文界面能看到的，
   优先级最高。注意 `邮箱或密码错误` 是**故意不区分**用户名是否存在的统一文案，
   改成错误码时别顺手拆成两种。
3. `资源路径非法` 那条是路径越界的响应，**不要在错误码里回显路径**，
   原注释写了「不告诉调用方越到了哪里」，这个性质要保留。

---

#### E-3 · 日期与插值助手被复制了三份

**失败的验收条目**：无对应条目，属同一批改动内部的重复。

**期望**：一个助手一份实现。

**实际**：`lib/i18n-shared.ts` 里已经导出

```
parseLocal / fmtDate / fmtMonthDay / fmtDateTime / fmtNum / fill
```

`app/opportunity/[id]/opportunity-detail.tsx` 正确地 import 了它们。但同一批改动里：

```
app/research/research-list.tsx:49        又写了一个 fmtDate
app/research/[id]/research-detail.tsx:55 又写了一个 fill
app/research/[id]/research-detail.tsx:64 又写了一个 fmtDateTime
```

三份都带着同一段「Safari 解析不了空格分隔的时间串」的注释 —— 那正是**只该有一份**的信号。
以后修这个坑会改一处漏两处。

**要求**：`research-list.tsx` 与 `research-detail.tsx` 改为从 `lib/i18n-shared.ts` 引，
删掉本地副本。注意两边的**参数顺序不同**（本地版是 `(s, locale)`，共享版是 `(locale, s)`），
换的时候别调反。

---

#### 提及不改

`app/api/dashboard/route.ts:42` 有 `relation && relation !== '全部'` 这种跟中文字面量比较的写法
（同一文件里 `mds` 那行也是）。一旦有前端在英文下传值过来就会失效。
但目前没有任何前端调这个端点，且是 E 之前就有的代码，**本轮不动，只记一笔**。

---

#### 交回前自查

```bash
npx tsc --noEmit && npm run build          # 零错误零告警
npm test && python3 -m pytest tests/ -q    # 两套全绿

# 补上规格 §5 漏掉的那条：路由层不该再有中文错误文案
grep -rnE "error: [\`'\"][^\`'\"]*[一-鿿]" app/api/     # 应为空

# 字典仍对齐
python3 -c "
import json
f=lambda d,p='':{k2:v2 for k,v in d.items() for k2,v2 in (f(v,f'{p}.{k}' if p else k).items() if isinstance(v,dict) else [(f'{p}.{k}' if p else k,v)])}
z,e=f(json.load(open('locales/zh.json'))),f(json.load(open('locales/en.json')))
print('缺失:',set(z)-set(e) or '无'); print('多余:',set(e)-set(z) or '无')"

# en.json 仍无中文
python3 -c "
import json,re
print('残留:', re.findall(r'[一-鿿]+', open('locales/en.json',encoding='utf-8').read()) or '无')"
```

人工再看三眼：

- EN 下 `/profile` 的 8 个行业复选框是英文
- EN 下在录入抽屉里触发一次保存失败（例如挂一个已删除的公司），错误提示是英文
- ZH 下这三处仍与原来一致，公司库的「注销」药丸仍能筛出 1 条

---

## V2-10 · 任务 K 知识库

<!-- 原文件：docs/TASK-K-knowledge-base.md -->

### 任务 K · 知识库 `/knowledge`

**前置**：E（i18n 接线）—— **这一页从第一行就按字典写，不留中文硬编码**。
E 之前的页面是先写死中文再回头接线，K 晚于 E，没有这个借口。
**参照实现**：`app/research/page.tsx` + `app/research/[id]/research-detail.tsx`
（服务端壳取 locale/dict → 客户端渲染 Markdown），`app/api/resource/[id]/download/route.ts`（路径安全）
**验收**：见 §7

---

#### 1. 这一页是什么

Max 已完成项目的档案：并购 / 收购 / 新品类开拓等。**一个项目一条**，
内容是 **项目背景 + 流程 + 结果**，配图片和文档。

规模是这个任务所有设计决定的依据：**现在 3 条，上限 20 条，超过 20 条 Max 自己存档。**

所以——

| 不要做 | 为什么 |
|---|---|
| 不建数据库表 | 20 条记录不值得一张表 + 一次迁移 + 一套 CRUD 接口 |
| 不写录入表单 / 富文本编辑器 | Max 直接写 Markdown 文件，仓库里已经全是这个习惯 |
| 不写索引脚本 | 页面直接读目录，省掉「改完内容忘了重跑脚本」这类故障 |
| 不做分页 | 20 条一屏放得下 |
| 不做筛选条 | 同上。列表只有一个「显示已归档」的开关 |
| 不跟公司库 / 机会台关联 | Max 已定：独立一页。这三个项目本来就不在 `opportunity` 表里 |

**这是本仓库唯一一个「文件即数据源」的页面。** 别照着公司库/调研库那套
「接口分页 + 客户端取数」写，那是为 501 条和 13 条设计的，这里用不上。

---

#### 2. 目录约定

内容分两处放，**分界线只有一条：图片是公开的，其余都不是。**

```
knowledge/<slug>/                    ← 不对外，服务端读
  index.md                             必需。frontmatter + 正文
  docs/
    2024-协议签署版.pdf                 内部文件（合同、估值表），走 /api 下载

public/knowledge/<slug>/             ← 公开静态目录，Next 直接发
  images/
    01-site.jpg
    02-signing.png
```

##### 为什么图片能公开、正文和文档不能

图片是**展会现场照片，本身就是开放数据**（Max 2026-09-17 确认），
放 `public/` 由 Next 静态发出，省掉一整个端点。

但要清楚这意味着什么：**`public/` 下的文件不经过 `proxy.ts` 中间件**，
拿到 URL 不登录就能取。页面受登录保护 ≠ 页面里引用的静态文件受保护。

所以 `index.md`（项目背景/流程/结果的正文）和 `docs/`（合同、估值表）
**一律不许进 `public/`**。判断标准就一句：**能被陌生人看到也无所谓的，才放 public/。**

##### slug 与跳过规则

- **目录名即 slug**，URL 是 `/knowledge/2024-litai-acquisition`。
- 只允许 `[a-z0-9-]`，不符合的目录直接跳过（别报错，别渲染）。
  这条规则顺带让 `_example/` 之类下划线开头的目录自动隐身。
- 没有 `index.md` 的目录跳过。
- `docs/` 与 `public/knowledge/<slug>/images/` 都是可选的。

##### index.md 的 frontmatter

```markdown
---
title: 励泰展览并购
title_en: Litai Exhibition Acquisition
type: ma
year: 2024
status: active
summary: 从初次接洽到交割用了 11 个月，核心是把六个同名展会的主体关系问清楚。
summary_en: Eleven months from first contact to closing; the crux was untangling six same-named shows.
cover: images/01-site.jpg
---

## 项目背景
……

## 流程
……

## 结果
……
```

| 字段 | 必需 | 说明 |
|---|---|---|
| `title` | ✅ | 中文标题 |
| `title_en` | — | 缺了就回退 `title`（英文界面下显示中文标题，好过显示空） |
| `type` | ✅ | **复用已有业务线枚举**：`ma` / `greenfield` / `project_support`。标签走 `bizLineLabel(t, type)`，别自己写映射 |
| `year` | ✅ | 四位数字，列表按它倒序 |
| `status` | — | `active`（默认）/ `archived`。缺省按 `active` |
| `summary` / `summary_en` | — | 列表卡片上的一行说明 |
| `cover` | — | 写 `images/xxx.jpg`，与正文插图同一种写法。缺了列表卡片就不出图 |

**正文的三个小标题（项目背景 / 流程 / 结果）由 Max 自己在 Markdown 里写 `##`，
不要在代码里硬编码这三段结构。** 他说了「包括且不限于」，结构不稳定，
写死成三个字段等于逼他以后每加一种内容就来改代码。

##### frontmatter 怎么解析

装 `gray-matter`，别手写 YAML 解析。

手写的话要处理引号、冒号、中文、多行、注释，写出来五十行还漏边界；
`gray-matter` 是这件事的标准件。**在 commit 里写明新增了依赖**（同任务 C 的 `react-markdown`）。

> 考虑过用 `meta.json` 避免这个依赖，否决了：Max 手写 JSON 要对付尾逗号和引号转义，
> 比 YAML frontmatter 难用，而且元数据和正文分两个文件，改一个项目要开两次。

---

#### 3. 要写的文件

| 文件 | 作用 |
|---|---|
| `lib/knowledge.ts` | 扫目录、解析 frontmatter、返回列表 / 单条。**服务端专用**，用 `fs` |
| `app/knowledge/page.tsx` | 列表页（服务端组件，直接调 `lib/knowledge.ts`，不发 HTTP） |
| `app/knowledge/[slug]/page.tsx` | 详情页（同上） |
| `app/knowledge/[slug]/knowledge-body.tsx` | 客户端组件，只负责渲染 Markdown（`react-markdown` 是客户端库） |
| `app/api/knowledge/[slug]/doc/[...path]/route.ts` | **只管 `docs/` 下的文件**下载 |
| `components/layout/Sidebar.tsx` | 加一个导航项 |
| `locales/zh.json` + `locales/en.json` | 新增 `knowledge` 段与 `nav.knowledge` |
| `docs/DEPLOY.md` | 补两条 rsync（见 §5.4） |
| `knowledge/_example/index.md` | 写满所有字段的模板，给 Max 新建项目用 |

**图片没有对应的端点** —— 它在 `public/` 下，Next 自己发。

服务端页面直接调 `lib/knowledge.ts`，**不要为它建 `/api/knowledge` 列表接口** ——
页面和数据在同一个进程里，套一层 HTTP 只是给自己发请求（`lib/queries/overview.ts`
的注释里写过这件事）。

---

#### 4. 页面

##### 4.1 列表 `/knowledge`

一屏卡片网格，按 `year` 倒序、同年按 `title` 排。每张卡片：

```
┌──────────────────────────┐
│  cover 图（有就出，16:9） │
│  2024   并购标的          │   ← year + type 徽标
│  励泰展览并购             │   ← title
│  从初次接洽到交割用了…     │   ← summary，两行截断
└──────────────────────────┘
```

- 默认只显示 `status: active`。顶栏右侧一个「显示已归档」开关，打开才带出 `archived`。
- 空态一个就够：`knowledge/` 下没有合法项目时显示「还没有项目」。
  **不需要**「筛选无结果」态 —— 没有筛选条。

##### 4.2 详情 `/knowledge/[slug]`

```
← 返回知识库
标题 · year 徽标 · type 徽标 ·（archived 时多一个「已归档」徽标）
─────────────────────────────────────────┬──────────────
正文（prose-cjk + react-markdown + GFM）   │  文档下载列表
                                          │  （docs/ 下的文件）
```

- 正文容器用 `prose-cjk`，与调研库详情同一套（`globals.css` 里任务 C 已经把
  表格/列表/引用/代码都接到令牌层了，不用再补样式）。
- 右栏列 `docs/` 下的文件：文件名 + 大小 + 下载按钮。
  **不要复用 `components/resource/ResourceList`** —— 那个组件吃的是 `resource`
  表的行（有 `resource_id` / `kind` / `collected_at`），知识库的文档是文件系统里的
  裸文件，没有这些字段。硬套要么造假数据要么改坏共用组件。这里写一个简单的列表即可。
- `docs/` 为空或不存在时整块不渲染。
- slug 不存在 → `notFound()`（真 404，与 `/opportunity/[id]` 一致）。

---

#### 5. ⚠️ 五个陷阱

##### 5.1 Markdown 里的图片路径必须重写

Max 在 `index.md` 里会这么写：

```markdown
![签约现场](images/02-signing.png)
```

`react-markdown` 直接输出 `<img src="images/02-signing.png">`，浏览器按当前 URL
`/knowledge/<slug>` 解析成 `/knowledge/images/02-signing.png` —— **404，图全裂**。
图片的真实位置是 `public/knowledge/<slug>/images/02-signing.png`，
对外 URL 是 `/knowledge/<slug>/images/02-signing.png`。

用 `react-markdown` v10 的 `urlTransform` 改写：

```
images/02-signing.png  →  /knowledge/<slug>/images/02-signing.png
```

只改写相对路径。`http://` `https://` `/` `data:` 开头的原样放行。
`cover` 字段在列表页也要过同一次改写。

> 注意这里有个巧合要防：页面路由是 `/knowledge/[slug]`，图片 URL 是
> `/knowledge/<slug>/images/...`，两者前缀相同但图片走的是 `public/` 静态文件，
> 不会命中 `[slug]` 路由（Next 的静态文件优先级更高）。**验收时必须真的在浏览器里
> 看到图**，别只看 HTML 里 src 拼对了就算过。

##### 5.2 只有图片能进 `public/`

`index.md` 和 `docs/` 留在 `knowledge/` 下，不许挪进 `public/`。
理由见 §2 —— `public/` 不经中间件，进去就等于公开发布。

`lib/knowledge.ts` 扫目录时也**只扫 `knowledge/`**，不要去读 `public/`
判断图片存不存在。`cover` 指向的图丢了就是浏览器出裂图，不值得为此多一次 IO；
真要防，在卡片上给 `<img onError>` 兜一下即可。

##### 5.3 文档端点的路径拼接照现成的写法抄

先说清楚**不需要**做什么：登录这关 `proxy.ts` 已经全局做完了，
页面 307 跳登录、`/api/*` 直接 401，实测伪造 `x-user-role` 头也会被中间件剥离。
所以这个端点里的 `requireUser` 跟其余路由一样只写一行（它读中间件注入的身份，
并查库校验 `is_active`），**别按「鉴权功能」去额外设计**。

需要做的只有一件：`[...path]` 是**从 URL 里来的字符串**，
你无论如何都得写一个函数把它变成磁盘路径 —— 这个函数必须存在，不写就没有下载功能。
拒绝 `..` 只是这个函数里的一个 `if`，不是外面再加一层。
少写它不会让代码变简单，只会让 `..%2f..%2f.env.local` 也能拼出去，
而 `.env.local` 里是 `JWT_SECRET` 和企查查密钥。

照 `app/api/resource/[id]/download/route.ts` 里 `resolveSafe()` 的思路写：

- 在**字符串层**就拒绝：绝对路径、任一段是 `..` 或 `.`，直接 return null；
- 不要「先 join 再回头比前缀」；
- `path.join` 的根目录必须是**字面量**（`path.join(process.cwd(), 'knowledge', ...)`），
  否则 Turbopack 的文件追踪收敛不了，会把整个仓库打进部署产物
  （构建报 `Encountered unexpected file in NFT list`，那个文件的注释里写了原委）;
- **slug 本身也是路径的一段，同样要校验**，别只校验 `[...path]`；
- 只允许落在 `knowledge/<slug>/docs/` 里，越到 `index.md` 也算越界。

响应 `Content-Disposition: attachment`，中文文件名照那个文件里的 RFC 5987 写法
（`filename*` + ASCII 回退），别再踩一遍。

##### 5.4 两个新目录都要单独部署

`docs/DEPLOY.md` 的 rsync 是列举式的，只同步 `.next/` 和爬虫目录。
本任务新增**两个**目录，**都不加进去的话线上这一页是空的、图是裂的**：

```
knowledge/           → 正文与文档
public/knowledge/    → 图片
```

照 `crawlers/` 那两条 rsync 的格式补进 DEPLOY.md。

##### 5.5 `title` / `summary` / 正文是数据，不进字典

与 `TASK-E §4.1` 同一条规矩：公司名、报告标题、机会名称原样显示。
知识库的 `title` / `summary` / 正文同理 —— 它们有 `_en` 变体是因为 Max 自己写了两份，
不是翻译层的事。**界面文案**（「返回知识库」「显示已归档」「还没有项目」「文档」）
才进 `locales/*.json`。

`type` 是闭集，走 `bizLineLabel(t, type)`，字典里已经有 `enum.bizLine`，别新增一份。

---

#### 6. 建目录时顺手做的事

仓库里 `knowledge/` 与 `public/knowledge/` 都还不存在。建 `knowledge/_example/`
（下划线开头，按 §2 的 slug 规则会被自动跳过，不会出现在页面上），
里面放一份写满所有 frontmatter 字段的 `index.md`，当作 Max 新建项目时的模板。

真实项目内容由 Max 自己写，**不要编造三个项目的内容填进去**。

---

#### 7. 验收

```bash
npx tsc --noEmit && npm run build    # 零错误零告警

# 造两个测试项目（验收后删掉）
mkdir -p knowledge/test-alpha/docs public/knowledge/test-alpha/images
mkdir -p knowledge/test-beta
# test-alpha: status 缺省、带 cover、正文里插一张图、docs/ 放一个 pdf
# test-beta:  status: archived

curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/knowledge            # 200
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/knowledge/test-alpha # 200
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/knowledge/nope       # 404

# 图片：公开静态，不登录也能取（这是设计如此，不是缺陷）
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" \
  localhost:3000/knowledge/test-alpha/images/01.jpg        # 200 image/jpeg

# 文档：要登录
curl -s -o /dev/null -w "%{http_code}\n" \
  'localhost:3000/api/knowledge/test-alpha/doc/x.pdf'      # 401
curl -s -D - -o /dev/null -b "session=$T" \
  'localhost:3000/api/knowledge/test-alpha/doc/x.pdf' | grep -i 'content-disposition'
#   应为 attachment

# 路径穿越必须挡住（五条全部非 200）
for p in '../index.md' '../../.env.local' '..%2f..%2f.env.local' 'a/../../../.env.local' '/etc/passwd'; do
  curl -s -o /dev/null -w "$p -> %{http_code}\n" -b "session=$T" \
    "localhost:3000/api/knowledge/test-alpha/doc/$p"
done
# slug 也要试：localhost:3000/api/knowledge/..%2f..%2f/doc/x.pdf
```

人工检查：

- 列表默认看不到 `test-beta`，打开「显示已归档」才出现
- **详情页正文里的插图在浏览器里真的显示出来了**（§5.1），不是裂图
- 右栏文档点了下载到的是文件
- 切 EN：界面文案全英文，项目标题按 `title_en`（没写就回退中文标题），正文原样中文
- `knowledge/_example/` 不出现在列表里

```bash
# 清理
rm -rf knowledge/test-alpha knowledge/test-beta public/knowledge/test-alpha
```

**最关键的两条**：正文插图在浏览器里能显示（§5.1），以及 `docs/` 端点挡得住路径穿越（§5.3）。
任一条不过，整个任务视为未完成。

---

#### 8. 与顺序表的关系

本任务在 `DEV-ORDER-AND-QC.md` §1 里是**新增项**，插在 E 之后。
与 F（8 个端点补测试）无依赖，可以并行；但 F 的测试范围要把
`/api/knowledge/[slug]/doc` 的路径穿越加进去 —— 那是本仓库
第二个直接读文件系统的端点，值得有回归测试。

---

## V2-11 · 任务 F 接口测试

<!-- 原文件：docs/TASK-F-api-tests.md -->

### 任务 F · 8 个新 API 端点补测试

**前置**：C（含 C 新增页面的冒烟）
**参照实现**：`tests/api/dashboard.test.ts`（vitest + `_db-mock`），**先读它**
**运行**：`npm test`（vitest run）
**验收**：见 §5

---

#### 1. 现状

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

#### 2. 每个端点必测的项

不要追求行覆盖率，**测下面这些「出过事或容易出事」的点**：

##### 2.1 所有列表端点（opportunity / company / research / resource / expo）

| # | 断言 |
|---|---|
| 1 | 未带 `x-user-*` 头 → 401 |
| 2 | `size=9999` → 响应里 `size` 为 **200**（静默截断，不是报错） |
| 3 | `sort` 传非白名单值（如 `1;DROP TABLE x`）→ **不报错**，回退默认排序 |
| 4 | `total` 是**筛选后**的数，不是全表数：带筛选与不带筛选的 `total` 应不同 |
| 5 | 一阶字段与规格完全一致 —— **多一个字段也算失败** |

第 5 项对 `/api/research` 尤其重要：响应里**不得出现 `report_md` 或 `params_json`**。
这是最容易破坏二阶式原则的地方。

##### 2.2 写端点（opportunity / company / research 的 POST 与 PATCH）

| # | 断言 |
|---|---|
| 1 | `role=readonly` → 403 |
| 2 | 枚举非法（如 `type='bogus'`、`priority=99`）→ **400，且 `error` 是字典 `error.*` 里存在的码**，不是 500。任务 E 之后接口不再回中文句子（见 `TASK-E-REWORK.md` E-2），断言码、不要断言文案 |
| 3 | `PATCH` 只更新请求体里出现的字段，**未传的字段保持原值**（这是整行覆盖 bug 的防线） |
| 4 | 请求体里不在白名单的键被**静默忽略**，不报错 |
| 5 | `updated_at` 由服务端写 —— 客户端传一个假时间应被忽略 |

##### 2.3 `/api/opportunity/[id]` 的 PATCH 特有

**阶段变更必须写一条 `opportunity_event`**。断言：
把 `stage` 从 A 改成 B 后，`opportunity_event` 里新增一条
`event_type='stage_change'`、`content='A → B'`。

这条事件是日后计算阶段驻留天数与转化率的**唯一数据源**，
静默丢失不会有任何报错，只会在几个月后发现算不出来。

##### 2.4 `/api/resource/[id]/download` —— 安全测试，优先级最高

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

##### 2.5 `/api/expo` —— 连接扇出

有 **8 个品牌在同一年有两届**（春秋两季）。断言：
`total` 等于 `display_ready=1` 的品牌数（**7,378**），
且返回的 `items` 里 `brand_id` 无重复。

这个 bug 真实发生过：用 `e.year = MAX(year)` 连接导致 `total` 报 7,386。

##### 2.6 `/api/overview`

- `funnel` 必须**五档齐全**，没有数据的补 0（不能只返回有数据的档）
- `resources.total` 与 `resource` 表行数一致
- 顶层键：`kpi` / `tasks` / `reports` / `funnel` / `resources` / `week_end`

---

#### 3. ⚠️ 四个陷阱

##### 3.1 `lib/queries/overview.ts` 是共享模块

`/api/overview` 与 `app/overview/page.tsx` 共用它。
测接口时 mock 的是 `@/lib/db`，不是那个模块本身。

##### 3.2 写端点用 `getWritableDb()`，读端点用 `getDb()`

两者是不同的导出，mock 时都要处理，否则写端点的测试会拿到只读连接。
参照现有 `_db-mock.ts` 的做法，需要的话扩展它而不是另起一套。

##### 3.3 不要连真库

`tests/` 下所有测试必须 mock 掉 `@/lib/db`。
误连 `data/mwlab.db` 的写测试会污染 Max 正在录入的真实数据。

##### 3.4 `params` 是 Promise

Next 16 的动态路由里 `{ params }` 是 `Promise<{ id: string }>`，
测试里要传 `{ params: Promise.resolve({ id: "1" }) }`，不是裸对象。

---

#### 4. 文件组织

```
tests/api/opportunity.test.ts
tests/api/company.test.ts
tests/api/research.test.ts
tests/api/resource.test.ts        ← 含 download 的穿越测试
tests/api/expo.test.ts
tests/api/overview.test.ts
```

---

#### 5. 验收

```bash
npm test                      # 全绿
python3 -m pytest tests/ -q   # 全绿

npx tsc --noEmit && npm run build   # 零错误零告警
```

新增测试数应不少于 **40 条**。
穿越测试（§2.4）与 `stage_change` 留痕（§2.3）**必须有**，缺任一视为未完成。

---

#### 6. 追加：知识库文档端点（任务 K 完成后）

`/api/knowledge/[slug]/doc/[...path]` 是本仓库第二个直接读文件系统的端点，
测试照 §2.4 的 download 安全测试写：`..`、编码后的 `..%2f`、绝对路径、
越到 `index.md`、slug 本身带 `..`，全部非 200。
若 F 先于 K 完成，这一节留到 K 验收通过后补。


---

## V2-12 · 任务 H 展会底图

<!-- 原文件：docs/TASK-H-expo-basemap.md -->

### 任务 H · 展会底图 `/expo`

**前置**：E（i18n）—— 从第一行按字典写。
**参照实现**：`app/overview/page.tsx` + `lib/queries/overview.ts`（服务端聚合）、
`app/company/company-list.tsx`（筛选条 + 客户端取数）、`lib/enums.ts`（闭集取值）
**设计参考**：`docs/REBUILD-2026-09-PLAN.md` §5 Prompt D —— **只取版式，不取颜色**（见 §6.5）
**替换**：现在的 `Placeholder` 占位
**验收**：见 §8

---

#### 1. 这一页是什么

展会数据在新架构里**降级为底图**：不再是产品主体，而是给机会台做判断时查的参考层
（`docs/REBUILD-2026-09-PLAN.md` §1.2 的「展会模块降级」）。所以这一页的气质是
**安静、次要**，控件少，不抢机会台的戏。

一屏四块：

```
┌ 筛选条（行业 / 城市 / 规模），一行 ─────────────────────────────────┐
├──────────────────────────────────────┬──────────────────────────────┤
│ 地图（58%）                          │ 我的行动日历（42%）          │
│ 城市/国家为空心圆，圆大小 = 品牌数   │ 月格，每条事项一行           │
├──────────┬──────────┬──────────┬─────┴──────────────────────────────┤
│ 观众数量 │ 展览面积 │ 展商数量 │ 行业分布                          │
│ 四宫格 —— 跟随上面的筛选，不做同比（见 §4.3）                      │
└──────────┴──────────┴──────────┴────────────────────────────────────┘
```

**不做**：品牌大表、横向滚动的品牌卡片、7,401 条全量浏览。这些是 Max 2026-09-16 明确砍掉的。

---

#### 2. 与设计稿不同的两处（已核对数据后决定）

| 设计稿写的 | 实际 | 本任务怎么做 |
|---|---|---|
| 筛选条有「关系」（竞争对手/潜在伙伴/新进入者） | `exhibition_brand.competition_relation` **7,378 条 display_ready 品牌全部为空** | **不做「关系」筛选**。空字段做成筛选只会让每个选项都筛出 0 条 |
| 日历是展会档期表 | IA §5 决策 4 已定：**「我的行动日历」挂 `opportunity_event`** | 只显示机会上的事项，不显示展会档期（见 §4.2） |

---

#### 3. 数据范围

**只看 `exhibition_brand.display_ready = 1`**（7,378 条）。这是全仓库展示层的统一口径，
`/api/expo` 已经这么做了。不要用全表 7,401。

「最新一届」的取法**必须照 `/api/expo` 的 `FROM` 常量**：按 `year DESC, edition_id DESC LIMIT 1`
锁定单行。那段注释写了原因：有 8 个品牌同一年办两届，用 `year = MAX(year)` 会扇出、重复计数。

---

#### 4. 四块的内容

##### 4.1 地图

- 国内品牌按**城市**落点，海外品牌按**国家**落点（与旧看板同一口径：
  `country_cn` 为空或为「中国」算国内）。
- 圆的大小 = 该点的品牌数；空心圆，不发光、不投影。
- 悬停显示：地名 + 品牌数。点击一个点 → **把它设为城市筛选**（与筛选条联动）。
- 底图用仓库里已有的 `public/countries-110m.json`（TopoJSON）。
- **坐标表从旧看板迁过来**：`git show 1b95d87^:public/dashboard.html` 里的
  `CITY_GEO`（33 个国内城市）与 `COUNTRY_GEO`（约 90 个国家）。
  放进 `lib/geo.ts`，**不要重新编坐标**。
- 查不到坐标的地名不画，但要**计数**：地图角落显示「另有 N 个品牌未能定位」。
  不许静默丢掉 —— 那会让人以为地图就是全量。

> 城市数据的现状：`city` 字段里国内是「上海」「深圳」，海外是「日本东京」「俄罗斯莫斯科」
> 这种拼接写法。所以海外必须按 `country_cn` 落点，按 `city` 查坐标会大面积落空。

**依赖怎么装**：`public/` 下有 `d3.min.js` 与 `topojson-client.min.js`，那是旧静态页用的，
**不要用 `<script>` 引它们**。装 npm 包 `d3-geo` 与 `topojson-client`（只装这两个，
不要装整个 `d3`），在 commit 里写明新增依赖。旧的两个 js 文件本任务结束后删掉（见 §7）。

投影用 `d3-geo` 的 `geoEqualEarth` 或 `geoNaturalEarth1`，不要用旧看板那个手写的
等距矩形投影（`(lon+180)/360*W`），高纬度变形太大。

##### 4.2 我的行动日历

月格视图，默认当月，左右翻月，一个「回到本月」。

**事项来源两种，都来自机会台**：

| 来源 | 取什么 | 落在哪天 | 显示 |
|---|---|---|---|
| `opportunity_event` | `event_type = 'meeting'` 且 `occurred_at` 非空 | `occurred_at` 的日期 | 会议内容（`content`）截断 |
| `opportunity` | `next_action_due` 非空、`is_archived = 0` | `next_action_due` | 下一步（`next_action`）截断；逾期用 `--color-error-text` |

- 每条事项一行：左侧 2px 竖条 + 时间（有就显示）+ 文字。点击进 `/opportunity/[opp_id]`。
- 单日超过 3 条时显示前 3 条 + 「+N」。
- 今天的格子用实心方块标记，**用中性色**（`--color-fg`），不用橙色（§6.5）。
- 空月不需要空态插画，格子空着就是空态。

**`occurred_at` 的空字符串**：G 返工时踩过（`TASK-G-REWORK.md` G-2），
库里 `occurred_at` 可能是 `NULL` 也可能是 `''`，两种都要当「没有日期」处理。

**`occurred_at` 的格式不统一**：有 `2026-09-20 14:00`，也可能只有日期。
取日期部分用 `substr(occurred_at, 1, 10)`，时间部分有就显示、没有不显示。

##### 4.3 四宫格（不做同比）

**必须跟随当前筛选**。全库聚合没有决策价值 —— 这是重构方案 §1.2 专门记下的一条，
做成全库聚合等于这块白做。

###### 为什么不做逐年趋势和同比（设计稿里有，已核对数据后去掉）

库里的届次数据是**采集时点的快照**，不是历史序列。`display_ready` 品牌的届次按年分布：

```
2022      1
2023     56
2024  1,916
2025    379   ← 「最近一个完整年度」只有 379 届
2026  5,249   ← 绝大多数品牌只采到了今年这一届
2027     79
```

按年汇总做同比，2025 对 2024 会显示约 −80%，2026 对 2025 会显示 +1300% ——
全是采集覆盖造成的假信号，不是市场变化。**这块不做逐年趋势、不显示同比。**
等以后届次历史补齐了再说（那是数据采集的事，不在本任务内）。

> 官网落地页设计稿里「十年届次数据」的说法也不成立，任务 J 已据此改写。

###### 实际做什么

口径统一为「**筛选范围内每个品牌的最新一届**」（与 §3 同一个 `FROM`）：

| 面板 | 大数字 | 小图 |
|---|---|---|
| 观众数量 | 最新一届 `visitors_count` 之和 | 按规模四档的品牌数分布（横向 4 段） |
| 展览面积 | 最新一届 `area_sqm` 之和 | 同上 |
| 展商数量 | 最新一届 `exhibitors_count` 之和 | 同上 |
| 行业分布 | 筛选范围内的品牌数 | 按 `industry_l1` 的**单条横向堆叠条**，不是饼图 |

- 前三块的小图用同一份「规模四档」分布，档位与 §4.4 的规模筛选一致，放三遍是版式需要，
  数据只算一次。
- 大数字下方一行小字注明口径：「N 个品牌 · 各取最新一届」（走字典插值）。
  没有这行，读者会以为是某一年的市场总量。
- 某个品牌最新一届的数字为空时不计入该项求和，但仍计入品牌数 —— 小字里的 N 是品牌数。
- 行业分布的 8 个标签走 `lib/enums.ts` 的 `INDUSTRY_L1` + `t.enum.industryL1`。
  当筛选条已选了某个行业时，这块就只剩一段 —— 这是正确的，不要特殊处理。
- 图表不要轴线、不要网格线、不要图内图例，只在两端标数值。

**画图不要引图表库**。每个小图就是几个 `<div>` 按比例设宽，比装一个 recharts 省几百 KB。

字典里现有的 `basemap.trendTtm`（「TTM 环比」）随之成了孤儿键，删掉。

##### 4.4 筛选条

| 筛选 | 取值 | 控件 |
|---|---|---|
| 行业 | `INDUSTRY_L1` 的 8 个值 | 药丸，可多选 |
| 城市 | 国内城市 + 海外国家，按品牌数倒序取前 30 | 下拉，单选 |
| 规模 | 最新一届 `area_sqm`：`< 1 万㎡` / `1–5 万㎡` / `5–10 万㎡` / `≥ 10 万㎡` | 药丸，单选 |

- 三个筛选同时作用于**地图与四宫格**。**日历不受筛选影响**（它是机会台的事项，不是展会）。
- 「清除筛选」一个按钮。
- **行业筛选的初始值 = 当前用户在 `/profile` 保存的偏好**（`GET /api/user/preferences` 的 `l1s`）。
  这是那个偏好在新架构里唯一的消费方 —— 它原本是给已删除的 `public/dashboard.html` 用的，
  任务 I 会把个人资料页的说明文案改成指向这里。
  偏好为空 → 不预选，显示全部。

---

#### 5. 要写的文件

| 文件 | 作用 |
|---|---|
| `lib/geo.ts` | 城市与国家坐标表（从旧看板迁移），`resolvePoint(brand)` |
| `lib/queries/expo.ts` | 三个聚合：地图点、四宫格、日历。服务端专用 |
| `app/api/expo/stats/route.ts` | 地图点 + 四宫格，接受筛选参数。筛选变了客户端重拉这一个 |
| `app/api/expo/calendar/route.ts` | 日历事项，参数 `month=YYYY-MM` |
| `app/expo/page.tsx` | 服务端壳：取 locale / dict / 用户偏好，首屏数据直接调 `lib/queries/expo.ts` |
| `app/expo/expo-board.tsx` | 客户端：筛选条、地图、日历、四宫格 |
| `locales/*.json` | 用现有的 `basemap` 段，缺的补；**删掉 `expo.phase` / `expo.item1–4`**（占位页专用，页面上线后成了孤儿键） |

**现有的 `/api/expo` 列表端点不要动**，它是 F 的测试对象。新增两个端点放在它下面。

两个新端点都要：
- `requireUser`（与其余路由一致）；
- 筛选参数走白名单 + `?` 占位符，照 `/api/expo` 的 `FILTERS` 写法；
- 规模档位用**枚举键**（`lt1w` / `1w-5w` / …）传，服务端映射成区间，**不接受客户端传数字区间**；
- 错误回错误码，不回中文句子（`TASK-E-REWORK.md` E-2）。新增的码同步进两份字典的 `error` 段。

`month` 参数校验 `^\d{4}-\d{2}$`，不合法回 `badRequest`。

---

#### 6. ⚠️ 陷阱

##### 6.1 地图点数不能是「全部品牌」逐个画

7,378 个品牌聚合到约 120 个点。**聚合在 SQL 里做**（`GROUP BY` 城市/国家），
不要把 7,378 行拉到前端再分组 —— 那正是 `/api/dashboard` 当年被替换的原因。

##### 6.2 首屏不要等客户端再请求一次

服务端壳直接调 `lib/queries/expo.ts` 拿首屏的地图、四宫格、当月日历，作为初始 props 传下去。
客户端只在筛选变化、翻月时才请求接口。与 `/overview` 同一做法。

##### 6.3 日历的时区

库里时间是**本地时间、无时区**。「今天」在服务端按本地日期算好传下去（G 的详情页就是这么做的，
`app/opportunity/[id]/page.tsx` 里有注释），客户端算会在跨日时与服务端不一致，报 hydration 警告。
解析日期用 `lib/i18n-shared.ts` 的 `parseLocal`，**不要再写一份**（E-3 刚删过三份副本）。

##### 6.4 地图组件是客户端的

`d3-geo` 与 TopoJSON 解析只在客户端做。`countries-110m.json` 107KB，
**用 `fetch('/countries-110m.json')` 在客户端拿**，不要 `import` 进 JS 包。

##### 6.5 配色：用现有令牌，不用设计稿的色值

Prompt D 写的是暗色 + `#FE5C00` 橙色，那是 2026-09-16 的方向。**之后色板已转浅、
橙色已从界面全部移除**（`4105ff2`），只留在 `BrandLockup`。本任务：

- 只用 `globals.css` 里现有的 `--color-*` 令牌；
- 「单点强调色」一律改用 `--color-fg`（最深的中性色）；
- 通用门禁的三条 grep 必须过（无硬编码色值、无 Tailwind 内置灰、界面不碰 `color-brand`）。

地图的 SVG 填充与描边同样用 `var(--color-*)`，不许写 `#1A1A1D`。

##### 6.6 数字

全部走 `fmtNum(locale, n)`，大数字加 `.num` 类（等宽数字）。

---

#### 7. 顺手清理

`public/dashboard.html` 已删，下面这些是它的遗留，本任务一并处理：

| 对象 | 处置 |
|---|---|
| `public/d3.min.js`（273KB） | 删 —— 改用 npm 包后无人引用 |
| `public/topojson-client.min.js` | 删 —— 同上 |
| `public/countries-110m.json` | **保留**，本页在用 |

删之前 `grep -rn "d3.min\|topojson-client.min" app components public` 确认没有引用。

---

#### 8. 验收

```bash
npx tsc --noEmit && npm run build          # 零错误零告警
npm test && python3 -m pytest tests/ -q

curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/expo            # 200

# 统计端点：不带筛选时行业分布总数 = display_ready 品牌数
curl -s -b "session=$T" localhost:3000/api/expo/stats | jq '.industry | map(.count) | add'
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM exhibition_brand WHERE display_ready=1 AND industry_l1<>''"
#   两个数必须相等

# 地图点数 + 未定位数 = display_ready 品牌总数（不许静默丢）
curl -s -b "session=$T" localhost:3000/api/expo/stats | jq '(.points | map(.count) | add) + .unlocated'
#   应为 7378

# 筛选生效：选「机械和设备」后行业分布只剩一段
curl -s -b "session=$T" --get --data-urlencode "industry_l1=机械和设备" \
  localhost:3000/api/expo/stats | jq '.industry | length'                                # 1

# 非法参数
curl -s -b "session=$T" 'localhost:3000/api/expo/calendar?month=2026-13x' | jq .error    # "badRequest"
curl -s -b "session=$T" 'localhost:3000/api/expo/stats?scale=999' | jq .error            # 非 500

# 日历：造一条带会议的机会，验完删掉（DEV-ORDER-AND-QC §3.2：业务表验收后必须回到原值）
```

人工检查：

- 地图上上海、深圳、广州、东京、莫斯科都有点，圆大小看得出差别
- 点击地图上的点，筛选条的城市变了，四宫格跟着变
- `/profile` 里保存过行业偏好的账号，打开 `/expo` 行业已预选
- 四宫格没有同比数字；大数字下方有「N 个品牌 · 各取最新一届」的口径说明
- 日历里造的会议出现在对应日期，点进去是那条机会
- 切 EN：界面文案全英文；地名是数据，保持原样
- 三条配色 grep 干净

**最关键的两条**：四宫格跟随筛选（§4.3），以及地图点数 + 未定位数 = 7,378（§4.1）。

---

## V2-13 · 任务 I 设置 / 个人资料收尾

<!-- 原文件：docs/TASK-I-settings-profile.md -->

### 任务 I · 设置 / 个人资料收尾

**前置**：E（i18n）、H（`/expo` 是个人资料偏好的新消费方）
**涉及**：`app/profile/*`、`app/setting/*`、`components/settings/*`、`app/api/setting/status/route.ts`、
`app/api/dashboard/route.ts`
**验收**：见 §6

---

#### 1. 这是一个「收尾」任务，不是「新功能」任务

两页都已存在、已接好 i18n。本任务只修**旧架构留下的断头**：
`public/dashboard.html` 在阶段 5 删掉了，但这两页还在指向它、为它供数。

**不做**：用户新增 / 禁用 / 重置密码的界面，新的设置分区，头像上传。
全系统 3 个账号，这些没有需求（IA §1.2：设置页「沿用现有」）。

---

#### 2. 个人资料 `/profile` —— 三个断头

##### 2.1 保存后跳到一个不存在的页面

```
app/profile/profile-content.tsx:64   setTimeout(() => router.push("/dashboard.html"), 1500)
app/profile/profile-content.tsx:87   onClick={() => router.push("/dashboard.html")}
```

`/dashboard.html` 已删。**现在保存偏好之后 1.5 秒会跳到 404。**「返回」按钮同样。

**要求**：
- 「返回」回到 `/overview`，文案改为「返回盘面」（`profile.back`，两份字典都改；
  英文现在是什么就对应改，不要保留 Dashboard 字样）。
- 保存成功**不再自动跳转**。原地显示「已保存」，停留在本页 ——
  自动跳走是为旧看板设计的（保存完回去看效果），现在偏好作用在 `/expo`，
  页面上给一个「去展会底图查看」的文字链接即可，让用户自己决定。
- `profile.saving`（「已保存，正在跳转…」）随之不再成立，改成「已保存」。

##### 2.2 为了取 8 个行业名，把 7,401 个品牌全拉了一遍

```
app/profile/profile-content.tsx:27   fetch("/api/dashboard")
```

然后在前端 `Set` 去重得到 8 个 `industry_l1`。这 8 个值 E 返工时已经进了
`lib/enums.ts` 的 `INDUSTRY_L1`。

**要求**：复选框列表直接用 `INDUSTRY_L1`，删掉对 `/api/dashboard` 的请求。
页面首屏只剩一个请求（`GET /api/user/preferences`），或者由服务端壳直接读库传下来 ——
二选一，后者更好（与其他页面的服务端壳一致，且没有加载闪烁）。

复选框的**顺序按 `INDUSTRY_L1` 数组顺序**，不要再 `.sort()` —— 对中文原值排序在两种语言下
都没有意义，而数组本身是按品牌数从多到少排的。

##### 2.3 保存失败时静默当成功

```ts
await fetch("/api/user/preferences", { method: "PATCH", ... })
setSaved(true)
```

没检查 `res.ok`。接口 400 / 401 也会显示「已保存」。

**要求**：检查 `res.ok`，失败时用 `errorText(t, body.error, body.values, …)` 显示错误
（E-2 之后的统一写法），不显示「已保存」。

##### 2.4 说明文案改指向

`profile.industryFilter`（「定制 Dashboard 行业筛选」）与 `profile.industryFilterHint`
（「下次登录 Dashboard 将自动应用…」）说的是旧看板。改为说明它作用于**展会底图的默认行业筛选**。
措辞自己定，两份字典同步，英文不出现 Dashboard。

---

#### 3. 设置 `/setting` —— 数据状态只讲了旧主角

`DataStatusCard` 现在显示：品牌总数、展会届次、最近采集状态、最近采集耗时。
新架构的中心实体是**公司**（`REBUILD-2026-09-PLAN.md` §0 判断 2），这张卡只讲了降级后的展会。

**要求**：`/api/setting/status` 的 `data_status` 增加四个计数，卡片上并列显示：

| 键 | 取值 | 字典标签（zh） |
|---|---|---|
| `total_companies` | `company` 行数 | 公司 |
| `total_opportunities` | `opportunity` 中 `is_archived = 0` 的行数 | 在跟进机会 |
| `total_reports` | `intel_report` 行数 | 调研报告 |
| `total_resources` | `resource` 行数 | 资源文件 |

原有的品牌 / 届次 / 采集三项保留，排在新四项之后。
数字走 `fmtNum`，加 `.num`。

`tests/api/setting.test.ts` 测的就是这个接口，改完同步更新它的断言，别让测试掉。

##### 3.1 构建时间在说谎

```ts
build_time: process.env.NEXT_PUBLIC_BUILD_TIME || new Date().toISOString(),
```

环境变量没设（仓库里没有任何地方设它），于是「构建时间」显示的是**每次请求的当前时间**。

**要求**：`next.config` 里在构建时把时间写进 `NEXT_PUBLIC_BUILD_TIME`
（`env: { NEXT_PUBLIC_BUILD_TIME: new Date().toISOString() }` 这类写法）。
取不到时显示「—」，**不要回退成当前时间**。

`next_version` 同理：`process.env.__NEXT_VERSION__` 不是 Next 提供的变量，永远走回退值 `'16.x'`。
改为读 `next/package.json` 的 `version`，或者直接删掉这一行 —— 选删掉更省事，Node 版本已经够判断环境了。
删掉的话 `components/settings/SystemInfoBlock.tsx` 里对应的一行与字典键 `settings.nextVersion` 一并删。

---

#### 4. 退役 `/api/dashboard`

2.2 做完后，`/api/dashboard` **没有任何调用方了**
（`grep -rn "api/dashboard" app components lib` 只剩注释）。它是旧看板的供数端点，
一次吐回全部品牌，且里面有 `relation !== '全部'` 这种跟中文字面量比较的写法
（`TASK-E-REWORK.md`「提及不改」那一条）。

**要求**：

1. 删除 `app/api/dashboard/`；
2. 删除 `tests/api/dashboard.test.ts`（它只测这个端点）—— **在 commit 里写明删了哪个测试、为什么**，
   `npm test` 的用例数会从 29 降下来，这是预期；
3. `app/api/expo/route.ts` 顶部注释里「/api/dashboard 仍在给… 供数」那句改掉；
4. `grep -rn "api/dashboard\|dashboard\.html" app components lib docs/DEPLOY.md` 应只剩历史文档。

> 删之前再 grep 一遍确认没有调用方。如果 H 或别的任务新引用了它，停下来问，不要删。

---

#### 5. ⚠️ 陷阱

##### 5.1 偏好存的是中文原值

`user.dashboard_prefs` 存的是 `{"l1s": ["机械和设备", …]}`。
复选框的 value 必须是 `INDUSTRY_L1` 里的 **value**（中文原值），不是 slug。
改成存 slug 会让已保存的偏好全部失配，且 H 的 `/expo` 按原值筛选会筛出 0 条。

**列名 `dashboard_prefs` 不要改**。它是库里的列，改名要迁移，收益为零。

##### 5.2 ~~`requireUser` 那句注释是错的~~（本条作废，2026-09-17 质检更正）

初稿说「`requireUser` 不查 `is_active`」，**这是规格写错了**：`lib/api-guard.ts` 第 19–21 行
查了库，被禁用账号会被拒。原注释「requireUser 同时校验 is_active」是对的，已改回。

##### 5.3 设置页只有 admin 能看

`/setting` 的两个接口都是 admin 专用（403），中间件也挡了非 admin 进页面。
新增的四个计数放进同一个接口，**不要新开一个不设权限的接口**。

---

#### 6. 验收

```bash
npx tsc --noEmit && npm run build          # 零错误零告警
npm test && python3 -m pytest tests/ -q    # npm test 用例数比 29 少，少的正好是 dashboard.test.ts 那几条

# /api/dashboard 已退役
curl -s -o /dev/null -w "%{http_code}\n" -b "session=$T" localhost:3000/api/dashboard     # 404
grep -rn "api/dashboard\|dashboard\.html" app components lib                              # 应为空（注释也算，一并清掉）

# 设置接口新增四项
curl -s -b "session=$T" localhost:3000/api/setting/status | jq '.data_status | keys'
#   含 total_companies / total_opportunities / total_reports / total_resources
curl -s -b "session=$T" localhost:3000/api/setting/status | jq '.data_status.total_companies'   # 501

# 构建时间不随请求变化：连取两次，值相同
for i in 1 2; do curl -s -b "session=$T" localhost:3000/api/setting/status | jq -r .system_info.build_time; sleep 1; done

# 偏好保存失败要能看出来：readonly 以外的错误路径，例如发一个非 JSON 的体
curl -s -b "session=$T" -X PATCH localhost:3000/api/user/preferences -d 'x' | jq .error       # "badRequest"
```

人工检查：

- `/profile` 首屏在 Network 面板里**只有一个或零个**接口请求，没有 `/api/dashboard`
- 勾选两个行业保存 → 停留在本页、显示「已保存」、**不跳转**；再打开 `/expo`，这两个行业已预选
- 「返回」回到 `/overview`
- `/setting` 数据状态卡显示公司 501、在跟进机会、调研报告 13、资源文件 50，以及原有三项
- 切 EN：两页无中文界面文案，不出现 Dashboard 字样
- 数据基线：`user.dashboard_prefs` 验收后恢复原值（验收时改过就改回去）

---

## V2-14 · 任务 J 官网落地页

<!-- 原文件：docs/TASK-J-landing-page.md -->

### 任务 J · 官网落地页 `/`

**前置**：E（i18n）、H（落地页复用 H 的地图与行业堆叠条）
**设计参考**：`docs/REBUILD-2026-09-PLAN.md` §5 **Prompt E v2** —— 取**结构、语气、版式**，
**不取颜色、不取数字**（见 §2、§6.4）
**替换**：`app/page.tsx` 现在的「未登录一律跳 /login」
**验收**：见 §8

---

#### 1. 这一页是什么

`/` 按登录态分流（IA 已定）：**已登录 → 跳 `/overview`；未登录 → 渲染本页。**

本页是**不需要登录就能看到的公开页面**，读者是杜塞尔多夫展览总部与外部来访者。
Prompt E v2 的三条铁律照搬：

1. 模仿 Linear / Vercel / Hex，**不参考已删除的 `pitch.html`**；
2. **六个 section**，不多加；
3. **让数据自己说话** —— 页面主体是真实数据切面，不是叙事和自我介绍。

语气：陈述事实，不讲好处。没有口号、感叹号、「赋能」、创始人故事、路线图、开发者署名、技术栈展示。
**一句话如果能出现在创业公司路演 PPT 里，就删掉。**

---

#### 2. 设计稿里的数字不能照抄 —— 已逐项核对

Prompt E 写于 2026-09-16，其中数字是写死的，且有几个**口径本身就错**。
本页所有数字**一律在服务端从库里实时算**，不许在 JSX 或字典里写死任何计数。

| 设计稿写的 | 实际 | 本页怎么做 |
|---|---|---|
| 7,401 展会品牌 | 展示层口径是 `display_ready = 1`，**7,378** | 用 `display_ready = 1` 计数 |
| 9,740 主办方 | 9,740 是 `brand_organizer` 的**关联行数**（一个品牌多个主办方）。去重后的集团数是 `COUNT(DISTINCT canonical)` = **4,990** | 用去重后的集团数，标签「主办方集团」 |
| 7,703 历史届次 | 行数对，但「历史」不准确：其中 5,249 届是 2026 年的 | 标签用「届次记录」，不写「历史」 |
| 8,145 地理标签 | 对 | 照用 `brand_geo_tag` 行数 |
| 495 企业档案 | 已是 **501** | `company` 行数 |
| 12,302 人工核验 | 对（`manual_tag_history`） | 照用 |
| 副标题「十年届次数据」 | **不成立**。届次按年：2024 年 1,916、2025 年 379、2026 年 5,249，是采集快照不是十年序列（`TASK-H` §4.3 有完整分布） | 删掉「十年」，副标题见 §4.2 |
| 白地信号「2,061 个停办品牌」 | 口径是「没有 2026 年及以后届次的品牌」，`display_ready` 下是 **2,054**。但「停办」是推断不是事实：两年一届的展会、采集没覆盖到的届次，都会落进这一组 | 标签改为事实描述：「无 2026 年届次的品牌」，不写「停办」 |

> 最后一条尤其要守住：这是**公开页面**，写「停办」等于对 2,054 个真实展会品牌下了公开判断。

---

#### 3. 路由与中间件 —— 本任务最容易漏的一处

`proxy.ts` 对页面路由的规则是「**没有 token → 307 跳 `/login`**」，`/` 不在放行名单里。
**只改 `app/page.tsx` 是没用的**：未登录请求根本到不了页面组件，在中间件就被跳走了。

**要求**：`proxy.ts` 的「完全公开路径」里加上**精确匹配** `pathname === '/'`。

- 只放行 `/` 本身，不要写成 `startsWith('/')`（那等于放行全站）；
- 放行后，已登录用户访问 `/` 的分流仍由 `app/page.tsx` 里的 `getSessionUser()` 完成；
- `tests/proxy.test.ts` 补一条：无 token 访问 `/` → 不是 307。现有「无 token 访问页面 → 跳 /login」
  那条用的是 `/dashboard.html`，不受影响。

本页用到的数据**在服务端组件里直接查库**（`lib/queries/landing.ts`），
**不要为它开一个公开的 `/api/*` 端点** —— `/api/*` 在中间件里一律要 token，
为落地页开例外等于在 API 层挖一个不需要登录的洞。

---

#### 4. 六个 section

整页一个服务端组件取数，交给若干展示组件。内容列最宽 1200px，section 之间 160px。

##### 4.1 导航（56px，固定在顶部）

- 左：`BrandLockup`（现成组件，**不要改它**）。
- 右：锚点链接「数据 / 能力 / 业务」→ 分别滚到 §4.3 / §4.4 / §4.5；
  语言切换 **ZH | EN**；按钮「进入系统」→ `/login`。
- **没有 DE**：设计稿写的是三语，但 `locales/` 只有 zh 与 en（德文待人工翻译，
  见 `DEV-ORDER-AND-QC.md` §4）。不要放一个点了没反应的 DE。
- 语言切换照登录页的写法：写 `mwlab_locale` cookie 后刷新
  （`app/login/login-form.tsx:38`）。**抽成一个共用组件**给登录页和本页一起用，
  不要复制第二份。

##### 4.2 首屏

左对齐，只有三样东西：

- 大标题两行（中文：「中国展会市场的 / 结构化盘面」，英文自拟，同样两行以内）；
- 一行副标题，数字走插值：
  「{brands} 个展会品牌 · {groups} 个主办方集团 · {editions} 条届次记录。为杜塞尔多夫展览的业务拓展提供事实基础。」
- 一个主按钮「进入系统」+ 一个文字链接「查看数据覆盖 →」（锚到 §4.3）。

标题下方是**产品截图**：真实软件界面，1px 发丝边框、12px 圆角、底边渐隐到页面背景。

- 截图文件 `public/landing/product.webp`，截的是 **`/expo`**（H 完成后的展会底图）。
- **不许截 `/opportunity`、`/company`、`/research`、`/overview`** —— 这是公开页面，
  那几页上是机会名称、公司工商信息、尽调报告标题，都是内部数据。
  `/expo` 上只有公开采集的展会数据，可以放。
- DS 没有截图条件的话，先放一个同尺寸、带边框的空框占位，**质检时由 Claude 截图补上**。
  不要用 AI 生成的假界面图。

##### 4.3 数据覆盖带

一整行，竖向发丝线分成 6 格，上下各一条发丝线。每格：大号等宽数字 + 小号标签。

```
{brands} 展会品牌 | {groups} 主办方集团 | {editions} 届次记录
| {geoTags} 地理标签 | {companies} 企业档案 | {verified} 人工核验
```

下方一行小字：「数据来源全程可溯 · 每月两次增量更新」。
（「每月两次」是 `scripts/run_pipeline.sh` 的 crontab：每月 7 日与 27 日，属实。）

##### 4.4 数据切面（主 section）

小标题「数据切面」，大标题「同一份数据，六种读法」，然后是 3×2 六块面板。
每块：标题 + 一行说明 + 一个真实数据小图。**图不要网格线、不要图内图例，只在两端标数值。**

| # | 标题 | 数据 | 图 |
|---|---|---|---|
| 1 | 地理分布 | H 的地图点位 | **复用 H 的地图组件**，关掉交互（不响应点击、不改筛选） |
| 2 | 主办方集团 | `brand_organizer` 中 `org_type = '企业'`，按 `canonical` 统计 `display_ready` 品牌数，取前 6 | 横向条形列表。**杜塞尔多夫展览那一条用强调样式**（§6.4） |
| 3 | 行业结构 | 8 个 `industry_l1` 的品牌数 | **复用 H 的行业堆叠条** |
| 4 | 规模排名 | 最新一届 `area_sqm` 前 6：品牌名 / 城市 / 面积 / 展商数 | 紧凑表格，数字右对齐 |
| 5 | 档期分布 | 2026 年届次按 `date_start` 月份计数 | 12 根柱。**档期最密的月份用强调样式** |
| 6 | 无 2026 年届次的品牌 | 有 2026+ 届次 vs 没有，两段；下方列 3 个没有的品牌（按最新一届面积取最大的 3 个） | 双色横条 + 3 行文字 |

- 第 2 块的集团名是库里的 `canonical`，带中英文（如「RX 励展（RX Global）」），**是数据，原样显示**。
- 第 4、6 块的品牌名同理，EN 下有 `name_en` 就用 `name_en`，没有才回退 `name_cn`。
- 「最新一届」照 `/api/expo` 的 `FROM` 常量取（`TASK-H` §3）。
- 第 5 块只统计 `date_start` 以 `2026-` 开头的届次，缺日期的不计。

##### 4.5 三条业务线

小标题「应用」，大标题「三条业务线」。三列，**只用竖向发丝线分隔**，不用卡片、不填底色、不加圆角。
每列：一个淡色序号 01/02/03、标题、两行以内的说明、三个短条目。

标题直接用字典里现成的 `enum.bizLine`（并购标的 / 全新品类 / 项目组支持），**不要再写一份**。
说明与条目照 Prompt E 的文案，但第二列的「停办信号识别」改为「届次断档识别」（与 §2 同一个理由）。

这是全页最短的 section。

##### 4.6 页脚

顶部一条发丝线。左：`BrandLockup` + 两行小字
（「Messe Düsseldorf Shanghai · Business Development」/「© 2026 杜塞尔多夫展览（上海）有限公司 · 内部系统」）。
右：「进入系统 →」+ 一行小字「访问需内部账号」。

**没有别的**：没有开发者署名、社交图标、订阅框、站点地图。

---

#### 5. 要写的文件

| 文件 | 作用 |
|---|---|
| `proxy.ts` | 放行精确路径 `/`（§3） |
| `tests/proxy.test.ts` | 补「无 token 访问 `/` 不跳转」一条 |
| `app/page.tsx` | 已登录跳 `/overview`；未登录取数并渲染落地页 |
| `lib/queries/landing.ts` | 覆盖带 6 个数 + 六块面板的数据。服务端专用 |
| `app/landing/*.tsx` 或 `components/landing/*.tsx` | 各 section 的展示组件，放哪边自己定，但要一处 |
| `components/layout/LocaleSwitch.tsx` | 从登录页抽出的语言切换，登录页改为引用它 |
| `public/landing/product.webp` | 首屏产品截图（§4.2），可由 Claude 质检时补 |
| `locales/*.json` | 新增 `landing` 段 |

##### 数据要缓存

公开页面谁都能刷。`lib/queries/landing.ts` 里十几条聚合查询，每次请求全跑一遍没必要 ——
数据每月才更新两次。用 Next 的 `unstable_cache`（或 `export const revalidate = 3600`）
缓存一小时即可。**注意**：`app/page.tsx` 要读 cookie 判断登录态，页面本身是动态的，
所以缓存要加在**查询函数**上，不是加在页面上。

---

#### 6. ⚠️ 陷阱

##### 6.1 只改 page.tsx 不改中间件

见 §3。验收第一条就是不带 cookie 请求 `/`，必须是 200 而不是 307。

##### 6.2 公开页面不能带出内部数据

本页出现的只能是**公开采集的展会数据的聚合与样例**。以下一律不许出现在本页：
`company` 的任何具体行（公司名、信用代码、法定代表人）、`opportunity` 的任何字段、
`intel_report` 的标题与正文、`resource` 的任何字段、用户信息。
覆盖带里的「企业档案」只给**行数**，不给样例。

##### 6.3 AppShell 与布局

未登录时 `AppShell` 不渲染侧栏（`components/layout/AppShell.tsx` 已处理），本页自己占满整屏。
不要为落地页再加一层判断。

##### 6.4 配色：设计稿的颜色全部作废

Prompt E 是暗色底 + `#FE5C00` 橙色、「每屏最多 3 处橙色」。**之后色板已转浅、界面里的橙色已全部移除**
（`4105ff2`），只有 `BrandLockup` 里还有。本页：

- 只用 `globals.css` 现有的 `--color-*` 令牌；
- 设计稿里所有「橙色高亮」（第 2 块的杜塞尔多夫、第 5 块的密集月份、条目前的小勾、语言切换的选中态）
  一律改用**最深的中性色**（`--color-fg`）来区分，其余用浅一档的中性色；
- 通用门禁三条 grep 必须过。

配色与 logo 由 Max 在第 9 步用 Stitch 整体重做，本任务不抢这个活。

##### 6.5 i18n

- 界面文案全部进 `landing` 段，两份字典同步；
- 数字全部走 `fmtNum` + 插值，**不要把数字写进字典**（`"7,378 个展会品牌"` 这种是错的）；
- 集团名、品牌名、城市名是数据，不进字典；
- EN 下不得出现中文界面文案（`TASK-E` §4.2）；数据里的中文按 §4.4 的规则回退。

##### 6.6 设计稿的硬性禁令照搬

不要：图库照片、3D 渲染、插画人物、emoji、带投影的卡片网格、时间线、路线图、团队介绍、
技术栈、客户证言、logo 墙、价格。每个 section 最多 3 种字号。所有数字用等宽数字（`.num`）。

---

#### 7. 顺手清理

`app/page.tsx` 顶部注释「落地页在 5.8 才做，在那之前未登录一律回登录页」随本任务失效，改掉。
字典里若有旧 `pitch.html` 时代遗留、现在无人引用的键，一并删（`grep` 确认无引用再删）。

---

#### 8. 验收

```bash
npx tsc --noEmit && npm run build          # 零错误零告警
npm test && python3 -m pytest tests/ -q    # proxy.test.ts 多一条且通过

# 1. 未登录能看到落地页（不是跳登录）
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/                                  # 200
# 2. 已登录访问 / 跳盘面
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" -b "session=$T" localhost:3000/  # 307 …/overview
# 3. 放行只放了 / 本身
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/overview                          # 307（跳 /login）
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/company                           # 307

# 4. 数字是实时的：与库里一致
curl -s localhost:3000/ | grep -o '7,378'        # 有
sqlite3 data/mwlab.db "SELECT COUNT(*) FROM exhibition_brand WHERE display_ready=1"   # 7378
sqlite3 data/mwlab.db "SELECT COUNT(DISTINCT canonical) FROM brand_organizer"          # 4990
curl -s localhost:3000/ | grep -o '4,990'        # 有
curl -s localhost:3000/ | grep -c '9,740\|7,401\|十年'   # 0 —— 设计稿里的错数字一个都不许出现

# 5. 没有带出内部数据
curl -s localhost:3000/ | grep -c '上海励泰\|桂芳金\|COSP\|深度调研报告'   # 0

# 6. 字典与英文
python3 -c "
import json,re
f=lambda d,p='':{k2:v2 for k,v in d.items() for k2,v2 in (f(v,f'{p}.{k}' if p else k).items() if isinstance(v,dict) else [(f'{p}.{k}' if p else k,v)])}
z,e=f(json.load(open('locales/zh.json'))),f(json.load(open('locales/en.json')))
print('差集:', (set(z)^set(e)) or '无')
print('en 中文:', re.findall(r'[一-鿿]+', open('locales/en.json',encoding='utf-8').read()) or '无')"
curl -s -b 'mwlab_locale=en' localhost:3000/ | grep -c '停办'   # 0
```

人工检查（1440 宽）：

- 六个 section，顺序与 §4 一致，没有多出来的
- 首屏截图是 `/expo`，不是其他页面
- 「数据 / 能力 / 业务」三个锚点能滚到对应位置
- 语言切换 ZH ↔ EN 生效，没有 DE；登录页的语言切换仍正常（共用组件没改坏）
- 页面上没有橙色（除 logo）；三条配色 grep 干净
- 「进入系统」到 `/login`，登录后回到 `/` 会被带去 `/overview`

**最关键的三条**：未登录 `/` 返回 200 且其他页面仍需登录（§3）；页面上没有任何内部数据（§6.2）；
设计稿里的错数字一个都没出现（§2）。
