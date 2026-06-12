---
name: batch-prospect
description: 批量客户挖掘。用户提供目标竞品展会的参展商关键词列表（因 DB 无参展商明细，需手工提供），调用企查查 API 进行企业模糊搜索，批量获取工商信息，结果写入 customer_prospect 表并导出 Excel。
argument-hint: "[brand_id（竞品展会）+ 换行分隔的参展商关键词列表]"
disable-model-invocation: true
allowed-tools: Bash, Read, Write
---

## 批量客户挖掘任务

**输入参数**: $ARGUMENTS

---

## 重要说明：数据来源限制

> mwlab.db 的 exhibition_edition 表只存储参展商**聚合数字**（exhibitors_count），**没有**参展企业名单明细。
> 因此本 Skill 使用「用户提供关键词 + 企查查搜索」模式，而非从 DB 直接获取参展商列表。

---

## 第一步：确认输入参数

请用户按以下格式提供输入（若 $ARGUMENTS 已包含则跳过）：

```
目标竞品展会 brand_id: EXPO-XXXX（可选，用于关联 customer_prospect 记录）
搜索关键词列表（每行一个，来自目标展会参展商名单或行业关键词）：
上海精密机床有限公司
广州机床工具集团
苏州数控设备
...
```

将关键词保存到 /tmp/prospect_keywords.txt（每行一个关键词）。

---

## 第二步：企查查批量搜索

对 /tmp/prospect_keywords.txt 中的每个关键词执行企查查搜索：

```bash
while IFS= read -r keyword; do
  echo "=== 搜索: $keyword ==="
  python3 tools/intel/qcc_client.py "$keyword" --size 5
  echo ""
done < /tmp/prospect_keywords.txt > /tmp/qcc_results.txt
cat /tmp/qcc_results.txt
```

**降级说明**：若 QCC_APP_KEY 未配置，上述命令输出 "[企查查未配置]" 字样。
此时仍可继续执行，customer_prospect 表使用 source_type='manual'，company_name 填入关键词本身，企查查字段留空。

**调用汇总**：本步骤结束后，输出"本批次企查查调用 N 次（成功 X / 无结果 Y / 失败 Z）"汇总行。
若任何结果的 Message 以 `STOP_BATCH` 开头（101 Key 无效 / 102 余额不足），立即停止批量并报告。

---

## 第三步：将搜索结果写入 JSON 文件

根据第二步搜索结果，整理结构化数据并写入 JSON 文件：

```bash
# 写入 /tmp/prospects.json，格式为 JSON 数组，每个元素含：
# brand_id, source_type, company_name, qcc_key_no, credit_code,
# oper_name, start_date, company_status, reg_no, address
cat > /tmp/prospects.json << 'JSONEOF'
[
  {
    "brand_id": "EXPO-XXXX",
    "source_type": "qcc_search",
    "company_name": "企业全称",
    "qcc_key_no": "企查查KeyNo",
    "credit_code": "统一社会信用代码",
    "oper_name": "法定代表人",
    "start_date": "YYYY-MM-DD",
    "company_status": "存续",
    "reg_no": "注册号",
    "address": "注册地址"
  }
]
JSONEOF
```

> 企查查未配置时 source_type 用 'manual'，company_name 填入原始关键词，企查查字段留空。

---

## 第四步：创建调研报告（获取 report_id）

```bash
python3 tools/intel/report_writer.py \
  --type batch_prospect \
  --brand-id "EXPO-XXXX" \
  --content-file /tmp/prospect_report.md
```

> 先用 Write 工具将 Markdown 报告内容写入 /tmp/prospect_report.md，再执行上述命令。
> 记录返回的 report_id 值。

---

## 第五步：将线索写入 customer_prospect 表

```bash
# 使用上一步的 report_id
python3 tools/intel/insert_prospects.py \
  --json /tmp/prospects.json \
  --report-id <report_id>
```

---

## 第六步：导出 Excel 供 BD 使用

```bash
# 使用 report_id 导出
python3 tools/intel/export_prospects.py \
  --report-id <report_id>
```

文件路径显示在输出中，告知用户文件位置。

---

## 第七步：汇总输出

向用户展示：
1. 本次挖掘的关键词数量和企查查命中数 + API 调用汇总
2. 写入 customer_prospect 的记录数
3. Excel 文件路径
4. intel_report 的 report_id（供历史追踪）
5. 建议后续使用 `/single-prospect` 对高价值目标深度调研

---

## 注意事项

1. **企查查未配置**：source_type 使用 'manual'，company_name 填入原始关键词，工商字段留空
2. **关键词数量**：建议每次不超过 50 个关键词（控制 API 费用和执行时间）
3. **数据质量**：企查查模糊搜索可能返回同名公司，BD 需人工核验最终名单
4. **禁止自动化**：本 Skill 为人工触发，不做定时批量执行
5. **Message 以 STOP_BATCH 开头时立即停止批量**，避免资损
