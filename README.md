<!-- 内容聚合自：MWLAB-2026-PRD-v1.1-merged.md、.planning/PROJECT.md、.planning/ROADMAP.md、AGENTS.md -->

![MWLAB-2026 · BD Database · Exhibition Competitive Dashboard · 80s terminal pixel style](docs/readme-hero-mds.png)

# MWLAB-2026 · Exhibition Competitive Dashboard

**代号**：MWLAB-2026  
**客户语境**：杜塞尔多夫展览上海（BD 总监）  
**英文一句话**：Structured exhibition database and competitive landscape dashboard: pick a category, see competitors, partners, and new entrants with scale signals (brands / exhibitors / visitors / area).

---

## 项目定位（PRD）

- **定义**：基于结构化展会数据库的竞争盘面看板；输入目标品类，输出 **竞争对手 / 潜在伙伴 / 新进入者** 三维视图。  
- **服务对象**：中国总经理（决策者优先，非技术用户）。  
- **核心场景**：评估是否进入某个新展会市场。  
- **原则内不做**：上游产业链指数、下游 AI 建议、Gecko 集成、以自由文字录入为主交互。

**价值主张（PROJECT）**：在「是否进入某个展会市场」问题上，尽量在 **三步点选** 内给出可信的竞争结构与规模信号，且无文字录入负担。

---

## 路线图与状态（ROADMAP + AGENTS）

| Phase | 内容 | 状态 |
|-------|------|------|
| 1 | 数据采集（Jufair + cnexpo 爬虫 + 调度器） | ✅ |
| 2 | Schema、合并引擎、`tag_api`、金标准对拍 | ✅ |
| 3 | Dashboard 查询 API、JWT、Docker、OpenAPI、部署对比 | ✅ |
| 3b | Excel 批量打标（`tools/export_for_tagging.py`、`import_tags.py`） | ✅ |
| **1b** | **全集采集（Jufair ~8.4K + cnexpo 全量 + 全量合并）** | **⏳ 当前主线** |
| 4 | 前端 UI（HOLD，可与 1b 并行规划） | ⏸ |

**当前工程重点（PROJECT）**

1. **Phase 1b**：Jufair 从约 3.4K 扩至约 8.4K；cnexpo 全量探测与采集；`merge_engine` 全量跑通。  
2. **Phase 4**：前端 UI（暂缓；打标工具链已就绪）。

---

## 数据架构摘要（PRD + AGENTS）

**流向（概念）**：Jufair / cnexpo / 手工 Excel → 原始与规范化数据 → **主库 `mwlab.db`**（合并规则见 PRD 与 `merge_engine.py`）。

**六表关系（仓库内表名为单数）**

```
exhibition_brand（品牌）
  ├── exhibition_edition（届次，面积/展商/观众等核心数字）
  ├── data_provenance（溯源）
  └── manual_tag_history（人工打标历史）

crawl_log          爬取批次日志
user               用户（JWT 体系，与 Schema 中表名一致）
```

**双源冲突（摘）**：名称/时间/地点以 jufair 为准；展商数/观众数/面积取较大值；主办方双源保留、差异人工兜底；缺失字段谁有取谁。

**必须人工打标的字段（摘）**：`competition_relation`、`mds_related`、`strategic_relevance`、`ma_potential`、`competitor_group`、`industry_l1` / `industry_l2`、届次侧 `yoy_trend`、`anomaly_flag` 等（完整定义见 PRD 与 `schema/init_db.sql`）。

---

## 运行与约束（AGENTS + CLAUDE）

- **Python**：3.12+（与项目约定一致）。  
- **依赖栈**：FastAPI、SQLAlchemy、pandas、requests、BeautifulSoup 等；Phase 3b 工具额外需要 **openpyxl**（`python3 -m pip install openpyxl`）。  
- **Jufair 爬虫**：须在 **大陆 IP** 环境执行（例如已验证的北京 Mac Mini 节点）。  
- **进程**：爬虫与对外 API 建议 **分进程/分容器** 部署。

**打标 API（示例）**

```bash
uvicorn tag_api:app --reload --port 8000
```

**Excel 打标（Phase 3b，示例）**

```bash
python3 tools/export_for_tagging.py --industry_l2 "机床" --status untagged
python3 tools/import_tags.py --file exports/tagging_batch_YYYYMMDD.xlsx --changed-by you@company.com
```

---

## 权威文档与规划入口

| 资源 | 路径 |
|------|------|
| 整合 PRD（唯一产品权威） | `MWLAB-2026-PRD-v1.1-merged.md` |
| 代理/架构一页纸 | `AGENTS.md` |
| AI/协作约束 | `CLAUDE.md` |
| 项目叙述与决策表 | `.planning/PROJECT.md` |
| Phase 路线与需求 ID | `.planning/ROADMAP.md` |
| 架构补充说明 | `docs/ARCHITECTURE.md` |

**金标准数据**：93 条手工品牌样本为字段定义的工程基准（PRD / Phase 2 验收）。

---

## 首图说明

`docs/readme-hero-mds.png` 由 `scripts/generate_readme_hero.py` 生成：**透明背景**（PNG alpha，无填充底色）；主标 **MDS** 为 **2×2 物理像素/逻辑格**；副标 **BD Database** 为 **1×1 物理像素/逻辑格**（更细）；字色 **#fe5c00**（RGBA 不透明）。

企业 VI 见 `3_Messe Düsseldorf_Corporate Design Manual.pdf`。

---

*README 随 PRD 与 `.planning/*` 变更时请同步更新。*
