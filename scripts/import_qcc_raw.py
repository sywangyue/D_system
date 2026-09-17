#!/usr/bin/env python3
"""把 reports/customer/*_raw.json（企查查深度调研原始返回）导入 company 表。

背景：深度尽调跑过 6 家公司，但工具只落了文件，一家都没进库 ——
company 表 495 行全部是 CIBS2026 展商批量线索。本脚本补这一环。

原始 json 以企查查接口号为键，2001 = 企业详情（49 字段）。
同一公司多次采集时取 collected_at 最新的那份。

用法:
  python3 scripts/import_qcc_raw.py            # dry-run
  python3 scripts/import_qcc_raw.py --execute
"""
import argparse, json, re, sqlite3
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "mwlab.db"
PAT = re.compile(r"^qcc_research_(?P<name>.+?)_(?P<d>\d{8})_(?P<t>\d{6})_raw\.json$")

# company 列 ← 企查查 2001 字段
FIELDS = {
    "name": "Name", "credit_code": "CreditCode", "oper_name": "OperName",
    "start_date": "StartDate", "company_status": "Status",
    "reg_no": "No", "address": "Address",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--execute", action="store_true")
    args = ap.parse_args()

    # 同一公司取最新一次采集
    latest: dict[str, tuple[datetime, Path]] = {}
    for p in sorted((ROOT / "reports" / "customer").glob("*_raw.json")):
        m = PAT.match(p.name)
        if not m:
            continue
        ts = datetime.strptime(m.group("d") + m.group("t"), "%Y%m%d%H%M%S")
        key = m.group("name")
        if key not in latest or ts > latest[key][0]:
            latest[key] = (ts, p)

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = []
    for key, (ts, p) in sorted(latest.items()):
        raw = json.loads(p.read_text(encoding="utf-8"))
        node = (raw.get("2001") or {}).get("Result") or {}
        data = node.get("Data")
        if not data:
            print(f"  ✗ {key}: 2001 接口无数据，跳过")
            continue
        rec = {col: data.get(src) for col, src in FIELDS.items()}
        rec["collected_at"] = ts.isoformat(sep=" ")
        rec["src_file"] = str(p.relative_to(ROOT))
        rows.append(rec)

    print(f"{len(latest)} 家公司，{len(rows)} 条可导入\n")
    for r in rows:
        exists = conn.execute(
            "SELECT company_id FROM company WHERE credit_code = ? OR name = ?",
            (r["credit_code"], r["name"])).fetchone()
        flag = f"已存在 id={exists['company_id']}" if exists else "新增"
        print(f"  [{flag}] {r['name']}  {r['credit_code']}  {r['oper_name']}  {r['company_status']}")

    if not args.execute:
        print("\n（dry-run，未写库。加 --execute 实际导入）")
        return

    cur = conn.cursor()
    added = 0
    for r in rows:
        if conn.execute("SELECT 1 FROM company WHERE credit_code = ? OR name = ?",
                        (r["credit_code"], r["name"])).fetchone():
            continue
        cur.execute("""
            INSERT INTO company (source_type, name, credit_code, oper_name,
                                 start_date, company_status, reg_no, address,
                                 type, contact_status, notes, created_at, updated_at)
            VALUES ('qcc_search', :name, :credit_code, :oper_name,
                    :start_date, :company_status, :reg_no, :address,
                    'target', '', :note, :now, :now)
        """, {**r, "note": f"深度尽调对象，原始数据 {r['src_file']}",
              "now": datetime.now().isoformat(sep=" ", timespec="seconds")})
        added += 1
    conn.commit()
    print(f"\n✓ 新增 {added} 家，company 表现有 "
          f"{conn.execute('SELECT COUNT(*) FROM company').fetchone()[0]} 条")


if __name__ == "__main__":
    main()
