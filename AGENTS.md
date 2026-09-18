# MWLAB 万象 · 数据层与采集管道

## 项目定位

杜塞尔多夫展览上海的 BD 工作台。中心实体是**公司**，展会数据降级为被引用的底图 ——
公司库 / 机会台 / 调研库 / 知识库是产品主体，展会只回答「这家公司在哪些展上出现过」。

V1 时代那个「输入品类 → 输出竞争对手 / 潜在伙伴 / 新进入者三维视图」的展会看板已整体下架，
读到旧文档里的「竞争盘面」措辞时按此换算。

**本文件的范围**：数据层（六表关系、字段来源、双源冲突规则）与采集管道。
产品与 Web 架构在 `docs/ARCHITECTURE.md`，不在这里。

---

## 项目状态（2026-09-18）

V2 重构（V2-00 → V2-16）全部完成并部署，V2-17 项目清理三步完成。
下一步是 V2-18 UI 整体重做。完整时间线与统一编码见 `docs/HISTORY.md`，
待办见 `docs/ROADMAP.md`，数据基线见 `docs/QC.md`。

**定时调度（2026-07-30 落地）**：`scripts/run_pipeline.sh` + crontab，每月 7/27 号 03:00 跑
采集 → 合并 → 分类 → 届次状态 → 展示池 → 导出去重复核表。详见下文「定时任务」。

> PRD / ARCHITECTURE / DEPLOY 里标注「✅ 完成」的 `scheduler.py` **始终不存在于仓库**，
> 那个「每周一 02:00 自动增量爬取」从未实现过。现在的实现是 shell + crontab，不是 Python 调度器，
> 读到旧文档提及 `scheduler.py` 时不要去找这个文件。

---

## 数据架构（六表关系）

```
exhibition_brand (品牌表) — 主键稳定，变化慢
  │ brand_id PK, name_cn, name_en, organizer
  │ industry_l1/l2, competition_relation, mds_related, strategic_relevance
  │
  ├── exhibition_edition (届次表) — 时序数据，每年新增
  │     edition_id PK, brand_id FK
  │     year, date_start, date_end, venue, city
  │     area_sqm, exhibitors_count, visitors_count  ← 核心数字
  │     data_source [jufair/cnexpo/官网/手工]
  │
  ├── data_provenance (溯源表)
  │     source_site, source_url, raw_payload (JSON), crawl_batch_id
  │
  └── manual_tag_history (打标历史)
        field_name, old_value, new_value, tagged_by

crawl_log (爬取日志)           user (用户表，固定 3 行)
  batch_id, source_site          user_id, email, role, is_active
  total_fetched/inserted/skipped
```

### 字段来源分类

**自动填充（爬虫）**: name_cn/en, city, frequency, date_start/end, venue, area_sqm, exhibitors_count, visitors_count, organizer（需人工核验）

**脚本派生（不要手填，会被下次重跑覆盖）**:
- `industry_l1/l2` ← `scripts/classify_all_brands.py`（jufair 分类映射表 + 品牌名关键词；pipeline 里用 `--only-empty` 跑，不覆盖已收敛值）
- `display_ready` ← `scripts/check_display_ready.py`（每周一 cron + 每月 pipeline）
- `status` ← `scripts/refresh_edition_status.py`（按 date_end 派生，已接入月度 pipeline）
- `anomaly_flag` ← 目前为一次性标记，无周期任务

**人工修正会被覆盖的字段** —— `city` / `city_en` / `country_cn` / `country_en`：
`geo_backfill.py` 无条件 UPDATE 这四个字段（无 `WHERE ... = ''` 保护），
且脚本末尾还有一句无条件的 `UPDATE exhibition_brand SET notes = ''` 清空全表备注。
它不可重入，V2-17 已连同其余一次性治理脚本移出仓库，存放在本地
`_archive/onetime/`（不入库）。**不要把它捞回来跑** —— 手工修过地理字段后再跑一次，
修正会被推断值覆盖，全表备注会被清空。

**必须人工打标（系统无法推断）**: competition_relation, mds_related, strategic_relevance (1-5), ma_potential (1-5), competitor_group, scale_score, yoy_trend

**定义了但从未被填充**（schema 里有、代码里被引用、库里全空）:

| 字段 | 非空行数（2026-09-18 实测） | 说明 |
|---|--:|---|
| `first_year` | 0 / 7,401 | 无任何写入方。`dedup.py` / `export_for_tagging.py` / `import_tags.py` 都在读它，所以**保留此列**，但别指望它有值 |
| `website` | 2 / 7,401 | 同上，爬虫与 merge_engine 均不写 |
| `yoy_trend` | 0 / 7,703 | 需人工打标 |
| `competition_relation` | 0 / 7,401 | 需人工打标，工具链可用但还没投入人工 |
| `strategic_relevance` | 0 / 7,401 | 同上 |
| `ma_potential` | 0 / 7,401 | 同上 |

