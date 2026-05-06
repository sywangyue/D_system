# ROADMAP · MWLAB-2026

**Granularity:** Standard（与 PRD Phase 1–4 对齐）  
**Mode:** YOLO（config）— 仍按客户 Phase 间人工验收闸口执行

## ✅ 已完成的 Phases

### Phase 1 · 数据采集器（Hermes）

**Goal:** 两源爬虫工程化 + 调度 + `crawl_log`，稳定输出可合并的 raw 表。

| Maps to | Result |
|---------|--------|
| DATA-01, DATA-02, DATA-03 | ✅ 爬虫已验证可跑，3.4K 条数据入库，调度器实现 |

### Phase 2 · 清洗、合并与打标 API（Claude Code）

**Goal:** 全量 Schema、migrations、`merge_engine`、`tag_api` 与测试及 93 条金标准对拍。

| Maps to | Result |
|---------|--------|
| DMG-01, DMG-02, TAG-01 | ✅ merge_engine 跑通金标准（零字段丢失）；打标 API 可用；pytest 覆盖 |

### Phase 3 · API、认证与工程交付（Cursor · 工程整合者）

**Goal:** Dashboard + JWT；镜像 + OpenAPI + 部署对比表三件套。

| Maps to | Result |
|---------|--------|
| DSH-01, AUT-01, OPS-01, OPS-02, OPS-03 | ✅ Dashboard API + JWT 认证 + Docker 镜像 + OpenAPI + 部署对比表 |

### Phase 3b · 打标工具（新增 — 基于 Adjustment v1.1）

**Goal:** Excel 批量导出/导入，补全打标工作流。

| Maps to | Result |
|---------|--------|
| EXPORT-TOOL | ✅ `tools/export_for_tagging.py` — 按 `industry_l2` 导出，含下拉验证 |
| IMPORT-TOOL | ✅ `tools/import_tags.py` — 读取 Excel → `exhibition_brand` + `manual_tag_history` |

**Agent assignment:** Cursor — 已完成（`tests/test_tagging_tools.py`）

---

## 📋 待执行的 Phases

### Phase 1b · 全集采集（新增 — 基于 Adjustment v1.1）

**Goal:** Jufair 从 3.4K 扩至 8.4K（国内 122 页 + 国际 300 页）+ cnexpo 全量探测采集 + 全量合并。

| Maps to | Success criteria |
|---------|------------------|
| FULL-CRAWL | Jufair 全量补采完成，新增约 5K 条，总量约 8.4K |
| CNEXPO-FULL | cnexpo 全量探测 + 采集完成，字段覆盖率矩阵报告 |
| MERGE-FULL | 全集合并跑通，双源冲突条目数量报告 |

**Agent assignment:** Hermes（3 个串行子任务）

### Phase 4 · UI/UX（Claude Design）— ⏸ ON HOLD

**Goal:** ≤3 点选控件大屏；依赖 Phase 1–3 **全部**签收；Phase 3b 打标工具 ✅；Phase 1b 为数据集扩容，可与本 Phase 并行（见 Phase 4 Context）。

---

## Requirement coverage check

| Phase | Requirement IDs | Status |
|-------|-----------------|--------|
| 1 | DATA-01 — DATA-03 | ✅ Done |
| 2 | DMG-01, DMG-02, TAG-01 | ✅ Done |
| 3 | DSH-01, AUT-01, OPS-01 — OPS-03 | ✅ Done |
| 1b | FULL-CRAWL, CNEXPO-FULL, MERGE-FULL | ⏳ Pending |
| 3b | EXPORT-TOOL, IMPORT-TOOL | ✅ Done |
| 4 | UI-POOL | ⏸ On Hold |

---

*Roadmap updated: 2026-05-06 · Phase 3b（打标工具）marked Done*
