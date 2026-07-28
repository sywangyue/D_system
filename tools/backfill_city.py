#!/usr/bin/env python3
"""从 exhibition_edition.venue 提取城市 → 回填 exhibition_brand.city

用法:
  python3 tools/backfill_city.py --dry-run   # 只报告，不写库（默认）
  python3 tools/backfill_city.py --apply     # 实际写库 + 写 manual_tag_history
"""
import argparse
import os
import sqlite3
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from tools.geo_dict import CN_CITIES

DB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "mwlab.db")

# 按长度降序，贪婪匹配
CITY_NAMES = sorted(CN_CITIES.keys(), key=lambda x: -len(x))


def extract_city(venue):
    """从展馆名提取城市。"""
    if not venue:
        return ""
    for city in CITY_NAMES:
        if city in venue:
            return city
    return ""


def run(db_path, apply_changes):
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    try:
        brands = conn.execute(
            "SELECT brand_id, name_cn, city FROM exhibition_brand WHERE city = '' OR city IS NULL"
        ).fetchall()
        print(f"city 为空: {len(brands)} 个 brand")

        updated = 0
        no_match = 0

        for b in brands:
            venues = conn.execute(
                "SELECT DISTINCT venue FROM exhibition_edition WHERE brand_id = ? AND venue != ''",
                (b["brand_id"],)
            ).fetchall()

            found_city = ""
            for v in venues:
                city = extract_city(v["venue"])
                if city:
                    found_city = city
                    break

            if not found_city:
                no_match += 1
                continue

            updated += 1
            if apply_changes:
                conn.execute(
                    "UPDATE exhibition_brand SET city = ?, updated_at = datetime('now','localtime') "
                    "WHERE brand_id = ?",
                    (found_city, b["brand_id"])
                )
                conn.execute(
                    "INSERT INTO manual_tag_history "
                    "(brand_id, field_name, old_value, new_value, changed_by, changed_at, reason) "
                    "VALUES (?, 'city', '', ?, 'system/backfill_city', datetime('now','localtime'), "
                    "'from edition.venue')",
                    (b["brand_id"], found_city)
                )
            elif updated <= 10:
                print(f"  [预览] {b['brand_id']} {b['name_cn']} → {found_city}")

        if apply_changes:
            conn.commit()

        remaining = conn.execute(
            "SELECT COUNT(*) FROM exhibition_brand WHERE city = '' OR city IS NULL"
        ).fetchone()[0]
        mode = "已回填" if apply_changes else "可回填(未写库)"
        print(f"{mode}: {updated}  无匹配: {no_match}  当前剩余空 city: {remaining}")
    finally:
        conn.close()


def main():
    ap = argparse.ArgumentParser(description="从 venue 回填 brand.city")
    ap.add_argument("--db", default=DB, help="SQLite 路径（默认 data/mwlab.db）")
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--dry-run", action="store_true", help="只报告，不写库（默认行为）")
    args = ap.parse_args()

    if not os.path.isfile(args.db):
        print(f"错误: 数据库不存在 {args.db}", file=sys.stderr)
        return 1

    apply_changes = args.apply and not args.dry_run
    print(f"{'APPLY' if apply_changes else 'DRY-RUN'} | 数据库: {args.db}")
    run(args.db, apply_changes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
