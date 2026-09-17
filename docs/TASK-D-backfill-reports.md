# 任务 D · 历史 docx 回填 intel_report

**前置**：无。先跑这个，C 的调研库页面才有真内容可展示。
**产出**：`scripts/backfill_reports.py`（可反复重跑）+ 一次实际回填
**验收**：见 §5

---

## 1. 现状

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

## 2. 两类文件

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

## 3. 要写的脚本

`scripts/backfill_reports.py`，接口与 `scripts/index_resources.py` 保持一致
（**先读那个文件**，命名、参数、dry-run 行为都照它）：

```bash
python3 scripts/backfill_reports.py            # dry-run，只打印
python3 scripts/backfill_reports.py --execute  # 实际写库
```

### 转换规则

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

### docx → Markdown

- 段落：直接作为一行，空段跳过
- 标题样式（`p.style.name` 以 `Heading` 开头）：按级别加 `#`
- 表格：转标准 Markdown 表格，第一行当表头
- **不要引入 pandoc 或其他外部二进制**，只用 `python-docx`

### 回写 resource

入库后把 `resource.report_id` 指到新建的 `intel_report.id`：

```sql
UPDATE resource SET report_id = ? WHERE file_path = ?
```

这样调研库详情页才能列出「这份报告对应的原始文件」。

---

## 4. ⚠️ 四个陷阱

### 4.1 幂等

以 `report_file` 为准判重。已存在同路径的记录就 **UPDATE 正文**，不要再插一条。
脚本要能反复跑，将来新增 docx 时直接重跑。

### 4.2 `intel_report` 五个列是 NOT NULL

```
report_type  params_json  report_md  report_file  status  created_by
```

缺一个 INSERT 就失败。没有值的写空字符串或 `'{}'`，不要写 NULL。

### 4.3 同一公司有多版本

`杭州川方至医疗器械有限公司` 有 5 份 docx（同一天跑了多轮）。
**每份都单独入库**，不要只取最新 —— 它们是不同时间点的快照，
`resource` 表里也是分别登记的。靠 `created_at` 排序区分。

### 4.4 不要动 `resource` 表的其他列

只 UPDATE `report_id`。`company_id`、`sha256`、`collected_at` 都是
`index_resources.py` 维护的，改了下次重跑会冲突。

---

## 5. 验收

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
