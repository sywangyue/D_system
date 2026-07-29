#!/usr/bin/env python3
"""
refresh_edition_status.py — 按日期回填 exhibition_edition.status

背景（REMEDIATION-DRAFT-2026-07-29 P0-2）：
    status 有 CHECK 约束、前端 app/api/exhibition/[id] 也在读，
    但全库 7,505 条里只有 2 条有值 —— 4,412 条已过期届次仍不是「已举办」，
    任何按「即将举办」筛选的逻辑都在空转。

status 由日期派生，会随时间变化，所以本脚本需要周期性重跑
（与 check_display_ready.py 同频，每周 cron）。
人工设定的「取消」「延期」不会被覆盖。

    date_end   < 今天  → 已举办
    date_end  >= 今天  → 即将举办（含正在进行）
    日期缺失           → 保持原值

用法:
    python3 scripts/refresh_edition_status.py --dry
    python3 scripts/refresh_edition_status.py
"""
from __future__ import annotations

import argparse
import sqlite3
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "mwlab.db"

# 人工判断，不由日期推翻
MANUAL_STATUS = ("取消", "延期")


def main() -> None:
    ap = argparse.ArgumentParser(description="按日期回填届次 status")
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("--dry", action="store_true", help="只统计不写库")
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA foreign_keys = ON")
    placeholders = ",".join("?" * len(MANUAL_STATUS))
    where = (f"date_end IS NOT NULL AND date_end != '' "
             f"AND status NOT IN ({placeholders})")

    counts = dict(conn.execute(
        f"SELECT CASE WHEN date_end < date('now','localtime') THEN '已举办' "
        f"ELSE '即将举办' END, COUNT(*) FROM exhibition_edition "
        f"WHERE {where} GROUP BY 1", MANUAL_STATUS).fetchall())
    changed = conn.execute(
        f"SELECT COUNT(*) FROM exhibition_edition WHERE {where} AND status != "
        f"CASE WHEN date_end < date('now','localtime') THEN '已举办' ELSE '即将举办' END",
        MANUAL_STATUS).fetchone()[0]
    skipped = conn.execute(
        "SELECT COUNT(*) FROM exhibition_edition WHERE date_end IS NULL OR date_end = ''"
    ).fetchone()[0]

    print(f"{'DRY-RUN' if args.dry else 'APPLY'} | {args.db}")
    print(f"  已举办 {counts.get('已举办', 0)} · 即将举办 {counts.get('即将举办', 0)}"
          f" · 日期缺失跳过 {skipped}")
    print(f"  需变更 {changed} 条")

    if not args.dry:
        conn.execute(
            f"UPDATE exhibition_edition SET status = CASE "
            f"WHEN date_end < date('now','localtime') THEN '已举办' ELSE '即将举办' END "
            f"WHERE {where}", MANUAL_STATUS)
        conn.commit()
        left = conn.execute(
            "SELECT COUNT(*) FROM exhibition_edition WHERE status = ''").fetchone()[0]
        print(f"  完成。status 仍为空 {left} 条")
    conn.close()


if __name__ == "__main__":
    main()
