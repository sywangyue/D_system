# 05-06 SUMMARY — 批量客户挖掘 Skill

**Status:** Complete  
**Completed:** 2026-06-10

## Self-Check: PASSED

## What Was Built

### .claude/skills/batch-prospect/SKILL.md
- 调用方式：`/batch-prospect EXPO-0001\n上海机床厂\n广州数控...`
- 步骤结构：
  1. 确认输入 → /tmp/prospect_keywords.txt
  2. 企查查批量搜索（while 循环逐关键词搜索）
  3. 修改 insert_prospects.py prospects 列表 → `python3 tools/intel/insert_prospects.py`
  4. `report_writer.py --type batch_prospect` — 报告元数据入库
  5. `export_prospects.py --report-id <N>` — Excel 导出
  6. 汇总输出（关键词数 / 命中数 / 写入数 / Excel路径 / report_id）

### tools/intel/insert_prospects.py
- 固定脚本（版本控制），参数化 SQL 写入 customer_prospect 表
- 运行前修改文件内 prospects 列表
- 检查 company_name 必填，跳过不合法记录

## 企查查降级说明
- 未配置时输出 "[企查查未配置]"，流程不中断
- source_type 改为 'manual'，company_name = 关键词原文，工商字段留空

## Verification
- `disable-model-invocation: true` ✓
- `qcc_client.py` 调用 ✓
- `customer_prospect` 写入 ✓ (7处引用)
- `export_prospects.py` 导出命令 ✓
- DB 限制说明（聚合数字无明细）✓
