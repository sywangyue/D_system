---
phase: 06-code-audit
plan: 06-06
status: complete
wave: 5
completed_at: 2026-06-12
---

# 06-06 SUMMARY — Wave 5 · Medium/Low 收尾 + 客户决策项

## 客户决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| CORE-09 XFF ACL 绕过 | **remove** | 消除合规/法律风险；文件随 delete-curl 一并删除 |
| backfill 重复 | **delete-curl** | curl 版价值归零（XFF 已删），_local.py 保留 |
| D-04 scheduler.py | **delete** | 项目全手动触发，调度器是死代码 |
| D-05 --tagger 兼容参数 | **remove** | 符合 CLAUDE.md"不写兼容性代码"约束 |

## 自动任务执行情况

| Task | 发现 IDs | 状态 | 关键变更 |
|------|----------|------|---------|
| 5 | CORE-09, D-04, D-05, backfill 重复 | ✅ | 删除 backfill_organizer.py + scheduler.py，移除 --tagger |
| 6 | CORE-11, CORE-13 | ✅ | 边界匹配+歧义报告，审计写真值，裸 except 可观测化 |
| 7 | CORE-12, CORE-14 | ✅ | busy_timeout=30000，export_monthly 输入校验+连接托管 |
| 8 | CORE-15, INTEL-13 | ✅ | geo_dict 去重键，删 INFERENCE_RULES，清无用 import，简化正则 |
| 9 | CRWL-18, CRWL-19 | ✅ | cnexpo 英文名搜索范围收窄，jufair get_crawled_urls 提升 |
| 10 | 全量验收 | ✅ | pytest 142 + npm 33 全绿，68/68 ID 追溯完毕 |

## 最终处置统计

- **修复**: 64 项（61 编号 + 3 客户决策执行 remove/delete）
- **客户决策保留**: 0 项（4 决策全选 remove/delete，无 keep）
- **暂缓**: 1 项（`test_parse_md_excel` — 依赖 Excel 数据文件缺失，与本 Phase 无关）

## 全量测试结果

```
pytest tests/   142 passed, 1 deselected  (pre-existing missing Excel fixture)
npm test        33 passed
```

## Self-Check: PASSED
