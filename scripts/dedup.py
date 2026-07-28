#!/usr/bin/env python3
"""
dedup.py — 品牌去重工具

默认 dry-run 模式：输出重复项报告，不修改数据库
--execute 模式：真实合并重复记录

检测层级（D0/L0/L1/L2/L3 来自 dry_run_dedup_v2.py，覆盖面最全）
执行逻辑来自 execute_dedup.py（D0/L1/L2 三级实际合并）
"""
from __future__ import annotations

import argparse
import difflib
import re
import sqlite3
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

DEFAULT_DB = Path(__file__).parent.parent / "data" / "mwlab.db"


# ── 标准化函数 ──────────────────────────────────────────────────────────────

def strip_years(text: str) -> str:
    return re.sub(r'^\s*20[2-9]\d\s*', '', text)


def strip_edition(text: str) -> str:
    return re.sub(r'^第\s*\d+\s*届\s*', '', text)


def strip_city_parens(text: str) -> str:
    return re.sub(r'[（(][^）)]*[市省][^）)]*[）)]', '', text)


def normalize_name(name: str) -> str:
    if not name:
        return ""
    name = strip_years(name)
    name = strip_edition(name)
    name = strip_city_parens(name)
    name = re.sub(r'\s+', '', name)
    name = re.sub(r'[（()）\-,、，·]', '', name)
    return name.strip()


def name_similarity(a: str, b: str) -> float:
    na = normalize_name(a)
    nb = normalize_name(b)
    if not na or not nb:
        return 0.0
    return difflib.SequenceMatcher(None, na, nb).ratio()


# ── 检测：找重复对（dry_run_dedup_v2 逻辑，5 层） ───────────────────────────

def find_duplicate_pairs(conn) -> dict[str, list]:
    """加载所有届次数据，按 D0/L0/L1/L2/L3 找重复对。"""
    brands = conn.execute("""
        SELECT b.brand_id, b.name_cn, b.name_en, b.organizer, b.city,
               b.industry_l1, b.industry_l2, b.first_year,
               e.edition_id, e.year, e.date_start, e.date_end,
               e.area_sqm, e.exhibitors_count, e.visitors_count
        FROM exhibition_brand b
        LEFT JOIN exhibition_edition e ON e.brand_id = b.brand_id
        ORDER BY b.organizer, b.city, b.name_cn
    """).fetchall()

    # 建立索引
    date_key_map = defaultdict(list)
    month_key_map = defaultdict(list)
    org_city_map = defaultdict(list)
    name_index = defaultdict(list)
    org_map = defaultdict(list)

    for b in brands:
        org = (b["organizer"] or "").strip()
        city = (b["city"] or "").strip()
        ds = b["date_start"]

        if org and org != "test" and city and ds:
            date_key_map[(org, city, ds)].append(b)
        if org and org != "test" and city and ds and len(ds) >= 7:
            month = int(ds[5:7])
            month_key_map[(org, city, month)].append(b)
        if org and org != "test" and city:
            org_city_map[(org, city)].append(b)
        if org and org != "test":
            org_map[org].append(b)

        nn = normalize_name(b["name_cn"])
        if len(nn) >= 4:
            name_index[nn].append(b)

    seen_pairs: set[tuple] = set()
    results: dict[str, list] = {"D0": [], "L0": [], "L1": [], "L2": [], "L3": []}

    def add(level, b1, b2, sim, reason):
        key = tuple(sorted([b1["brand_id"], b2["brand_id"]]))
        if key in seen_pairs:
            return
        seen_pairs.add(key)
        results[level].append({
            "brand_a": b1, "brand_b": b2,
            "similarity": round(sim, 3),
            "reason": reason,
        })

    # D0: (org, city, date_start) exact + sim >= 80%
    for (org, city, ds), group in date_key_map.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                sim = name_similarity(group[i]["name_cn"], group[j]["name_cn"])
                if sim >= 0.80:
                    add("D0", group[i], group[j], sim,
                        f"同日期({ds}) + 同主办({org}) + 同城市({city})")

    # L0: (org, city, month) + sim >= 85%
    for (org, city, month), group in month_key_map.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                sim = name_similarity(group[i]["name_cn"], group[j]["name_cn"])
                if sim >= 0.85:
                    add("L0", group[i], group[j], sim,
                        f"同{month}月 + 同主办({org}) + 同城市({city})")

    # L1: normalized name exact match
    for nn, group in name_index.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                add("L1", group[i], group[j], 1.0, f"标准化名完全一致: '{nn}'")

    # L2: (org, city) + sim >= 80% + same industry_l2
    for (org, city), group in org_city_map.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                b1, b2 = group[i], group[j]
                l2_1 = (b1["industry_l2"] or "").strip()
                l2_2 = (b2["industry_l2"] or "").strip()
                if l2_1 and l2_2 and l2_1 != l2_2:
                    continue
                sim = name_similarity(b1["name_cn"], b2["name_cn"])
                if sim >= 0.80:
                    add("L2", b1, b2, sim,
                        f"同主办({org})+同城市({city})+同L2({l2_1})")

    # L3: (org) + sim >= 75% + same industry_l1
    for org, group in org_map.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                b1, b2 = group[i], group[j]
                l1_1 = (b1["industry_l1"] or "").strip()
                l1_2 = (b2["industry_l1"] or "").strip()
                if l1_1 and l1_2 and l1_1 != l1_2:
                    continue
                sim = name_similarity(b1["name_cn"], b2["name_cn"])
                if sim >= 0.75:
                    add("L3", b1, b2, sim,
                        f"同主办({org})+同L1({l1_1})")

    return results


