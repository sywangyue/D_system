#!/usr/bin/env python3
"""迁移旧 exhibitions 表数据到 raw_jufair，然后重新合并到 mwlab.db"""
import re
import sqlite3
from datetime import datetime
from pathlib import Path

DB = str(Path(__file__).resolve().parent / "jufair_2026.db")
BATCH_ID = f"migrate_exhibitions_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

conn = sqlite3.connect(DB)

# 读取旧表
old = conn.execute(
    "SELECT cn_name, en_name, date, venue, area, visitors, exhibitors, source_type, source_url "
    "FROM exhibitions ORDER BY date"
).fetchall()
print(f"旧 exhibitions 表: {len(old)} 条")

# 检查 raw_jufair 已有条数
before = conn.execute("SELECT COUNT(*) FROM raw_jufair").fetchone()[0]
print(f"raw_jufair 迁移前: {before} 条")

# 迁移
def extract_year(date_str):
    m = re.search(r"(\d{4})", str(date_str))
    return int(m.group(1)) if m else 0

inserted = 0
skipped = 0
existing = {r[0] for r in conn.execute("SELECT source_url FROM raw_jufair").fetchall()}
for row in old:
    cn_name, en_name, date_str, venue, area, visitors, exhibitors, source_type, source_url = row
    if source_url in existing:
        skipped += 1
        continue
    year = extract_year(date_str)
    conn.execute(
        """INSERT INTO raw_jufair
           (cn_name, en_name, date_str, year, venue, city,
            area_str, visitors_str, exhibitors_str,
            organizer, cycle, industry,
            source_type, source_url, detail_crawled, crawl_batch_id)
           VALUES (?,?,?,?,?,?,
                   ?,?,?,
                   '','','',
                   ?,?,0,?)""",
        (cn_name, en_name, date_str, year, venue, "",
         area or "", visitors or "", exhibitors or "",
         source_type, source_url, BATCH_ID)
    )
    existing.add(source_url)
    inserted += 1

conn.commit()

after = conn.execute("SELECT COUNT(*) FROM raw_jufair").fetchone()[0]
print(f"raw_jufair 迁移后: {after} 条 (新增 {inserted}，跳过 {skipped})")
print(f"批次: {BATCH_ID}")
conn.close()

# 重新运行合并引擎
print("\n运行合并引擎...")
import subprocess
import sys

_MERGE = str(Path(__file__).resolve().parent / "merge_engine.py")
result = subprocess.run(
    [sys.executable, _MERGE, "--batch", "ALL"],
    capture_output=True, text=True, timeout=120
)
print(result.stdout)
if result.stderr:
    print("STDERR:", result.stderr[:500])
