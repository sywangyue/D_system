# ECD-2026 · 数据现状说明 + 调整指令

**版本**: v1.1 · 2026.04.27  
**用途**: Phase 3结束后的三项调整说明  

---

## 问题一：全集采集指令

### 现状诊断

当前Jufair数据库有**3.4K条记录**，来自Phase 1 Hermes的机床品类定向采集，**不是全量**。

Jufair站点结构已知：
- 国内展会：约122页
- 国际展会：约300页
- **总计约422页，按每页20条估算约8,400条**
- 当前3.4K条说明已抓取约40%

cnexpo的采集状态未知，需要Hermes先探测页数后再执行。

### 给Hermes的全集采集指令

> **📌 Hermes 全集采集任务（3个，严格串行）**
>
> **任务1**: 执行 Jufair 全量补采
> - 目标：抓取国内(1-122页) + 国际(1-300页)全部展会，列表页+详情页
> - 去重逻辑：以 `(name_cn, date_start)` 为唯一键，已有的记录跳过（INSERT OR IGNORE）
> - 预期新增：约5,000条（3.4K已有，总量约8.4K）
> - 输出：`crawl_log` 中写入本次批次，报告新增数/跳过数/失败数
> - **不删除现有数据**，纯增量写入
>
> **任务2**: 探测并执行 cnexpo 全量采集
> - 先爬取 cnexpo 首页+列表页，输出页数统计报告（有多少页、每页多少条）
> - 确认字段覆盖情况（哪些字段能抓到、哪些为空）
> - 执行全量采集，写入 `raw_cnexpo` 表
> - 输出：采集报告，包含字段覆盖率矩阵
>
> **任务3**: 触发合并引擎
> - 调用 `python merge_engine.py --batch <本次批次ID>`
> - 将新采集数据合并进 `exhibition_brands` + `exhibition_editions`
> - 输出：合并报告，标注双源冲突条目数量

---

## 问题二：数据结构关系图

### 六张表的关系

```
┌─────────────────────────────────────────────────────────────────┐
│                        数据流向                                  │
│                                                                   │
│  [jufair爬虫] ──→ raw_jufair                                     │
│                          │                                        │
│  [cnexpo爬虫] ──→ raw_cnexpo ──→ [merge_engine] ──→ 主库        │
│                          │                                        │
│  [手工Excel]  ───────────┘                                       │
└─────────────────────────────────────────────────────────────────┘
```

### 主库六张表详细关系

```
exhibition_brands (品牌表)
│  brand_id PK
│  name_cn, name_en
│  organizer ← 关键字段，主办方
│  industry_l1, industry_l2 ← 人工打标
│  competition_relation ← 人工打标 [是/否]
│  mds_related ← 人工打标 [无/MFC/Reha China/...]
│  strategic_relevance ← 人工打标 [1-5]
│  ma_potential ← 人工打标 [1-5]
│  competitor_group ← 人工打标
│
├──< exhibition_editions (届次表)
│     edition_id PK
│     brand_id FK ──────────────→ exhibition_brands.brand_id
│     year, date_start, date_end
│     venue, city
│     area_sqm ← 核心数字
│     exhibitors_count ← 核心数字
│     visitors_count ← 核心数字
│     status [已举办/即将举办/取消/延期]
│     yoy_trend [上升/平稳/下降] ← 人工打标
│     anomaly_flag ← 人工打标
│     data_source [jufair/cnexpo/官网/手工]
│
├──< data_provenance (溯源表)
│     record_id PK
│     brand_id FK ────────────→ exhibition_brands.brand_id
│     source_site [jufair/cnexpo/manual]
│     source_url
│     raw_payload JSON ← 原始爬取全字段
│     crawled_at
│     crawl_batch_id FK ──────→ crawl_log.batch_id
│
├──< manual_tag_history (打标历史表)
│     id PK
│     brand_id FK ───────────→ exhibition_brands.brand_id
│     field_name ← 被修改的字段名
│     old_value
│     new_value
│     tagged_by ← 操作人
│     tagged_at
│
crawl_log (爬取日志表)               users (用户表)
│  batch_id PK                      │  user_id PK
│  source_site                      │  email
│  crawl_type [full/increment]      │  role [admin/manager/readonly]
│  records_new                      │  is_active
│  records_skipped                  │  last_login
│  status [success/failed/partial]
│  started_at, finished_at
```

### 哪些字段是系统自动填的，哪些需要人工