# ── 工具：Union-Find 聚类 ────────────────────────────────────────────────────

def cluster_pairs(cands: list) -> list[list]:
    """将重复对列表聚类为品牌组列表（每组 >= 2 个 brand_id）。"""
    parent: dict = {}

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    all_ids = set()
    for g in cands:
        all_ids.add(g["brand_a"]["brand_id"])
        all_ids.add(g["brand_b"]["brand_id"])
    for bid in all_ids:
        parent[bid] = bid
    for g in cands:
        union(g["brand_a"]["brand_id"], g["brand_b"]["brand_id"])

    clusters: dict = defaultdict(list)
    for bid in all_ids:
        clusters[find(bid)].append(bid)
    return list(clusters.values())


# ── Dry-run 报告 ─────────────────────────────────────────────────────────────

def run_dry(conn, results: dict):
    brand_by_id = {}
    for level_cands in results.values():
        for c in level_cands:
            for key in ("brand_a", "brand_b"):
                b = c[key]
                brand_by_id[b["brand_id"]] = b

    total_pairs = 0
    all_affected: set = set()

    for level in ["D0", "L0", "L1", "L2", "L3"]:
        cands = results[level]
        if not cands:
            continue
        groups = cluster_pairs(cands)
        affected = set()
        for g in groups:
            affected.update(g)

        print(f"\n{'='*70}")
        print(f"  {level}: {len(cands)} pairs → {len(groups)} groups → {len(affected)} brands")
        print(f"{'='*70}")

        total_pairs += len(cands)
        all_affected.update(affected)

        for i, g in enumerate(groups):
            if len(g) < 2:
                continue
            gbrands = [brand_by_id[bid] for bid in g if bid in brand_by_id]
            names = [b["name_cn"] for b in gbrands]
            sims = [c["similarity"] for c in cands
                    if c["brand_a"]["brand_id"] in g and c["brand_b"]["brand_id"] in g]
            max_sim = max(sims) if sims else 0
            reason = next((c["reason"] for c in cands
                           if c["brand_a"]["brand_id"] in g and c["brand_b"]["brand_id"] in g), "")
            print(f"\n  [{i+1}] sim={max_sim:.0%} | {reason}")
            for n in names[:6]:
                print(f"      • {n}")
            if len(names) > 6:
                print(f"      ... +{len(names)-6} more")

    # 汇总
    d0_g = sum(1 for g in cluster_pairs(results["D0"]) if len(g) >= 2)
    l0_g = sum(1 for g in cluster_pairs(results["L0"]) if len(g) >= 2)
    l1_g = sum(1 for g in cluster_pairs(results["L1"]) if len(g) >= 2)
    l2_g = sum(1 for g in cluster_pairs(results["L2"]) if len(g) >= 2)
    l3_g = sum(1 for g in cluster_pairs(results["L3"]) if len(g) >= 2)
    total_brands = conn.execute("SELECT COUNT(*) FROM exhibition_brand").fetchone()[0]

    print(f"\n{'='*70}")
    print(f"  SUMMARY (dry-run — 无数据库修改)")
    print(f"  D0  (同日期+同主办+同城市+sim>=80%):   {len(results['D0'])} pairs → {d0_g} groups")
    print(f"  L0  (同月份+同主办+同城市+sim>=85%):   {len(results['L0'])} pairs → {l0_g} groups")
    print(f"  L1  (标准化名完全一致):                  {len(results['L1'])} pairs → {l1_g} groups")
    print(f"  L2  (同主办+同城市+同L2+sim>=80%):     {len(results['L2'])} pairs → {l2_g} groups")
    print(f"  L3  (同主办+同L1+sim>=75%):             {len(results['L3'])} pairs → {l3_g} groups")
    print(f"  ─────────────────────────────────────")
    print(f"  Total brands in DB: {total_brands}")
    print(f"  Total affected brands: {len(all_affected)}")
    print(f"  Post-merge brands (rough): {total_brands - len(all_affected) + (d0_g+l0_g+l1_g+l2_g+l3_g)}")
    print(f"{'='*70}")
    print(f"\n  （如需真实执行，请加 --execute 参数）")


