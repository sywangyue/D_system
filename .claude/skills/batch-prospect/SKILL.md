---
name: batch-prospect
description: 批量客户挖掘。用户提供目标竞品展会的参展商关键词列表（因 DB 无参展商明细，需手工提供），调用企查查 API 进行企业模糊搜索，批量获取工商信息，结果写入 customer_prospect 表并导出 Excel。
argument-hint: "[brand_id（竞品展会）+ 换行分隔的参展商关键词列表]"
disable-model-invocation: true
allowed-tools: Bash Read Write
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

---

## 第三步：将结果写入 customer_prospect 表

根据第二步搜索结果，修改并执行 tools/intel/insert_prospects.py：

```python
#!/usr/bin/env python3
"""批量写入 customer_prospect，由 batch-prospect skill 调用"""
import sqlite3
from pathlib import Path

DB_PATH = Path("mwlab.db")

# ── 从以上搜索结果提取结构化数据（替换以下列表）──
prospects = [
    # {
    #     "brand_id": "EXPO-XXXX",        # 关联竞品展会（可为 None）
    #     "intel_report_id": None,         # 先写 None，下一步创建报告后更新
    #     "source_type": "qcc_search",     # 或 "manual"（API 未配置时）
    #     "company_name": "企业全称",
    #     "qcc_key_no": "企查查KeyNo",      # API 未配置时为 None
    #     "credit_code": "统一社会信用代码",
    #     "oper_name": "法定代表人",
    #     "start_date": "YYYY-MM-DD",
    #     "company_status": "存续",
    #     "reg_no": "注册号",
    #     "address": "注册地址",
    # },
]

conn = sqlite3.connect(str(DB_PATH))
inserted = 0
for p in prospects:
    conn.execute(
        "INSERT INTO customer_prospect "
        "(intel_report_id, brand_id, source_type, company_name, qcc_key_no, "
        " credit_code, oper_name, start_date, company_status, reg_no, address) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            p.get("intel_report_id"),
            p.get("brand_id"),
            p.get("source_type", "qcc_search"),
            p["company_name"],
            p.get("qcc_key_no"),
            p.get("credit_code"),
            p.get("oper_name"),
            p.get("start_date"),
            p.get("company_status"),
            p.get("reg_no"),
            p.get("address"),
        )
    )
    inserted += 1
conn.commit()
print(f"已写入 {inserted} 条 prospect 记录")
conn.close()
```

执行：
```bash
python3 tools/intel/insert_prospects.py
```

---

## 第四步：创建调研报告（记录本次挖掘元数据）

```bash
python3 tools/intel/report_writer.py \
  --type batch_prospect \
  --brand-id "EXPO-XXXX" \
  --content "# 批量客户挖掘报告

**挖掘日期**: $(date +%Y-%m-%d)
**目标展会**: [竞品展会名称 + brand_id]
**搜索关键词数**: [关键词总数]
**企查查命中数**: [实际找到企业数]
**数据来源**: [企查查 API / 手工录入（企查查未配置）]

## 挖掘摘要

[简述本次挖掘的目标、方法和主要发现]

## 关键词列表

[列出使用的关键词]

## 后续行动建议

- BD 团队请下载 Excel 文件进行人工筛选
- 优先跟进企业规模较大、成立时间较长的目标
- 建议通过 /single-prospect 对高价值目标做深度调研
"
```

记录返回的 report_id 值，用于下一步 Excel 导出。

---

## 第五步：导出 Excel 供 BD 使用

```bash
# 使用上一步的 report_id 导出（替换 <report_id> 为实际值）
python3 tools/intel/export_prospects.py \
  --report-id <report_id>
```

文件路径显示在输出中，告知用户文件位置。

---

## 第六步：汇总输出

向用户展示：
1. 本次挖掘的关键词数量和企查查命中数
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