### 双源冲突规则

| 字段类别 | 优先级 |
|---------|--------|
| 名称/时间/地点 | jufair 为准 |
| 展商数/观众数/面积 | 取较大值，记录差异 |
| 主办方 | 两源都保留，差异人工兜底 |
| 缺失字段 | 谁有取谁 |

---

## 文件索引

V2-17 把一次性治理脚本移到了本地 `_archive/onetime/`（不入库）。
**仓库里现存的 Python 脚本都有明确的再次运行场景**，下表是全集。

| 文件 | 说明 |
|------|------|
| **采集** | |
| crawlers/jufair_crawler.py | Jufair 爬虫（Python，curl 抓取，支持 `--proxy` / `--refresh`） |
| crawlers/jf_shell_crawl.sh | Jufair 爬虫（纯 shell + curl，慢速安全模式） |
| crawlers/cnexpo_crawler.py | cnexpo 爬虫 |
| crawlers/expofinder_crawler.py | 展查查采集（V1-11，方案未落地，代码可跑；配 `tools/expofinder_extract.py` + `tools/rsc_flight.py`） |
| **管道与治理** | |
| scripts/run_pipeline.sh | **月度 pipeline**（cron 每月 7/27 号 03:00 调用） |
| tools/merge_engine.py | 双源合并引擎（务必传具体 `batch_id`） |
| scripts/classify_all_brands.py | 全品牌行业分类（l1 + l2） |
| scripts/refresh_edition_status.py | 届次 status 按 `date_end` 派生 |
| scripts/check_display_ready.py | 展示池标记（每周一 cron + 每月 pipeline） |
| scripts/dedup.py | 品牌去重（默认 dry-run，`--execute` 不进 pipeline，人工过完复核表再跑） |
| tools/export_dedup_review.py | 去重人工复核表导出（CSV，只读） |
| scripts/clean_brands.py | 品牌表清洗（name-en / industry / jufair-l2，规则在 `scripts/data/`） |
| **公司与调研侧** | |
| scripts/index_resources.py | 把 reports/ exports/ research/ 下的文件登记进 `resource` 表（线上资源下载读它） |
| scripts/backfill_reports.py | docx 正文抽取回填 `intel_report`，可反复重跑 |
| scripts/import_qcc_raw.py | 企查查原始 json → `company` 表 |
| tools/intel/ | 企查查客户端、调研报告生成、线索导入导出（Claude skills 调用） |
| tools/build_organizer_index.py · rank_organizers.py | 主办方规范化索引与排序（全量重建） |
| **导出与打标** | |
| tools/export_exhibitions.py | 展会清单导出（月度/区间，统一口径） |
| tools/export_for_tagging.py | V1-04 · Excel 导出待打标行 |
| tools/import_tags.py | V1-04 · Excel 写回 + `manual_tag_history` |
| **其他** | |
| scripts/seed_users.py | 播种 3 个开发账号（幂等） |
| tools/build_logo_svg.py | 生成品牌 logo SVG（字体轮廓烘出，不依赖 webfont） |
| schema/init_db.sql | 主 Schema |
| schema/migrations/ | 迁移脚本 001–017，由 `schema/db.py:init_db()` 自动应用（当前 schema_version = 17） |
| data/mwlab.db | 主数据库 |
| data/jufair_2026.db · data/cnexpo_2026.db | 两个原始库 |
| docs/archive/V1-prd-audits.md | V1 时代原文：整合 PRD + 脚本质检审计报告 + 整改记录（只读） |

---

## 核心技术约束

- **Jufair 仅限大陆 IP** — 爬虫必须在北京 Mac Mini 节点执行
- **爬虫与 API 进程分离** — 不同容器/不同进程运行
- **依赖栈**（以 `requirements.txt` 为准）: Python 3.12+、requests、beautifulsoup4、openpyxl（打标与导出）、
  python-docx（调研报告）、bcrypt（账号播种）、pytest。**没有 FastAPI / SQLAlchemy / pandas** ——
  V1-05 移除 FastAPI 后端后，Web 层就只有 Next.js 一个进程，Python 侧只剩脚本
- **数据库**: SQLite，开发与生产同一套（生产库随部署上传，见 `docs/DEPLOY.md`）

---

## 数据现状（2026-09-18 补跑 pipeline 后实测）

| 库 | 表 | 行数 |
|----|----|------|
| `data/mwlab.db`（22 MB） | exhibition_brand | 7,475 |
| | 其中 display_ready=1 | 7,452（99.7%，23 条待补全） |
| | exhibition_edition | 7,778 |
| | data_provenance | 9,906 |
| | brand_organizer | 9,740 |
| | brand_geo_tag | 8,145 |
| | manual_tag_history | 12,302 |
| `data/jufair_2026.db` | raw_jufair | 7,077 |
| `data/cnexpo_2026.db` | raw_cnexpo | 2,286 |

