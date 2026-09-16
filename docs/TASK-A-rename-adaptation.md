# 任务 A · customer_prospect → company 改名适配

**交给**：hermes + DeepSeek（纯机械查找替换，有测试当验收标准）
**前置**：迁移 014 + 015 已应用于 `data/mwlab.db`（`schema_version = 15`）
**验收**：`python3 -m pytest tests/ -q` 的失败数从 **8** 降到 **1**
（任务 B/C 已完成，把基线从 9 降到了 8）
（剩下那 1 条 `test_jufair_insert_batch_dedup_count` 是先前就存在的签名漂移，**不属于本任务，不要动它**）

---

## 1. 改名对照表

| 类别 | 旧 | 新 |
|---|---|---|
| 表名 | `customer_prospect` | `company` |
| 列名 | `id` | `company_id` |
| 列名 | `company_name` | `name` |

**新增列（本任务不需要写入，知道存在即可）**：`name_en` `type` `city` `country`
**`intel_report_id` 保持不变** —— 014 曾误删，015 已恢复，仍在 `company` 表上。

---

## 2. 要改的文件（共 7 个）

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

## 3. ⚠️ 三个不能碰的地方（改了就是 bug）

### 3.1 `tools/intel/db_query.py` 整个文件不要动

它第 208 行有 `def company_history(company_name: str)` —— 这个 `company_name` 是
**Python 函数参数名**，不是数据库列名，全文件 4 处都是。该文件不访问 `customer_prospect` 表。

### 3.2 `schema/migrations/*.sql` 全部不要动

历史迁移是已发生事实的记录，改了会让迁移链对不上。
`006_intel_tables.sql` 里的 `CREATE TABLE customer_prospect` 必须原样保留 ——
全新库会先建 `customer_prospect`，再由 014 改名成 `company`。

### 3.3 `scripts/verify_migration_014.py` 不要动

它要对照**迁移前**的备份库，里面出现 `customer_prospect` 是故意的。

---

## 4. `schema/db.py` 的特别处理

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

## 5. 逐文件要点

### `insert_prospects.py`
- `_FIELDS` 字典里 `"company_name": "company_name"` → `"company_name": "name"`
  （左边是外部输入的 JSON 键，**保持 `company_name` 不变**；右边是数据库列名，改成 `name`）
- 查重 SQL：`SELECT 1 FROM customer_prospect WHERE brand_id IS ? AND company_name = ?`
  → `FROM company WHERE brand_id IS ? AND name = ?`
- Python 局部变量 `company_name = p.get("company_name")` 可以保留原名，只改 SQL 里的列名
- 报错文案里的「customer_prospect 表」改成「company 表」

### `import_qcc_batch.py`
- `_COL_MAP` 里的 `"company_name": 1` 是 **Excel 列索引映射，键名不要改**
- 三处 SQL 全改：`SELECT id, ... FROM customer_prospect WHERE credit_code = ?`
  → `SELECT company_id, ... FROM company WHERE credit_code = ?`
- `UPDATE customer_prospect SET company_name = ?` → `UPDATE company SET name = ?`
- `INSERT INTO customer_prospect (source_type, company_name, ...)`
  → `INSERT INTO company (source_type, name, ...)`
- 注意：取回的 `id` 变成 `company_id`，下游用到这个值的地方要跟着改

### `export_prospects.py`
- `_COLUMNS` 列表：`"id"` → `"company_id"`，`"company_name"` → `"name"`
- 中文表头映射 `_HEADERS` 的**键**跟着改，**值（中文）不改**：
  `"company_name": "公司名称"` → `"name": "公司名称"`
- 三条 SQL 的 `FROM customer_prospect ... ORDER BY id` → `FROM company ... ORDER BY company_id`
- `--report-id` 过滤仍然有效（`intel_report_id` 列还在）
- 列宽配置 `"company_name": 30` 的键跟着改

### `tests/test_intel_tools.py`
- 所有 `INSERT INTO customer_prospect (company_name, ...)` → `INTO company (name, ...)`
- 所有 `SELECT ... FROM customer_prospect` → `FROM company`
- 测试数据字典里的 `{'company_name': '幂等公司甲', ...}` 是**喂给工具的输入**，
  键名保持 `company_name` 不变（对应 `insert_prospects._FIELDS` 的左边）
- 类的 docstring「intel_report / customer_prospect 的 CHECK 约束」改成 `company`

### `tests/test_schema.py`
- 第 247 行 `self.assertIn('customer_prospect', tables)` → `assertIn('company', tables)`
- 同文件里关于 `exhibition_timeline` / `person` 等表的断言**已由任务 B 改好**，不要再动

---

## 6. 验收

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
