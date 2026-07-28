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

**已知缺口**：`scheduler.py`（定时调度器）在 PRD / ARCHITECTURE / DEPLOY 中均标注「✅ 完成」，
但该文件不存在于仓库 —— 所谓「每周一 02:00 自动增量爬取」从未实现。爬虫目前只能手动触发。

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

**自动填充（爬虫）**: name_cn/en, first_year, city, frequency, website, date_start/end, venue, area_sqm, exhibitors_count, visitors_count, organizer（需人工核验）

**必须人工打标（系统无法推断）**: competition_relation, mds_related, strategic_relevance (1-5), ma_potential (1-5), competitor_group, industry_l1/l2, yoy_trend, anomaly_flag

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
| crawlers/jufair_crawler.py | Jufair 爬虫（Python，curl 抓取，支持 `--proxy`） |
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

## 数据现状（2026-07-28）

| 库 | 表 | 行数 |
|----|----|------|
| `data/mwlab.db`（22 MB） | exhibition_brand | 6,946 |
| | exhibition_edition | 7,264 |
| | data_provenance | 7,927 |
| | 其中 display_ready=1 | 5,954（85.7%） |
| `data/jufair_2026.db` | raw_jufair | 5,362 |
| `data/cnexpo_2026.db` | raw_cnexpo | 4,571 |

行业分类已收敛至 8 个 l1 类别，33 条无关键词可匹配待人工兜底。
`competition_relation` / `strategic_relevance` / `ma_potential` 三个人工打标字段仍为 0 条 ——
此前是打标工具链因缺列而崩溃所致，现已修复可用。

---

## 当前焦点：Phase 1b 全集采集

Jufair 原始库当前 5,362 条，继续补齐国内 + 国际全量。

采集完成后必须依次跑：
```bash
python3 tools/merge_engine.py --batch ALL      # 合并进主库
python3 scripts/classify_all_brands.py          # 新品牌补分类（否则 industry_l1 为空）
python3 scripts/dedup.py                        # 先 dry-run 看重复
python3 scripts/check_display_ready.py          # 重算展示池
```

详见 PRD §7 Phase 1b。