```
自动填充（爬虫产出）:
  name_cn / name_en / first_year / city / frequency
  website / date_start / date_end / venue
  area_sqm / exhibitors_count / visitors_count
  organizer（爬取，但需人工核验）

必须人工打标（系统无法推断）:
  competition_relation    → 这个展会是否是竞争对手
  mds_related            → 与MDS哪个品牌相关
  strategic_relevance    → 战略相关度 1-5
  ma_potential           → 并购潜力 1-5
  competitor_group       → 归属哪个竞争集团
  industry_l1 / l2       → 行业分类（爬取数据分类混乱，需人工校准）
  yoy_trend              → 趋势判断
  anomaly_flag           → 本届是否有异常
```

---

## 问题三：手工打标如何实现

### 当前状态判断

Phase 3 已完成 Claude Code 的打标 API（`PATCH /api/brands/{brand_id}`），但**没有前端界面**（Phase 4 尚未启动）。

因此现在有三种方式可以做打标，按推荐顺序排列：

---

### 方式A（推荐）：直接编辑 Excel → 批量导入

**适合场景**: 你对93条机床数据已经有了打标模板，批量处理新数据时效率最高。

**操作步骤**:

```
第1步：导出待打标数据为Excel
  → 在终端执行：
    python tools/export_for_tagging.py --industry_l2 "机床" --status untagged
  → 生成文件：exports/tagging_batch_YYYYMMDD.xlsx
  → 包含列：brand_id / name_cn / organizer / competition_relation(空) / mds_related(空) / strategic_relevance(空)

第2步：在Excel里填写打标列
  → competition_relation 填：是 / 否
  → mds_related 填：无 / MFC / Reha China（或新品牌名）
  → strategic_relevance 填：1 到 5

第3步：导入打标结果
  → 执行：python tools/import_tags.py --file exports/tagging_batch_YYYYMMDD.xlsx --tagger "BD总监"
  → 系统自动写入 exhibition_brands 并记录到 manual_tag_history
```

**这个方式需要 Cursor 补充开发两个工具脚本**（export_for_tagging.py + import_tags.py），工作量约半天。

---

### 方式B（过渡用）：直接调用已有 API

**适合场景**: 单条修改，确认某个具体展会的标签。

```bash
# 修改竞争关系标签
curl -X PATCH http://localhost:8000/api/brands/EXPO-0001 \
  -H "Authorization: Bearer <your_token>" \
  -H "Content-Type: application/json" \
  -d '{"competition_relation": "是", "strategic_relevance": 5}'

# 查看打标历史
curl http://localhost:8000/api/brands/EXPO-0001/tag-history \
  -H "Authorization: Bearer <your_token>"
```

---

### 方式C（不推荐，临时应急）：直接操作 SQLite

**只在API不可用时使用**，会绕过 `manual_tag_history` 记录。

```sql
UPDATE exhibition_brands
SET competition_relation = '是',
    strategic_relevance = 5,
    updated_at = CURRENT_TIMESTAMP
WHERE brand_id = 'EXPO-0001';
```

---

### 打标优先级建议

全集采集完成后，8,000+条记录不可能全部打标。建议按以下顺序处理：

```
第1轮（机床品类，93条金数据已完成）
  → 直接验证：把手工Excel的93条导入系统，确认import_tags能正确跑通

第2轮（目标品类，约200-400条）
  → 筛选条件：industry_l2 IN ('机床', '数控机床', '工业设备')
  → 重点打：competition_relation + strategic_relevance

第3轮（其他品类，按需）
  → 未来进入新品类时再做，不提前
  → 对于 competition_relation = '否' 的记录可以批量默认不打其他标签
```

---

## 给 Cursor 的补充开发任务

基于以上三个调整，Cursor 需要补充两个小工具：

> **📌 Cursor 补充任务（2个）**
>
> **任务1**: 开发 `tools/export_for_tagging.py`
> - 参数: `--industry_l2` (必填) / `--status untagged/all` / `--output path`
> - 输出: Excel文件，包含 brand_id + 基础信息列 + 空白打标列
> - 打标列设置下拉验证（openpyxl的DataValidation）
>
> **任务2**: 开发 `tools/import_tags.py`
> - 参数: `--file` / `--tagger`
> - 逻辑: 读取Excel打标列 → 写入 exhibition_brands → 写入 manual_tag_history
> - 输出: 导入报告（成功N条/跳过N条/格式错误N条）

---

*ECD-2026 · 调整说明 v1.1 · 2026.04.27*
