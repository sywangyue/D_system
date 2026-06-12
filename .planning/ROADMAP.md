# MWLAB-2026 — Roadmap

> Phase 编号对照见 `docs/MWLAB-2026-PRD-v1.1-merged.md → §Phase 编号对照（v1.1 后）`  
> 执行与状态追踪以本 ROADMAP 编号为准。

**项目**: Exhibition Competitive Intelligence Dashboard  
**客户**: Messe Düsseldorf China (杜塞展览)  
**当前目标**: 为 BD 团队构建展会情报后端系统

---

## 已完成阶段

### Phase 1: 数据采集器
**Status:** ✅ Complete  
**Goal:** Jufair + cnexpo 双源爬虫 + 调度器  
**Deliverables:** jufair_crawler.py, cnexpo_crawler.py, scheduler.py

### Phase 1b: 全集采集
**Status:** ⏳ In Progress  
**Goal:** Jufair 8.4K 全量 + cnexpo 全量采集  
**Deliverables:** 完整展会数据入库

### Phase 2: Schema + 合并引擎
**Status:** ✅ Complete  
**Goal:** 六表 Schema + 双源合并引擎 + 打标 API  
**Deliverables:** schema/init_db.sql, merge_engine.py, tools/export_for_tagging.py / import_tags.py（打标工具）

### Phase 3: Dashboard 查询 API
**Status:** ✅ Complete  
**Goal:** JWT 认证 + FastAPI + Docker + OpenAPI + 部署  
**Deliverables:** FastAPI app, Docker, 阿里云部署

### Phase 3b: 打标批量工具
**Status:** ✅ Complete  
**Goal:** Excel 导出/导入批量打标  
**Deliverables:** tools/export_for_tagging.py, tools/import_tags.py

---

## 当前规划阶段

### Phase 5: 情报后端 (Intelligence Backend)
**Status:** 🔲 Planning  
**Goal:** 为 BD 团队构建四层情报能力后端系统，以展会品牌为核心键位，串联行业调研、品牌调研、批量客户挖掘和单一客户挖掘四个模块。所有数据必须来自 DB，结果沉淀回 DB，操作全部人工触发。
**Mode:** backend-only (无前端任务)  
**Plans:** 7 plans

**Requirements:**
- REQ-01: 行业调研模块 — 通过 DB 数据 + WebSearch 分析行业容量、竞争格局、切入点位
- REQ-02: 品牌展会调研模块 — 深度分析单一品牌的历史届次、关系网络、竞争趋势
- REQ-03: 批量客户挖掘模块 — 接入企查查 API，针对展会参展商进行模糊匹配
- REQ-04: 单一客户挖掘模块 — 对协会/关键公司/代理机构的深度调研
- REQ-05: Skill 系统 — 每次调研结果沉淀为可复用的 skill，越用越聪明
- REQ-06: DB 优先原则 — 所有展会数据来自 mwlab.db，禁止 LLM 虚构

Plans:
- [ ] 05-01-PLAN.md — DB 迁移：新增 intel_report + customer_prospect 表，初始化目录结构
- [ ] 05-02-PLAN.md — 工具库：tools/intel/db_query.py（DB 查询注入脚本）+ qcc_client.py（企查查 API）
- [ ] 05-03-PLAN.md — 持久化工具：tools/intel/report_writer.py（报告写入）+ export_prospects.py（Excel 导出）
- [ ] 05-04-PLAN.md — 行业调研 Skill：.claude/skills/industry-research/SKILL.md
- [ ] 05-05-PLAN.md — 品牌调研 Skill：.claude/skills/brand-research/SKILL.md
- [ ] 05-06-PLAN.md — 批量客户挖掘 Skill：.claude/skills/batch-prospect/SKILL.md
- [ ] 05-07-PLAN.md — 单一客户挖掘 Skill：.claude/skills/single-prospect/SKILL.md

**Depends on:** Phase 2, Phase 3

---

## 暂缓阶段

### Phase 4: 前端 UI
**Status:** ⏸ Paused  
**Goal:** Dashboard 前端界面  
**Note:** 客户决策暂缓，待情报后端成熟后再议
