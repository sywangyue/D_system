# 06-05 文档对齐 + 回归测试 — SUMMARY

**状态**: ✅ 完成（2026-06-12）

## 执行概况

| Task | 内容 | 涉及文件 | 状态 |
|------|------|---------|------|
| 1 | 移除 tag_api 失效引用 + 框架修正 [D-01][D-02] | CLAUDE.md, AGENTS.md, STATE.md, ROADMAP.md | ✅ |
| 2 | Phase 编号对照表 [D-03] | PRD, ROADMAP | ✅ |
| 3 | CHECKPOINT: 部署目标确认 ✅ 阿里云 | — | ✅ |
| 4 | 统一部署目标描述 [D-07] | PRD | ✅ |
| 5 | merge_engine 回归测试（CORE-01~05,08,04） | test_merge_engine.py, test_schema.py (+7用例) | ✅ |
| 6 | API/middleware 安全回归（API-01~05） | middleware.test.ts, auth.test.ts, people.test.ts (+17用例) | ✅ |
| 7 | intel 工具 mock 测试（INTEL-01~06） | test_qcc_client.py, test_intel_tools.py (+14用例) | ✅ |
| 8 | 爬虫 fixture 回归（CRWL-01,04,10,14） | test_crawlers.py, fixtures/ (+9用例) | ✅ |
| 9 | 全量套件收尾 | — | ✅ |

## 测试覆盖前后对比

| 指标 | 审计基线 | 现在 |
|------|---------|------|
| pytest 用例总数 | 60 | **142** (+82) |
| pytest 测试文件 | 4 | **8** (+4) |
| npm test 用例总数 | 10 | **33** (+23) |
| npm test 文件 | 3 | **6** (+3) |
| 零覆盖路径（middleware/login/people） | 3 个 route 零测试 | 全部有回归 |
| 爬虫/intel 测试 | 0 | **23** 用例 |
| 占位测试 `expect(true).toBe(true)` | 4 处 | **0** |

## 关键交付物

- **测试文件新增**: `test_crawlers.py`, `test_qcc_client.py`, `test_intel_tools.py`, `tests/api/auth.test.ts`, `tests/api/people.test.ts`
- **HTML fixture**: `tests/fixtures/`（jufair 列表/详情、cnexpo 正常/错位）
- **文档修正**: 4 项文档漂移清零 + 部署目标客户确认 + Phase 编号对照表
- **工具增强**: `export_prospects.py`, `report_writer.py`, `insert_prospects.py` 均加 `--db` 参数

## 最终测试结果

```
pytest: 142 passed, 0 failed ✅
npm test: 33 passed, 6 files ✅
```
