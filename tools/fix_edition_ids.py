#!/usr/bin/env python3
"""
fix_edition_ids.py — 一次性清理：合并完全重复的届次 + 重建错位的 edition_id

背景（REMEDIATION-DRAFT-2026-07-29 P0-3 / P0-5）：
    dedup 在 2026-07-28 补上级联重建之前（scripts/dedup.py:455），合并品牌时
    改了 brand_id 却没重写 edition_id，留下 86 条 `edition_id` 前缀 ≠ `brand_id`，
    以及 38 组「同 brand_id + 同 year」的重复届次。

    这 38 组不都是重复：
      A 完全重复（日期 + 场馆均相同）  29 组 —— 本脚本自动合并
      B 同场馆不同日期（一年两场）      6 组 —— 不动，需人工核对
      C 不同场馆                       3 组 —— 不动，疑似错误合并

    因为 B 类证明「一年两场」是合法的，所以**不能**加 UNIQUE(brand_id, year)。

合并规则：逐字段取并集，不是整行二选一 —— 两行常各有各的非空字段。
（教训来自 normalize_source_urls：行数对得上不等于数据没丢。）

用法:
    python3 tools/fix_edition_ids.py                # dry-run（默认）
    python3 tools/fix_edition_ids.py --apply
    python3 tools/fix_edition_ids.py --db path.db --apply
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

DEFAULT_DB = Path(__file__).resolve().parent.parent / "data" / "mwlab.db"

# 合并时逐字段取并集的列（主键、外键、时间戳除外）
MERGE_FIELDS = ("edition_num", "date_start", "date_end", "city", "venue", "status",
                "area_sqm", "exhibitors_count", "visitors_count",
                "overseas_exhibitor_pct", "booth_price_per_sqm", "heat_score",
                "yoy_trend", "anomaly_flag", "data_source", "notes")

# 双源冲突规则（AGENTS.md）：这三项取较大值，其余取「谁有取谁」
MAX_FIELDS = ("area_sqm", "exhibitors_count", "visitors_count")


def _empty(v) -> bool:
    return v is None or v == "" or v == 0


def group_duplicates(conn: sqlite3.Connection) -> dict[str, list[list[sqlite3.Row]]]:
    """把同 brand_id + year 的重复组分成 A/B/C 三类。"""
    rows = conn.execute(
        "SELECT * FROM exhibition_edition ORDER BY brand_id, year, edition_id"
    ).fetchall()
    by_key = defaultdict(list)
    for r in rows:
        by_key[(r["brand_id"], r["year"])].append(r)

    out = {"A": [], "B": [], "C": []}
    for members in by_key.values():
        if len(members) < 2:
            continue
        venues = {(m["venue"] or "").strip() for m in members}
        dates = {m["date_start"] for m in members}
        if len(venues) > 1:
            out["C"].append(members)
        elif len(dates) > 1:
            out["B"].append(members)
        else:
            out["A"].append(members)
    return out


def merge_group(conn: sqlite3.Connection, members: list[sqlite3.Row],
                apply: bool, conflicts: list) -> int:
    """保留 edition_id 前缀正确的一行，其余逐字段并入后删除。返回并入的字段数。"""
    def score(r):
        prefix_ok = r["edition_id"].startswith(f"{r['brand_id']}-")
        filled = sum(1 for c in MERGE_FIELDS if not _empty(r[c]))
        return (prefix_ok, filled, r["edition_id"])

    keep = max(members, key=score)
    patch = {}
    for c in MERGE_FIELDS:
        vals = [m[c] for m in members if not _empty(m[c])]
        if not vals:
            continue
        if c in MAX_FIELDS:
            # 双源冲突规则（AGENTS.md）：展商数/观众数/面积取较大值
            best = max(vals)
            if best != keep[c]:
                patch[c] = best
        elif _empty(keep[c]):
            patch[c] = vals[0]
        if len({str(v) for v in vals}) > 1:
            conflicts.append((keep["brand_id"], keep["year"], c,
                              sorted({str(v) for v in vals}), str(patch.get(c, keep[c]))))
    if apply:
        for m in members:
            if m["edition_id"] != keep["edition_id"]:
                conn.execute("DELETE FROM exhibition_edition WHERE edition_id = ?",
                             (m["edition_id"],))
        if patch:
            sets = ", ".join(f"{c} = ?" for c in patch)
            conn.execute(f"UPDATE exhibition_edition SET {sets} WHERE edition_id = ?",
                         (*patch.values(), keep["edition_id"]))
    return len(patch)


def rebuild_ids(conn: sqlite3.Connection, apply: bool) -> tuple[int, int]:
    """把 edition_id 重建为 brand_id-year。目标 id 已被占用的跳过。返回 (重建数, 跳过数)。"""
    rows = conn.execute(
        "SELECT edition_id, brand_id, year FROM exhibition_edition"
    ).fetchall()
    taken = {r["edition_id"] for r in rows}
    done = skipped = 0
    for r in rows:
        if not r["year"]:
            continue
        want = f"{r['brand_id']}-{r['year']}"
        if r["edition_id"] == want:
            continue
        if want in taken:
            skipped += 1
            continue
        if apply:
            conn.execute("UPDATE exhibition_edition SET edition_id = ? WHERE edition_id = ?",
                         (want, r["edition_id"]))
        taken.discard(r["edition_id"])
        taken.add(want)
        done += 1
    return done, skipped


def main() -> int:
    ap = argparse.ArgumentParser(description="合并重复届次 + 重建 edition_id")
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    print(f"{'APPLY' if args.apply else 'DRY-RUN'} | {args.db}\n")

    groups = group_duplicates(conn)
    print(f"重复组: A 完全重复 {len(groups['A'])} · "
          f"B 同场馆不同日期 {len(groups['B'])} · C 不同场馆 {len(groups['C'])}")

    merged_fields = 0
    removed = 0
    conflicts: list = []
    for members in groups["A"]:
        merged_fields += merge_group(conn, members, args.apply, conflicts)
        removed += len(members) - 1
    print(f"  A 类合并: 删除 {removed} 行，并入 {merged_fields} 个字段")
    if conflicts:
        print(f"\n  两行同字段值不同 {len(conflicts)} 处（已按规则取值，列出供核对）:")
        for bid, yr, col, vals, kept in conflicts:
            print(f"    {bid}-{yr} {col:<17} {vals} → {kept}")

    if groups["B"] or groups["C"]:
        print("\n需人工核对（本脚本不动）:")
        for cls in ("B", "C"):
            for members in groups[cls]:
                b = conn.execute("SELECT name_cn FROM exhibition_brand WHERE brand_id = ?",
                                 (members[0]["brand_id"],)).fetchone()
                name = b["name_cn"] if b else members[0]["brand_id"]
                print(f"  [{cls}] {name[:30]}")
                for m in members:
                    print(f"        {m['edition_id']}  {m['date_start']}~{m['date_end']}  "
                          f"{(m['venue'] or '')[:22]}  {m['data_source']}")

    done, skipped = rebuild_ids(conn, args.apply)
    print(f"\nedition_id 重建: {done} 条，跳过 {skipped} 条（目标 id 已被占用）")

    if args.apply:
        conn.commit()
        left = conn.execute(
            "SELECT COUNT(*) FROM exhibition_edition "
            "WHERE substr(edition_id, 1, length(brand_id)) != brand_id"
        ).fetchone()[0]
        print(f"复核: 仍有 {left} 条 edition_id 前缀不符")
    else:
        print("\n（dry-run，未写库；确认后加 --apply）")
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