# ── Execute 合并 ─────────────────────────────────────────────────────────────

def run_execute(conn, db_path: Path):
    """真实执行合并，仅使用 D0/L1/L2 三级（精度最高）。"""
    NOW = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 加载最新届次数据（execute 模式只需最新届次做字段选取）
    brands = conn.execute("""
        SELECT b.*, e.year as latest_year, e.date_start, e.date_end,
               e.area_sqm, e.exhibitors_count, e.visitors_count, e.venue, e.status
        FROM exhibition_brand b
        LEFT JOIN exhibition_edition e ON e.brand_id = b.brand_id
            AND e.year = (SELECT MAX(year) FROM exhibition_edition WHERE brand_id = b.brand_id)
    """).fetchall()

    brand_by_id = {b["brand_id"]: dict(b) for b in brands}
    print(f"Loaded {len(brands)} brands")

    # 建立索引
    date_key: dict = defaultdict(list)
    org_city_key: dict = defaultdict(list)
    name_key: dict = defaultdict(list)

    for b in brands:
        org = (b["organizer"] or "").strip()
        city = (b["city"] or "").strip()
        ds = b["date_start"]
        if org and org != "test" and city:
            org_city_key[(org, city)].append(b)
            if ds:
                date_key[(org, city, ds)].append(b)
        nn = normalize_name(b["name_cn"])
        if len(nn) >= 4:
            name_key[nn].append(b)

    # Union-Find
    all_bids = [b["brand_id"] for b in brands]
    parent = {bid: bid for bid in all_bids}

    def find(x):
        if parent[x] != x:
            parent[x] = find(parent[x])
        return parent[x]

    def union(x, y):
        px, py = find(x), find(y)
        if px != py:
            parent[px] = py

    merge_log: list = []

    # D0: (org, city, date) + sim >= 0.80 + same industry_l2
    for (org, city, ds), group in date_key.items():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                b1, b2 = group[i], group[j]
                l2_1 = (b1["industry_l2"] or "").strip()
                l2_2 = (b2["industry_l2"] or "").strip()
                if l2_1 and l2_2 and l2_1 != l2_2:
                    continue
                sim = name_similarity(b1["name_cn"], b2["name_cn"])
                if sim >= 0.80:
                    union(b1["brand_id"], b2["brand_id"])
                    merge_log.append(("D0", b1["brand_id"], b2["brand_id"], sim,
                                      f"同日期({ds})+同主办({org})+同城市({city})+同L2"))

    # L1: normalized name exact match
    for nn, group in name_key.items():
        if len(group) < 2:
            continue
        first = group[0]
        for other in group[1:]:
            union(first["brand_id"], other["brand_id"])
            merge_log.append(("L1", first["brand_id"], other["brand_id"], 1.0,
                              f"标准化名完全一致: '{nn}'"))

    # L2: (org, city) + sim >= 0.80 + same industry_l2
    for (org, city), group in org_city_key.items():
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                b1, b2 = group[i], group[j]
                l2_1 = (b1["industry_l2"] or "").strip()
                l2_2 = (b2["industry_l2"] or "").strip()
                if l2_1 and l2_2 and l2_1 != l2_2:
                    continue
                sim = name_similarity(b1["name_cn"], b2["name_cn"])
                if sim >= 0.80:
                    union(b1["brand_id"], b2["brand_id"])
                    merge_log.append(("L2", b1["brand_id"], b2["brand_id"], sim,
                                      f"同主办({org})+同城市({city})+同L2({l2_1})"))

    # 收集合并组
    groups_map: dict = defaultdict(set)
    for bid in all_bids:
        groups_map[find(bid)].add(bid)
    merge_groups = [g for g in groups_map.values() if len(g) >= 2]
    print(f"\nFound {len(merge_groups)} merge groups")

    total_deleted = 0
    total_editions_migrated = 0
    total_provenance_migrated = 0
    report_lines: list[str] = []

    for g_idx, group in enumerate(sorted(merge_groups, key=lambda g: min(g))):
        group_list = sorted(group)
        canonical = group_list[0]
        to_delete = group_list[1:]

        gbrands = [brand_by_id[bid] for bid in group_list if bid in brand_by_id]
        names_str = " | ".join(b["name_cn"] for b in gbrands[:4])
        if len(gbrands) > 4:
            names_str += f" ... +{len(gbrands)-4}"

        reasons = {log[0] for log in merge_log if log[1] in group and log[2] in group}
        level_str = "+".join(sorted(reasons))
        print(f"\n  Group {g_idx+1} [{level_str}]: {canonical} ← {to_delete}")
        print(f"    {names_str}")

        # 字段合并：选最佳值
        all_names_cn = [b["name_cn"] for b in gbrands if b["name_cn"]]
        all_names_en = [b["name_en"] for b in gbrands if b["name_en"]]
        all_organizers = [b["organizer"] for b in gbrands if b["organizer"]]
        all_cities = [b["city"] for b in gbrands if b["city"]]
        all_websites = [b["website"] for b in gbrands if b["website"]]
        all_l1 = [b["industry_l1"] for b in gbrands if b["industry_l1"]]
        all_l2 = [b["industry_l2"] for b in gbrands if b["industry_l2"]]

        clean_names = sorted([(normalize_name(n), n) for n in all_names_cn], key=lambda x: len(x[1]))
        canonical_name = clean_names[0][1] if clean_names else all_names_cn[0]

        best_en = next((en for en in all_names_en if en and not re.search(r'[一-龥]', en)), "")

        best_org = Counter(all_organizers).most_common(1)[0][0] if all_organizers else ""
        best_city = Counter(all_cities).most_common(1)[0][0] if all_cities else ""

        all_first_years = [b["first_year"] for b in gbrands if b["first_year"]]
        first_year = min(all_first_years) if all_first_years else None

        is_ufi = max(b["is_ufi_certified"] or 0 for b in gbrands)

        edition_years: set = set()
        for bid in group_list:
            for r in conn.execute("SELECT year FROM exhibition_edition WHERE brand_id=?", (bid,)).fetchall():
                if r["year"]:
                    edition_years.add(r["year"])
        frequency = "年展" if len(edition_years) >= 2 else (gbrands[0].get("frequency") or "")

        best_l1 = Counter(all_l1).most_common(1)[0][0] if all_l1 else ""
        best_l2 = Counter(all_l2).most_common(1)[0][0] if all_l2 else ""
        best_website = all_websites[0] if all_websites else ""

        updates = {
            "name_cn": canonical_name,
            "name_en": best_en or (gbrands[0]["name_en"] or ""),
            "organizer": best_org,
            "city": best_city,
            "first_year": first_year,
            "is_ufi_certified": is_ufi,
            "frequency": frequency,
            "industry_l1": best_l1,
            "industry_l2": best_l2,
            "website": best_website,
            "updated_at": NOW,
        }
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE exhibition_brand SET {set_clause} WHERE brand_id = ?",
                     list(updates.values()) + [canonical])

        # 打标历史
        for bid in to_delete:
            old_name = (brand_by_id.get(bid) or {}).get("name_cn", "")
            # brand_id 必须记 canonical：manual_tag_history 是 ON DELETE CASCADE，
            # 若记被删品牌，这条合并痕迹会随该品牌一起被级联删除（审计自毁）。
            conn.execute("""
                INSERT INTO manual_tag_history (brand_id, field_name, old_value, new_value, changed_by, changed_at, reason)
                VALUES (?, 'merged_into', ?, ?, 'system/dedup', ?, 'auto-merge')
            """, (canonical, f"{bid}|{old_name}", canonical, NOW))

        # 迁移届次 & 溯源
        for bid in to_delete:
            # 届次：edition_id 是主键且含旧 brand_id 前缀，迁移后一并重写，
            # 避免留下 edition_id 前缀与 brand_id 不一致的行（历史上已积累 87 条）。
            # 目标品牌已有同年届次时，保留目标方，丢弃被合并方（数值以目标为准）。
            # 同年冲突：先把来源方的数值并入目标方（取较大值 / 补空缺，
            # 与 merge_engine 的双源规则一致），再丢弃来源行，避免信息丢失。
            conn.execute("""
                UPDATE exhibition_edition AS t SET
                    area_sqm         = MAX(COALESCE(t.area_sqm,0),         COALESCE(s.area_sqm,0)),
                    exhibitors_count = MAX(COALESCE(t.exhibitors_count,0), COALESCE(s.exhibitors_count,0)),
                    visitors_count   = MAX(COALESCE(t.visitors_count,0),   COALESCE(s.visitors_count,0)),
                    date_start  = COALESCE(NULLIF(t.date_start,''),  s.date_start),
                    date_end    = COALESCE(NULLIF(t.date_end,''),    s.date_end),
                    venue       = COALESCE(NULLIF(t.venue,''),       s.venue),
                    city        = COALESCE(NULLIF(t.city,''),        s.city)
                FROM (SELECT * FROM exhibition_edition WHERE brand_id = ?) AS s
                WHERE t.brand_id = ? AND t.year = s.year
            """, (bid, canonical))
            conn.execute(
                "DELETE FROM exhibition_edition WHERE brand_id = ? AND year IN "
                "(SELECT year FROM exhibition_edition WHERE brand_id = ?)",
                (bid, canonical)
            )
            for (old_eid, yr) in conn.execute(
                "SELECT edition_id, year FROM exhibition_edition WHERE brand_id = ?", (bid,)
            ).fetchall():
                new_eid = f"{canonical}-{yr}" if yr else old_eid.replace(bid, canonical, 1)
                # 被合并方自身可能存在同年多条（历史 edition_id 错位所致），
                # 或 new_eid 已被本轮先前迁入的行占用 —— 冲突时丢弃来源行。
                taken = conn.execute(
                    "SELECT 1 FROM exhibition_edition WHERE edition_id = ?", (new_eid,)
                ).fetchone()
                if taken:
                    conn.execute("DELETE FROM exhibition_edition WHERE edition_id = ?", (old_eid,))
                    continue
                conn.execute(
                    "UPDATE exhibition_edition SET brand_id = ?, edition_id = ? WHERE edition_id = ?",
                    (canonical, new_eid, old_eid)
                )
                total_editions_migrated += 1

            # 溯源：007 迁移建了 UNIQUE(brand_id, source_url)，
            # 若目标品牌已有同一 source_url，直接 UPDATE 会撞唯一约束，先删冗余再迁移。
            conn.execute(
                "DELETE FROM data_provenance WHERE brand_id = ? AND source_url IN "
                "(SELECT source_url FROM data_provenance WHERE brand_id = ?)",
                (bid, canonical)
            )
            total_provenance_migrated += conn.execute(
                "UPDATE data_provenance SET brand_id = ? WHERE brand_id = ?", (canonical, bid)
            ).rowcount

            # 其余引用 brand_id 的表也必须处理，否则 DELETE 撞外键：
            #   brand_geo_tag  派生数据，canonical 已有自己的，直接丢弃
            #   业务数据表      迁移到 canonical（这些表 ON DELETE 是 SET NULL/NO ACTION，
            #                  不处理会静默丢失归属或直接报错）
            conn.execute("DELETE FROM brand_geo_tag WHERE brand_id = ?", (bid,))
            for tbl, col in (("customer_prospect", "brand_id"),
                             ("intel_report", "brand_id"),
                             ("exhibition_contact", "brand_id"),
                             ("exhibition_timeline", "brand_id"),
                             ("exhibition_relation", "from_brand_id"),
                             ("exhibition_relation", "to_brand_id")):
                conn.execute(f"UPDATE {tbl} SET {col} = ? WHERE {col} = ?", (canonical, bid))

            conn.execute("DELETE FROM exhibition_brand WHERE brand_id = ?", (bid,))
            total_deleted += 1

        report_lines.append(f"  [{level_str}] {canonical}: {' ← '.join(str(x) for x in to_delete)}")
        report_lines.append(f"         {canonical_name}")

    conn.commit()

    remaining = conn.execute("SELECT COUNT(*) FROM exhibition_brand").fetchone()[0]
    editions_now = conn.execute("SELECT COUNT(*) FROM exhibition_edition").fetchone()[0]
    multi_edition = conn.execute("""
        SELECT COUNT(*) FROM (
            SELECT brand_id FROM exhibition_edition GROUP BY brand_id HAVING COUNT(*) > 1
        )
    """).fetchone()[0]
    max_eds = conn.execute("""
        SELECT MAX(cnt) FROM (SELECT COUNT(*) as cnt FROM exhibition_edition GROUP BY brand_id)
    """).fetchone()[0]

    print(f"\n{'='*60}")
    print(f"  执行完成")
    print(f"  合并组数: {len(merge_groups)}")
    print(f"  删除品牌: {total_deleted}")
    print(f"  迁移届次: {total_editions_migrated}")
    print(f"  迁移溯源: {total_provenance_migrated}")
    print(f"  剩余品牌: {remaining}")
    print(f"  剩余届次: {editions_now}")
    print(f"  多届次品牌: {multi_edition}")
    print(f"  最大届次/品牌: {max_eds}")
    print(f"{'='*60}")

    # 日志固定落脚本所在目录；此前按 db_path.parent 推导，
    # 用 --db 指向仓库外（如临时副本）时会因目录不存在而崩在收尾步骤。
    log_path = Path(__file__).resolve().parent / "dedup_audit.log"
    with open(log_path, "w") as f:
        f.write(f"# Dedup Audit Log — {NOW}\n")
        f.write(f"# Groups: {len(merge_groups)}, Deleted: {total_deleted}\n\n")
        for line in report_lines:
            f.write(line + "\n")
    print(f"\n审计日志: {log_path}")


# ── 入口 ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='品牌去重工具')
    parser.add_argument('--execute', action='store_true',
                        help='真实执行去重（默认为 dry-run 模式）')
    parser.add_argument('--db', default=str(DEFAULT_DB),
                        help=f'数据库路径（默认：{DEFAULT_DB}）')
    args = parser.parse_args()

    db_path = Path(args.db)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    if args.execute:
        conn.execute("PRAGMA foreign_keys = ON")
        conn.execute("PRAGMA journal_mode = WAL")
        run_execute(conn, db_path)
    else:
        results = find_duplicate_pairs(conn)
        run_dry(conn, results)

    conn.close()


if __name__ == "__main__":
    main()
