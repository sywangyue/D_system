# MWLAB-2026 · Exhibition Competitive Dashboard

## 项目定位

面向中国总经理的展会竞争盘面看板。输入一个目标品类，输出该品类的竞争对手 / 潜在伙伴 / 新进入者三维分析视图。

**核心目标**: 三步点选内给出可信的竞争盘面（品牌/展商/观众/面积）。

---

## 项目状态（2026-07-28）

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 数据采集器（Jufair + cnexpo 爬虫） | ✅ 已完成 |
| Phase 2 | Schema + 合并引擎 + 打标工具 | ✅ 已完成 |
| Phase 3 | Dashboard 查询 API + JWT 认证 | ✅ 已完成 |
| Phase 3b | 打标批量工具（Excel 导出/导入） | ✅ 已完成 |
| Phase 4 | 前端 UI（看板、日历、地图、设置） | ✅ 已完成 |
| Phase 5 | Intel 后端（调研报告、DB 查询、企查查接入） | ✅ 已完成 |
| Phase 6 | 代码审计与合规清理 | ✅ 已完成 |
| 质检整改 | 脚本质检 + 数据治理（见 `docs/AUDIT-2026-07-27.md`） | ✅ 已完成 |
| **Phase 1b** | **全集采集（Jufair 全量 + cnexpo 全量）** | **⏳ 当前任务** |

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

crawl_log (爬取日志)           users (用户表)
  batch_id, source_site          user_id, email, role, is_active
  records_new/skipped/failed
