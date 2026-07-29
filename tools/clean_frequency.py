#!/usr/bin/env python3
"""
clean_frequency.py — 一次性清洗：把「举办周期」字段里混进去的面积/展商/观众剥出来

背景（2026-07-29 打标导出时发现）：
    crawlers/cnexpo_crawler.py 的 `举办周期[：:]\\s*([^\\s]+)` 是贪婪匹配，
    而详情页里「举办周期」后面紧跟「会展面积…展商数量…观众数量…」且无空白，
    于是四项被一并吞进 raw_cnexpo.cycle，merge_engine:257 再原样拷进
    exhibition_brand.frequency —— 全库 1,979/7,179 个品牌的 frequency 长成
    「1年1届会展面积：30,000平方米展商数量：500家观众数量：20,000人」。

    正则已修（只取周期本身），本脚本清洗存量。

    绝大多数受污染行的数字**已经**单独存在 area_str/exhibitors_str/visitors_str
    里（2,133/2,136），所以剥离基本无损；少数没有的，先把数字回填到专属列再剥。

用法:
    python3 tools/clean_frequency.py                # dry-run（默认）
    python3 tools/clean_frequency.py --apply
"""
from __future__ import annotations

import argparse
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
TAIL = re.compile(r"(会展面积|展览面积|展商数量|观众数量).*$")
# 源站数字写法很杂：半角逗号 / 全角逗号 / 句点作千分位、连写的 8，，000、
# 「300+家」带加号、以及截断到「展商数量：568」没有单位后缀的。单位一律可选。
_NUM = r"[\d,，.+]+"
FIELDS = (("会展面积", "area_str", "面积:", _NUM + r"(?:平方米)?"),
          ("展商数量", "exhibitors_str", "展商:", _NUM + r"家?"),
          ("观众数量", "visitors_str", "观众:", _NUM + r"人?"))


def clean_raw(db: Path, apply: bool) -> dict:
    """raw_cnexpo.cycle：先把数字回填到专属列，再剥掉尾巴。"""
    conn = sqlite3.connect(str(db))
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT id, cycle, area_str, exhibitors_str, visitors_str FROM raw_cnexpo "
        "WHERE cycle LIKE '%面积%' OR cycle LIKE '%展商%' OR cycle LIKE '%观众%'"
    ).fetchall()
    stripped = recovered = 0
    for r in rows:
        patch = {}
        for label, col, prefix, num in FIELDS:
            if r[col]:
                continue
            m = re.search(label + r"[：:]\s*(" + num + ")", r["cycle"])
            if m:
                patch[col] = prefix + m.group(1)
                recovered += 1
        patch["cycle"] = TAIL.sub("", r["cycle"]).strip()
        stripped += 1
        if apply:
            sets = ", ".join(f"{c} = ?" for c in patch)
            conn.execute(f"UPDATE raw_cnexpo SET {sets} WHERE id = ?",
                         (*patch.values(), r["id"]))
    if apply:
        conn.commit()
    conn.close()
    return {"table": "raw_cnexpo.cycle", "rows": stripped, "recovered": recovered}


def clean_main(db: Path, apply: bool) -> dict:
    """exhibition_brand.frequency：数字在届次表里已有，直接剥尾巴。"""
    conn = sqlite3.connect(str(db))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT brand_id, frequency FROM exhibition_brand "
        "WHERE frequency LIKE '%面积%' OR frequency LIKE '%展商%' OR frequency LIKE '%观众%'"
    ).fetchall()
    n = 0
    for r in rows:
        cleaned = TAIL.sub("", r["frequency"]).strip()
        if cleaned != r["frequency"]:
            n += 1
            if apply:
                conn.execute("UPDATE exhibition_brand SET frequency = ? WHERE brand_id = ?",
                             (cleaned, r["brand_id"]))
    if apply:
        conn.commit()
    vals = sorted({TAIL.sub("", r["frequency"]).strip() for r in rows})
    conn.close()
    return {"table": "exhibition_brand.frequency", "rows": n, "recovered": 0, "values": vals}


def main() -> int:
    ap = argparse.ArgumentParser(description="清洗 frequency / cycle 里混入的统计数字")
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    args = ap.parse_args()

    print(f"{'APPLY' if args.apply else 'DRY-RUN'}\n")
    for res in (clean_raw(ROOT / "data" / "cnexpo_2026.db", args.apply),
                clean_main(ROOT / "data" / "mwlab.db", args.apply)):
        print(f"  {res['table']:<32} 清洗 {res['rows']:>5} 行"
              + (f"，回填专属列 {res['recovered']} 处" if res["recovered"] else ""))
        if res.get("values"):
            print(f"    清洗后取值: {'、'.join(res['values'])}")
    if not args.apply:
        print("\n  （dry-run，未写库；确认后加 --apply）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
