#!/usr/bin/env python3
"""
export_dedup_review.py — 导出品牌去重人工复核表（CSV）

只读脚本，不修改数据库。产出一张给人做选择题的 CSV：
每行一个待判定的品牌对，人工在「决定」列填 Y（合并）/ N（不合并）。

判据分三层（实测数据见 docs 计划）：
  A1 名称归一化后逐字相同        —— 零误伤，「决定」列预填 Y
  A2 名称相似度 ≥0.80            —— 含假阳性，需人判
  B  同主办+同城市+同场馆+name_en 完全相同
  C  同主办+同城市+同场馆+档期完全相同   —— 假阳性最多（同期平行展），需逐条看

按「对」而非「簇」导出：簇内混层会让 union-find 把不相关展会串成一片，
逐对判定可避免错误传播。回收后再对判 Y 的对做聚类合并。

用法:
  python3 tools/export_dedup_review.py
  python3 tools/export_dedup_review.py --layer C -o /tmp/c.csv
"""
from __future__ import annotations

import argparse
import csv
import difflib
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_REPO_ROOT / "scripts"))
from dedup import normalize_name  # noqa: E402

DEFAULT_DB = _REPO_ROOT / "data" / "mwlab.db"
DEFAULT_OUT = _REPO_ROOT / "exports" / "dedup_review.csv"

NAME_SIM_THRESHOLD = 0.80


def norm_en(s: str | None) -> str:
    return "".join((s or "").lower().split())


def load_brands(conn: sqlite3.Connection) -> list[dict]:
    """每个品牌取一条代表届次（最新 date_start），避免多届次把同一对刷成多行。"""
    conn.row_factory = sqlite3.Row
    rows = conn.execute("""
        SELECT b.brand_id, b.name_cn, b.name_en, b.organizer, b.city,
               b.industry_l1, b.industry_l2,
               e.venue, e.date_start, e.date_end,
               (SELECT COUNT(*) FROM exhibition_edition x WHERE x.brand_id = b.brand_id)
                   AS edition_cnt
        FROM exhibition_brand b
        LEFT JOIN exhibition_edition e ON e.brand_id = b.brand_id
        ORDER BY b.brand_id, e.date_start DESC
    """).fetchall()
    picked: dict[str, dict] = {}
    for r in rows:
        if r["brand_id"] not in picked:
            picked[r["brand_id"]] = dict(r)
    return list(picked.values())


def find_candidates(brands: list[dict]) -> list[dict]:
    """在 (主办, 城市) 分组内两两比对，返回带层级标记的候选对。"""
    groups: dict[tuple, list] = defaultdict(list)
    for b in brands:
        org = (b["organizer"] or "").strip()
        city = (b["city"] or "").strip()
        if org and org != "test" and city:
            groups[(org, city)].append(b)

    seen: set[tuple] = set()
    out: list[dict] = []
    for (org, city), grp in groups.items():
        for i in range(len(grp)):
            for j in range(i + 1, len(grp)):
                a, b = grp[i], grp[j]
                key = tuple(sorted([a["brand_id"], b["brand_id"]]))
                if key in seen:
                    continue

                na, nb = normalize_name(a["name_cn"]), normalize_name(b["name_cn"])
                sim = difflib.SequenceMatcher(None, na, nb).ratio() if na and nb else 0.0

                venue_a = (a["venue"] or "").strip()
                venue_b = (b["venue"] or "").strip()
                same_venue = bool(venue_a) and venue_a == venue_b

                if na and na == nb:
                    # 唯一零误伤的一层：剥掉届次/年份后名称逐字相同
                    layer, why = "A1", "名称归一化后完全相同"
                elif sim >= NAME_SIM_THRESHOLD:
                    # 0.80~0.99 区间含真假阳性（"郑州机器人展"×"郑州机床展"=0.84），必须人判
                    layer, why = "A2", f"名称相似度 {sim:.2f}"
                elif same_venue and norm_en(a["name_en"]) and norm_en(a["name_en"]) == norm_en(b["name_en"]):
                    layer, why = "B", f"同场馆 + name_en 相同({a['name_en']})"
                elif (same_venue and a["date_start"]
                      and a["date_start"] == b["date_start"] and a["date_end"] == b["date_end"]):
                    layer, why = "C", "同场馆 + 档期完全相同"
                else:
                    continue

                seen.add(key)
                # 届次多的留作主品牌，届次相同则留 ID 小的（老批次）
                if (b["edition_cnt"], a["brand_id"]) > (a["edition_cnt"], b["brand_id"]):
                    a, b = b, a
                out.append({"layer": layer, "why": why, "sim": sim, "keep": a, "merge": b,
                            "org": org, "city": city})

    order = {"A1": 0, "A2": 1, "B": 2, "C": 3}
    out.sort(key=lambda d: (order[d["layer"]], -d["sim"]))
    return out


def fmt_period(b: dict) -> str:
    if not b["date_start"]:
        return ""
    return f"{b['date_start']}~{b['date_end'] or ''}"


def write_csv(cands: list[dict], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow([
            "决定(Y=合并/N=保留两条)", "层", "判据", "相似度",
            "保留-ID", "保留-名称", "保留-英文名", "保留-场馆", "保留-档期", "保留-届次数",
            "并入-ID", "并入-名称", "并入-英文名", "并入-场馆", "并入-档期", "并入-届次数",
            "主办方", "城市",
        ])
        for c in cands:
            k, m = c["keep"], c["merge"]
            w.writerow([
                "Y" if c["layer"] == "A1" else "",  # 仅零误伤层预填，其余一律留空待判
                c["layer"], c["why"], f"{c['sim']:.2f}",
                k["brand_id"], k["name_cn"], k["name_en"] or "", k["venue"] or "",
                fmt_period(k), k["edition_cnt"],
                m["brand_id"], m["name_cn"], m["name_en"] or "", m["venue"] or "",
                fmt_period(m), m["edition_cnt"],
                c["org"], c["city"],
            ])


def main() -> None:
    ap = argparse.ArgumentParser(description="导出品牌去重人工复核 CSV")
    ap.add_argument("--db", default=str(DEFAULT_DB))
    ap.add_argument("-o", "--out", default=str(DEFAULT_OUT))
    ap.add_argument("--layer", choices=["A1", "A2", "B", "C"], help="只导出指定层")
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    cands = find_candidates(load_brands(conn))
    conn.close()

    if args.layer:
        cands = [c for c in cands if c["layer"] == args.layer]

    out = Path(args.out)
    write_csv(cands, out)

    stat = defaultdict(int)
    for c in cands:
        stat[c["layer"]] += 1
    print(f"导出 {len(cands)} 对 -> {out}")
    for layer in ("A1", "A2", "B", "C"):
        if stat[layer]:
            note = "（已预填 Y，零误伤）" if layer == "A1" else ""
            print(f"  {layer} 层: {stat[layer]:>5} 对 {note}")


if __name__ == "__main__":
    main()
