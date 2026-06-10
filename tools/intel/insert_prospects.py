#!/usr/bin/env python3
"""
tools/intel/insert_prospects.py — 批量写入客户线索到 customer_prospect 表

由 /batch-prospect skill 调用。在执行前修改下方 prospects 列表，
填入从企查查搜索结果中提取的结构化数据。

用法:
  # 1. 修改 prospects 列表（填入实际数据）
  # 2. python3 tools/intel/insert_prospects.py
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent.parent / "mwlab.db"

# ── 修改此列表为实际搜索结果 ────────────────────────────────────────────────
prospects: list[dict] = [
    # 示例结构（删除注释，填入真实数据）：
    # {
    #     "brand_id": "EXPO-0001",       # 关联竞品展会（可为 None）
    #     "intel_report_id": None,        # 关联报告 ID（可先填 None）
    #     "source_type": "qcc_search",    # "qcc_search" 或 "manual"
    #     "company_name": "上海精密机床有限公司",
    #     "qcc_key_no": "xxxxxxxxxxxx",  # 企查查 KeyNo（未配置时为 None）
    #     "credit_code": "91310000xxxx", # 统一社会信用代码
    #     "oper_name": "张三",            # 法定代表人
    #     "start_date": "2010-05-12",    # 成立日期 YYYY-MM-DD
    #     "company_status": "存续",       # 企业状态
    #     "reg_no": "xxxxxxxxxxxx",      # 注册号
    #     "address": "上海市浦东新区...",  # 注册地址
    # },
]
# ─────────────────────────────────────────────────────────────────────────────


def main() -> None:
    if not prospects:
        print("prospects 列表为空，无数据写入。请先修改脚本中的 prospects 列表。")
        return

    conn = sqlite3.connect(str(DB_PATH))
    inserted = 0
    skipped = 0
    try:
        for p in prospects:
            if not p.get("company_name"):
                print(f"跳过：缺少 company_name 字段 → {p}")
                skipped += 1
                continue
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
                ),
            )
            inserted += 1
        conn.commit()
        print(f"已写入 {inserted} 条 prospect 记录（跳过 {skipped} 条）")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