> `brand_organizer` 不随 pipeline 增长 —— `build_organizer_index.py` 不在管道里，
> 这次新增的 74 个品牌的主办方还没进索引。要用主办方口径分析前先手动全量重建一次。

公司侧的表（company / opportunity / intel_report / resource）是产品主体，
数量与验收口径见 `docs/QC.md` §2 数据基线 —— **质检时以 QC.md 为准，别拿这张表对数**，
这里只覆盖展会数据层。

**行业分类已全部收敛**：8 个 l1 类别，`industry_l1` 为空 0 条（07-30 时还有 33 条待兜底）。
当前分布：机械和设备 2,569 · 生活方式 1,721 · 休闲 866 · 化工与能源 685 ·
科技+ 678 · 医疗和健康 442 · 零售贸易和服务 285 · 农业与畜牧 229。
新品牌靠 jufair 分类映射表落位，关键词兜底这次命中 0 条 —— 映射表够用，别退回子串匹配。

> 2026-07-29 整改（`docs/archive/V1-prd-audits.md`）：
> jufair 分类改用 217 条显式映射表（改判 1,291 品牌）；合并 29 组重复届次；
> 清 38 条溯源孤儿并给裸连接补外键；迁移 011/012（data_source CHECK、
> manual_tag_history.change_source、删两个全空列）；备份表移出主库（28→18 MB）。
> `status` 按 `date_end` 派生，`refresh_edition_status.py` 已接进月度 pipeline。

---

## 采集进度与全集采集（V1-12，未执行）

Jufair 原始库 7,077 条，继续补齐国内 + 国际全量就是 V1-12，在 `docs/ROADMAP.md` 里挂着，
**不是当前焦点** —— 当前焦点是 V2-18 UI 重做。

采集的治理链已固化进 `scripts/run_pipeline.sh`，手动执行等价于：
```bash
BATCH="manual-$(date +%Y%m%d)"
python3 crawlers/jufair_crawler.py --all --detail --refresh --batch-id "$BATCH"
python3 tools/merge_engine.py --batch "$BATCH"   # 别传 ALL，见下
python3 scripts/classify_all_brands.py --only-empty
python3 scripts/refresh_edition_status.py
python3 scripts/check_display_ready.py
python3 tools/export_dedup_review.py             # 出复核表，人工过完再合并
```

原始方案见 `docs/archive/V1-prd-audits.md`（原 PRD §7 Phase 1b）。

---

## 定时任务

```
0 2 * * 1     scripts/check_display_ready.py        # 每周一，展示池
0 3 7,27 * *  scripts/run_pipeline.sh               # 每月 7/27 号，全流程
```

> crontab 里另有 4 条属于 **ciosh 项目**（`CIOSH-RADAR-BEGIN/END` 标记之间），与本项目无关，勿动。
> 本项目的段落用 `MWLAB-PIPELINE-BEGIN/END` 标记。

`run_pipeline.sh` 内置改库前备份（保留最近 10 份）、`mkdir` 原子锁防重叠运行
（macOS 无 `flock`）、失败摘要落 `logs/pipeline_failures.log`。
cron 的 PATH 不含 Framework 路径，脚本内 Python 一律用绝对路径。

> **cron 不补跑**：机器在 03:00 休眠或关机，那一次就整月跳过，没有任何报错。
> 2026-09-07 那次就是这么漏的 —— `logs/` 里没有 `pipeline_auto-20260907.log`，
> `crawl_log` 最后一条停在 `auto-20260827`。**判断管道是否正常，看日志文件有没有出现，
> 不要看有没有报错**。漏了就手动补跑 `bash scripts/run_pipeline.sh`。

### 几个容易踩的点

- **`merge_engine.py --batch ALL` 是 O(N²)**：`match_brand()` 对每条记录全表 SequenceMatcher，
  按当前规模 9,318 × 7,401 ≈ 6,900 万次比对。日常增量务必传具体 `batch_id`。
- **爬虫默认只增不更**：`crawl_month()` 里已存在的 `source_url` 在进 SQL 前就被过滤掉，
  源站改档期同步不进来。**必须带 `--refresh`** 才会走 UPSERT（非空新值覆盖旧值，
  `detail_crawled` 取 MAX 以免列表页把详情页已爬标记冲掉）。
- **`dedup.py --execute` 不进 pipeline**：品牌合并不可逆，只产出复核 CSV 由人工过。
- **名称相似度已到天花板**：真重复（世界机器人大会三条）相似度 0.71–0.74，
  而不同展会（EXPO-3122 北京机器人展）是 0.70，仅差 0.03 —— 降门限必然误伤。
  判别要靠 `venue` + `name_en` + 档期，不能靠名字。
