#!/usr/bin/env python3
"""重建 brand_organizer 规范化索引表。

从 exhibition_brand.organizer 拆分出每个参与单位，归并到集团级 canonical 名，
写入 brand_organizer。原始 organizer 字段不动。可反复重跑（全量重建）。

用法:
  python3 tools/build_organizer_index.py --dry-run    # 只看统计，不写库
  python3 tools/build_organizer_index.py              # 重建
"""
import argparse
import sqlite3
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from rank_organizers import ALIAS_FILE, DB, Aliases, classify, normalize_corp_name, split_organizer


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not DB.exists():
        sys.exit(f"数据库不存在: {DB}")
    aliases = Aliases(ALIAS_FILE)
    db = sqlite3.connect(DB)

    if not db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='brand_organizer'").fetchone():
        sys.exit("brand_organizer 表不存在，请先执行 schema/migrations/013_brand_organizer.sql")

    rows = db.execute("SELECT brand_id, organizer FROM exhibition_brand WHERE organizer != ''").fetchall()
    records, types, confs, dropped = [], Counter(), Counter(), 0

    for brand_id, organizer in rows:
        seq = 0
        for token in split_organizer(organizer):
            if token.lower() in aliases.drop:
                dropped += 1
                continue
            hit = aliases.lookup(token)
            if hit:
                canonical, org_type, conf = hit
            else:
                org_type = classify(token)
                canonical = normalize_corp_name(token) if org_type == "企业" else token
                conf = "auto"
            records.append((brand_id, seq, token, canonical, org_type, conf))
            types[org_type] += 1
            confs[conf] += 1
            seq += 1

    print(f"品牌 {len(rows)} 条 → 单位 {len(records)} 行 | 丢弃残片 {dropped}")
    print("  类型:", "  ".join(f"{k} {v}" for k, v in types.most_common()))
    print("  置信:", "  ".join(f"{k} {v}" for k, v in confs.most_common()))
    print(f"  规范名去重后: {len({r[3] for r in records})} 家"
          f"（其中企业 {len({r[3] for r in records if r[4] == '企业'})} 家）")

    if args.dry_run:
        print("\n--dry-run，未写库")
        return

    db.execute("DELETE FROM brand_organizer")
    db.executemany(
        "INSERT INTO brand_organizer (brand_id, seq, raw_token, canonical, org_type, confidence)"
        " VALUES (?,?,?,?,?,?)", records)
    db.commit()
    print(f"\n已重建 brand_organizer: {db.execute('SELECT COUNT(*) FROM brand_organizer').fetchone()[0]} 行")


if __name__ == "__main__":
    main()
