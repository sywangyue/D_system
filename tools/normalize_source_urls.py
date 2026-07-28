#!/usr/bin/env python3
"""
normalize_source_urls.py — 一次性回填：把存量 source_url 归一化并合并重复

背景（AUDIT 追加发现）：
    jufair 2026-07 改版后 /exhibition/{id}.html 与 /exhibition/{id}/ 并存，
    cnexpo 同时存在 /event/{id}.html 与 /event/{id}。
    raw_jufair.source_url / raw_cnexpo.source_url 是 UNIQUE 键，
    data_provenance 有 UNIQUE(brand_id, source_url) —— 两种写法各占一行，
    同一展会被收录两次。

本脚本把三张表的 source_url 统一为 tools/url_utils.canonical_source_url 的形式。
归一后产生的冲突按「保留信息更全的一行」合并，不是简单丢弃：
    raw_*            : 优先保留 detail_crawled=1、非空字段更多的那行
    data_provenance  : 优先保留 raw_payload 更长的那行

用法:
    python3 tools/normalize_source_urls.py                     # dry-run（默认）
    python3 tools/normalize_source_urls.py --apply
    python3 tools/normalize_source_urls.py --apply --db-only mwlab
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
from tools.url_utils import canonical_source_url

DATA = _REPO_ROOT / "data"


def _score_raw(row: sqlite3.Row, cols: list[str]) -> tuple:
    """信息完整度评分：详情已抓优先，其次非空字段数，最后 id 小者优先（更早收录）。"""
    detail = row["detail_crawled"] if "detail_crawled" in cols else 0
    filled = sum(1 for c in cols if c not in ("id",) and (row[c] not in (None, "", 0)))
    return (detail or 0, filled, -(row["id"] or 0))


def normalize_raw_table(conn: sqlite3.Connection, table: str, apply: bool) -> dict:
    cols = [r[1] for r in conn.execute(f"PRAGMA table_info({table})")]
    conn.row_factory = sqlite3.Row
    rows = conn.execute(f"SELECT * FROM {table}").fetchall()

    groups: dict[str, list[sqlite3.Row]] = defaultdict(list)
    for r in rows:
        groups[canonical_source_url(r["source_url"])].append(r)

    changed = sum(1 for r in rows if r["source_url"] != canonical_source_url(r["source_url"]))
    dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
    to_delete = sum(len(v) - 1 for v in dup_groups.values())

    if apply:
        for canon, members in groups.items():
            if not canon:
                continue
            keep = max(members, key=lambda r: _score_raw(r, cols))
            for m in members:
                if m["id"] != keep["id"]:
                    conn.execute(f"DELETE FROM {table} WHERE id = ?", (m["id"],))
            if keep["source_url"] != canon:
                conn.execute(
                    f"UPDATE {table} SET source_url = ? WHERE id = ?", (canon, keep["id"])
                )
        conn.commit()

    return {"table": table, "rows": len(rows), "url_rewritten": changed,
            "dup_groups": len(dup_groups), "rows_removed": to_delete}


def normalize_provenance(conn: sqlite3.Connection, apply: bool) -> dict:
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT rowid, record_id, brand_id, source_url, LENGTH(raw_payload) AS plen "
        "FROM data_provenance"
    ).fetchall()

    groups: dict[tuple, list[sqlite3.Row]] = defaultdict(list)
    for r in rows:
        groups[(r["brand_id"], canonical_source_url(r["source_url"]))].append(r)

    changed = sum(1 for r in rows if r["source_url"] != canonical_source_url(r["source_url"]))
    dup_groups = {k: v for k, v in groups.items() if len(v) > 1}
    to_delete = sum(len(v) - 1 for v in dup_groups.values())

    if apply:
        for (bid, canon), members in groups.items():
            if not canon:
                continue
            keep = max(members, key=lambda r: ((r["plen"] or 0), -(r["rowid"])))
            for m in members:
                if m["rowid"] != keep["rowid"]:
                    conn.execute("DELETE FROM data_provenance WHERE rowid = ?", (m["rowid"],))
            if keep["source_url"] != canon:
                conn.execute(
                    "UPDATE data_provenance SET source_url = ? WHERE rowid = ?",
                    (canon, keep["rowid"]),
                )
        conn.commit()

    return {"table": "data_provenance", "rows": len(rows), "url_rewritten": changed,
            "dup_groups": len(dup_groups), "rows_removed": to_delete}


def main() -> int:
    ap = argparse.ArgumentParser(description="source_url 归一化 + 重复合并")
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    ap.add_argument("--data-dir", default=str(DATA), help="数据目录（默认 data/）")
    ap.add_argument("--db-only", choices=["jufair", "cnexpo", "mwlab"], default=None,
                    help="只处理其中一个库")
    args = ap.parse_args()

    data = Path(args.data_dir)
    targets = [
        ("jufair", data / "jufair_2026.db", "raw_jufair"),
        ("cnexpo", data / "cnexpo_2026.db", "raw_cnexpo"),
        ("mwlab",  data / "mwlab.db",       None),
    ]
    if args.db_only:
        targets = [t for t in targets if t[0] == args.db_only]

    print(f"{'APPLY' if args.apply else 'DRY-RUN'} | 数据目录: {data}\n")
    results = []
    for name, path, raw_table in targets:
        if not path.is_file():
            print(f"  [跳过] {path} 不存在")
            continue
        conn = sqlite3.connect(str(path))
        try:
            if raw_table:
                results.append(normalize_raw_table(conn, raw_table, args.apply))
            else:
                results.append(normalize_provenance(conn, args.apply))
        finally:
            conn.close()

    print(f"  {'表':<18}{'总行':>8}{'URL改写':>10}{'重复组':>8}{'将删行':>8}")
    print("  " + "-" * 52)
    for r in results:
        print(f"  {r['table']:<18}{r['rows']:>8}{r['url_rewritten']:>10}"
              f"{r['dup_groups']:>8}{r['rows_removed']:>8}")
    if not args.apply:
        print("\n  （dry-run，未写库；确认后加 --apply）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
