# 06-03 Intel 修复 — SUMMARY

**状态**: ✅ 完成（2026-06-12）

## 执行概况

| Task | 修复项 | 文件 | 状态 |
|------|--------|------|------|
| 1 | customer_prospect 唯一约束 + FK [INTEL-03][INTEL-07] | 008_prospect_unique.sql, insert_prospects.py, report_writer.py | ✅ |
| 2 | insert_prospects --json 文件输入 [INTEL-02] | insert_prospects.py | ✅ |
| 3 | batch-prospect 流程重排（报告先行）[INTEL-01][INTEL-11] | SKILL.md | ✅ |
| 4 | qcc_client 201/101/102 状态码语义化 [INTEL-06] | qcc_client.py | ✅ |
| 5 | db_query l1/l2 斜杠/多命中/company_history 标题/L2 计数 [INTEL-04/05/09/14] | db_query.py | ✅ |
| 6 | skills 注入面收敛 + --content-file + allowed-tools + openpyxl [INTEL-10/15/16/08] | 4×SKILL.md, export_prospects.py, requirements.txt | ✅ |
| 7 | 端到端降级模式演练 | 临时库全链路走通 → 非空 Excel 导出 | ✅ |

## 关键变更

- **008 迁移**: customer_prospect (brand_id, qcc_key_no) 部分唯一索引 + 存量去重
- **insert_prospects.py**: 从修改源码改为 `--json` 文件输入 + `--report-id` + `--db`，INSERT OR IGNORE 幂等
- **report_writer.py**: `--content-file` 替代 `--content "$(cat)"`，加 `--db` 参数
- **qcc_client.py**: 201→正常空结果；101/102→`STOP_BATCH` 前缀（资损防线）
- **db_query.py**: 斜杠 `"机械和设备/机床"` 自动分割 l1/l2；多命中 `"另有 N 条匹配"` 提示
- **SKILL.md 注入面**: `$ARGUMENTS` shell 内插全部改为写 `/tmp` 文件再 `$(cat /tmp/...)`

## 测试结果

- 端到端演练：创建报告 → insert → export xlsx 全程走通
- 双插幂等：第二次 inserted=0
- FK 约束：坏 brand_id 报 IntegrityError
- 201/102→正常/STOP_BATCH 语义断言通过
- pytest: **113 passed, 0 failed**（1 pre-existing deselected）

## 上线解禁声明

✅ 企查查接入路径已具备可上线状态：数据幂等、状态码语义化、注入面消除、降级模式端到端可导出非空 Excel。
