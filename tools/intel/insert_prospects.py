#!/usr/bin/env python3
"""
tools/intel/insert_prospects.py — 批量写入客户线索到 customer_prospect 表

由 /batch-prospect skill 调用。从 --json 文件读取 prospects 列表，
INSERT OR IGNORE 实现幂等写入。

用法:
  python3 tools/intel/insert_prospects.py --json /tmp/prospects.json
  python3 tools/intel/insert_prospects.py --json /tmp/prospects.json --report-id 3
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent.parent.parent / "mwlab.db"

# JSON 字段映射到 DB 列
_FIELD_MAP = {
    "brand_id": "brand_id",
    "intel_report_id": "intel_report_id",
    "source_type": "source_type",
    "company_name": "company_name",
    "qcc_key_no": "qcc_key_no",
    "credit_code": "credit_code",
    "oper_name": "oper_name",
    "start_date": "start_date",
    "company_status": "company_status",
    "reg_no": "reg_no",
    "address": "address",
}


def main() -> None:
    parser = argparse.ArgumentParser(description="批量写入客户线索到 customer_prospect 表")
    parser.add_argument("--json", required=True, help="prospects JSON 文件路径")
    parser.add_argument("--report-id", type=int, help="覆盖/填充所有记录的 intel_report_id")
    parser.add_argument("--db", default=str(DEFAULT_DB), help="数据库路径（默认 mwlab.db）")
    args = parser.parse_args()

    json_path = Path(args.json)
    if not json_path.exists():
        print(f"错误: JSON 文件不存在: {json_path}", file=sys.stderr)
        sys.exit(1)

    prospects: list[dict] = json.loads(json_path.read_text(encoding="utf-8"))
    if not prospects:
        print("prospects 列表为空，无数据写入。")
        return

    db_path = args.db
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    inserted = 0
    skipped = 0
    try:
        for p in prospects:
            company_name = p.get("company_name")
            if not company_name:
                print(f"跳过：缺少 company_name 字段 → {p}")
                skipped += 1
                continue

            # qcc_key_no 为 None 时按 (brand_id, company_name) 查重
            qcc_key_no = p.get("qcc_key_no")
            if qcc_key_no is None:
                dup = conn.execute(
                    "SELECT 1 FROM customer_prospect "
                    "WHERE brand_id IS ? AND company_name = ? LIMIT 1",
                    (p.get("brand_id"), company_name),
                ).fetchone()
                if dup:
                    print(f"跳过（重复）: {company_name} (brand_id={p.get('brand_id')})")
                    skipped += 1
                    continue

            report_id = args.report_id if args.report_id is not None else p.get("intel_report_id")

            conn.execute(
                "INSERT OR IGNORE INTO customer_prospect "
                "(intel_report_id, brand_id, source_type, company_name, qcc_key_no, "
                " credit_code, oper_name, start_date, company_status, reg_no, address) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (
                    report_id,
                    p.get("brand_id"),
                    p.get("source_type", "qcc_search"),
                    company_name,
                    qcc_key_no,
                    p.get("credit_code"),
                    p.get("oper_name"),
                    p.get("start_date"),
                    p.get("company_status"),
                    p.get("reg_no"),
                    p.get("address"),
                ),
            )
            # changes() 返回上一条语句影响的行数；INSERT OR IGNORE 跳过时返回 0
            if conn.execute("SELECT changes()").fetchone()[0] > 0:
                inserted += 1
            else:
                skipped += 1

        conn.commit()
        print(f"已写入 {inserted} 条 prospect 记录（跳过 {skipped} 条）")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