```

### 字段来源分类

**自动填充（爬虫）**: name_cn/en, city, frequency, date_start/end, venue, area_sqm, exhibitors_count, visitors_count, organizer（需人工核验）

**脚本派生（不要手填，会被下次重跑覆盖）**:
- `industry_l1/l2` ← `scripts/classify_all_brands.py`（jufair 分类映射表 + 品牌名关键词；pipeline 里用 `--only-empty` 跑，不覆盖已收敛值）
- `display_ready` ← `scripts/check_display_ready.py`（每周一 cron + 每月 pipeline）
- `status` ← `scripts/refresh_edition_status.py`（按 date_end 派生，已接入月度 pipeline）
- `anomaly_flag` ← 目前为一次性标记，无周期任务

**人工修正会被覆盖的字段** —— `city` / `city_en` / `country_cn` / `country_en`：
`scripts/geo_backfill.py` 无条件 UPDATE 这四个字段（无 `WHERE ... = ''` 保护），
且脚本末尾还有一句无条件的 `UPDATE exhibition_brand SET notes = ''` 清空全表备注。
它是一次性治理脚本，**不可重入、已被排除在 pipeline 之外**。手工修过地理字段后若再跑它，修正会被推断值覆盖。

**必须人工打标（系统无法推断）**: competition_relation, mds_related, strategic_relevance (1-5), ma_potential (1-5), competitor_group, scale_score, yoy_trend

**定义了但从未被填充**（2026-07-29 实测，schema 里有、代码里被引用、库里全空）:

| 字段 | 非空行数 | 说明 |
|---|--:|---|
| `first_year` | 0 / 7,179 | 无任何写入方。`dedup.py:410` / `export_for_tagging.py:41` / `import_tags.py:38` 都在读它，所以**保留此列**，但别指望它有值 |
| `website` | 2 / 7,179 | 同上，爬虫与 merge_engine 均不写 |
| `yoy_trend` | 0 / 7,476 | 需人工打标 |

### 双源冲突规则

| 字段类别 | 优先级 |
|---------|--------|
| 名称/时间/地点 | jufair 为准 |
| 展商数/观众数/面积 | 取较大值，记录差异 |
| 主办方 | 两源都保留，差异人工兜底 |
| 缺失字段 | 谁有取谁 |

---

## 文件索引

| 文件 | 说明 |
|------|------|
| docs/MWLAB-2026-PRD-v1.1-merged.md | **整合 PRD（当前唯一权威文档）** |
| docs/AUDIT-2026-07-27.md | 脚本质检审计报告 + 整改记录 |
| crawlers/jufair_crawler.py | Jufair 爬虫（Python，curl 抓取，支持 `--proxy` / `--refresh`） |
| scripts/run_pipeline.sh | **月度 pipeline**（cron 每月 7/27 号 03:00 调用） |
| tools/export_dedup_review.py | 去重人工复核表导出（CSV，只读） |
| crawlers/jf_shell_crawl.sh | Jufair 爬虫（纯 shell + curl，慢速安全模式） |
| crawlers/cnexpo_crawler.py | cnexpo 爬虫 |
| tools/merge_engine.py | 双源合并引擎 |
| tools/export_for_tagging.py | Phase 3b · Excel 导出待打标行 |
| tools/import_tags.py | Phase 3b · Excel 写回 + `manual_tag_history` |
| tools/export_exhibitions.py | 展会清单导出（月度/区间，统一口径） |
| scripts/classify_all_brands.py | 全品牌行业分类（l1 + l2） |
| scripts/dedup.py | 品牌去重（默认 dry-run，`--execute` 实际合并） |
| scripts/check_display_ready.py | 展示池标记（每周 cron） |
| schema/init_db.sql | 主 Schema |
| schema/migrations/ | 迁移脚本 001–010，由 `schema/db.py:init_db()` 自动应用 |
| data/mwlab.db | 主数据库 |
| data/jufair_2026.db · data/cnexpo_2026.db | 两个原始库 |

---

## 核心技术约束

- **Jufair 仅限大陆 IP** — 爬虫必须在北京 Mac Mini 节点执行
- **爬虫与 API 进程分离** — 不同容器/不同进程运行
- **依赖栈**: Python 3.12+, FastAPI, SQLAlchemy, pandas, requests, BeautifulSoup；Phase 3b 打标工具另需 **openpyxl**
- **数据库**: SQLite 开发 + 可选云上迁移

---

## 数据现状（2026-07-30，首轮 pipeline 后）

| 库 | 表 | 行数 |
|----|----|------|
| `data/mwlab.db` | exhibition_brand | 7,292 |
| | exhibition_edition | 7,592 |
| | data_provenance | 9,683 |
| | 其中 display_ready=1 | 7,276（99.8%） |
| `data/jufair_2026.db` | raw_jufair | 6,945 |
| `data/cnexpo_2026.db` | raw_cnexpo | 2,286 |

> 2026-07-29 整改（`docs/REMEDIATION-DRAFT-2026-07-29.md`）：
> jufair 分类改用 217 条显式映射表（改判 1,291 品牌）；合并 29 组重复届次；
> 清 38 条溯源孤儿并给裸连接补外键；迁移 011/012（data_source CHECK、
> manual_tag_history.change_source、删两个全空列）；备份表移出主库（28→18 MB）。
> `status` 现按日期派生，需与 `check_display_ready.py` 同频每周重跑
> （`scripts/refresh_edition_status.py`，**尚未接 cron**）。

行业分类已收敛至 8 个 l1 类别，33 条无关键词可匹配待人工兜底。
`competition_relation` / `strategic_relevance` / `ma_potential` 三个人工打标字段仍为 0 条 ——
此前是打标工具链因缺列而崩溃所致，现已修复可用。

---

## 当前焦点：Phase 1b 全集采集

Jufair 原始库当前 5,362 条，继续补齐国内 + 国际全量。

采集完成后的治理链已固化进 `scripts/run_pipeline.sh`，手动执行等价于：
```bash
BATCH="manual-$(date +%Y%m%d)"
python3 crawlers/jufair_crawler.py --all --detail --refresh --batch-id "$BATCH"
python3 tools/merge_engine.py --batch "$BATCH"   # 别传 ALL，见下
python3 scripts/classify_all_brands.py --only-empty
python3 scripts/refresh_edition_status.py
python3 scripts/check_display_ready.py
python3 tools/export_dedup_review.py             # 出复核表，人工过完再合并
```

详见 PRD §7 Phase 1b。

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

### 几个容易踩的点

- **`merge_engine.py --batch ALL` 是 O(N²)**：`match_brand()` 对每条记录全表 SequenceMatcher，
  9,129 × 7,179 ≈ 6,550 万次比对。日常增量务必传具体 `batch_id`。
- **爬虫默认只增不更**：`crawl_month()` 里已存在的 `source_url` 在进 SQL 前就被过滤掉，
  源站改档期同步不进来。**必须带 `--refresh`** 才会走 UPSERT（非空新值覆盖旧值，
  `detail_crawled` 取 MAX 以免列表页把详情页已爬标记冲掉）。
- **`dedup.py --execute` 不进 pipeline**：品牌合并不可逆，只产出复核 CSV 由人工过。
- **名称相似度已到天花板**：真重复（世界机器人大会三条）相似度 0.71–0.74，
  而不同展会（EXPO-3122 北京机器人展）是 0.70，仅差 0.03 —— 降门限必然误伤。
  判别要靠 `venue` + `name_en` + 档期，不能靠名字。
