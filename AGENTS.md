# MWLAB-2026 · Exhibition Competitive Dashboard

## 项目定位

面向中国总经理的展会竞争盘面看板。输入一个目标品类，输出该品类的竞争对手 / 潜在伙伴 / 新进入者三维分析视图。

**核心目标**: 三步点选内给出可信的竞争盘面（品牌/展商/观众/面积）。

---

## 项目状态（2026-05-06）

| Phase | 内容 | 状态 |
|-------|------|------|
| Phase 1 | 数据采集器（Jufair + cnexpo 爬虫 + 调度器） | ✅ 已完成 |
| Phase 2 | Schema + 合并引擎 + 打标工具（6 表 + merge_engine + export_for_tagging/import_tags） | ✅ 已完成 |
| Phase 3 | Dashboard 查询 API + JWT 认证 + Docker + OpenAPI + 部署表 | ✅ 已完成 |
| **Phase 1b** | **全集采集（Jufair 8.4K + cnexpo 全量）** | **⏳ 当前任务** |
| **Phase 3b** | **打标批量工具（Excel 导出/导入）** | **✅ 已完成** |
| Phase 4 | 前端 UI | ⏸ 暂缓 |

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
| MWLAB-2026-PRD-v1.1-merged.md | **整合 PRD（当前唯一权威文档）** |
| crawlers/jufair_crawler.py | Jufair 爬虫 |
| crawlers/cnexpo_crawler.py | cnexpo 爬虫 |
| merge_engine.py | 双源合并引擎 |
| tools/export_for_tagging.py / import_tags.py | Phase 3b 打标批量工具（Excel 导入导出） |
| tools/export_for_tagging.py | Phase 3b · Excel 导出待打标行 |
| tools/import_tags.py | Phase 3b · Excel 写回 + `manual_tag_history` |
| scheduler.py | 定时调度器 |
| schema/init_db.sql | 6 表 Schema |
| mwlab.db | 主数据库 |

---

## 核心技术约束

- **Jufair 仅限大陆 IP** — 爬虫必须在北京 Mac Mini 节点执行
- **爬虫与 API 进程分离** — 不同容器/不同进程运行
- **依赖栈**: Python 3.12+, FastAPI, SQLAlchemy, pandas, requests, BeautifulSoup；Phase 3b 打标工具另需 **openpyxl**
- **数据库**: SQLite 开发 + 可选云上迁移

---

## 当前焦点：Phase 1b 全集采集

Jufair 当前 3.4K 条（约 40%），目标 8.4K 条（国内 122 页 + 国际 300 页）。

执行方式：Ralph 自治循环（Claude Code）或 Hermes 委托任务。

详见 PRD §7 Phase 1b。
