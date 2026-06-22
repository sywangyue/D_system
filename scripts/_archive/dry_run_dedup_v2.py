#!/usr/bin/env python3
"""
dry_run_dedup_v2.py — 品牌去重 dry-run v2
加入了 date_start 精确匹配维度
"""
from __future__ import annotations

import difflib
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

DB_PATH = Path("/Volumes/databoard/AI Project/D_dashboard/mwlab.db")

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

def load_data(conn):
    """加载品牌 + 届次（所有届次，不仅最新）"""
    brands = conn.execute("""
        SELECT b.brand_id, b.name_cn, b.name_en, b.organizer, b.city,
               b.industry_l1, b.industry_l2, b.first_year,
               e.edition_id, e.year, e.date_start, e.date_end,
               e.area_sqm, e.exhibitors_count, e.visitors_count
        FROM exhibition_brand b
        LEFT JOIN exhibition_edition e ON e.brand_id = b.brand_id
        ORDER BY b.organizer, b.city, b.name_cn
    """).fetchall()
    return brands

def main():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    brands = load_data(conn)
    
    # 建立索引
    brand_by_id = {b["brand_id"]: b for b in brands}
    
    # ── NEW: (organizer, city, date_start) 三键索引 ──
    date_key_map = defaultdict(list)
    for b in brands:
        org = (b["organizer"] or "").strip()
        city = (b["city"] or "").strip()
        ds = b["date_start"]
        if org and org != "test" and city and ds:
            date_key_map[(org, city, ds)].append(b)
    
    # ── (organizer, city, month) 索引 (for L0) ──
    month_key_map = defaultdict(list)
    for b in brands:
        org = (b["organizer"] or "").strip()
        city = (b["city"] or "").strip()
        ds = b["date_start"]
        if org and org != "test" and city and ds and len(ds) >= 7:
            month = int(ds[5:7])
            month_key_map[(org, city, month)].append(b)
    
    # ── (organizer, city) 索引 ──
    org_city_map = defaultdict(list)
    for b in brands:
        org = (b["organizer"] or "").strip()
        city = (b["city"] or "").strip()
        if org and org != "test" and city:
            org_city_map[(org, city)].append(b)
    
    seen_pairs = set()
    
    results = {
        "D0": [],  # (org, city, date) exact + sim >= 80%
        "L0": [],  # (org, city, month) + sim >= 85%
        "L1": [],  # normalized name exact match
        "L2": [],  # (org, city) + sim >= 80% + same industry_l2
        "L3": [],  # (org) + sim >= 75% + same industry_l1
    }
    
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
    
    # ═══ D0: (org, city, date_start) strict + sim >= 80% ═══
    for key, group in date_key_map.items():
        org, city, ds = key
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i+1, len(group)):
                sim = name_similarity(group[i]["name_cn"], group[j]["name_cn"])
                if sim >= 0.80:
                    add("D0", group[i], group[j], sim,
                        f"同日期({ds}) + 同主办({org}) + 同城市({city})")
    
    # ═══ L0: (org, city, month) + sim >= 85% ═══
    for key, group in month_key_map.items():
        org, city, month = key
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i+1, len(group)):
                sim = name_similarity(group[i]["name_cn"], group[j]["name_cn"])
                if sim >= 0.85:
                    add("L0", group[i], group[j], sim,
                        f"同{month}月 + 同主办({org}) + 同城市({city})")
    
    # ═══ L1: normalized name exact match ═══
    name_index = defaultdict(list)
    for b in brands:
        nn = normalize_name(b["name_cn"])
        if len(nn) >= 4:
            name_index[nn].append(b)
    for nn, group in name_index.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i+1, len(group)):
                add("L1", group[i], group[j], 1.0,
                    f"标准化名完全一致: '{nn}'")
    
    # ═══ L2: (org, city) + sim >= 80% + SAME industry_l2 ═══
    for key, group in org_city_map.items():
        org, city = key
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i+1, len(group)):
                b1, b2 = group[i], group[j]
                # 同 industry_l2 约束
                l2_1 = (b1["industry_l2"] or "").strip()
                l2_2 = (b2["industry_l2"] or "").strip()
                if l2_1 and l2_2 and l2_1 != l2_2:
                    continue
                sim = name_similarity(b1["name_cn"], b2["name_cn"])
                if sim >= 0.80:
                    add("L2", b1, b2, sim,
                        f"同主办({org})+同城市({city})+同L2({l2_1})")
    
    # ═══ L3: (org) + sim >= 75% + SAME industry_l1 ═══
    org_map = defaultdict(list)
    for b in brands:
        org = (b["organizer"] or "").strip()
        if org and org != "test":
            org_map[org].append(b)
    for org, group in org_map.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i+1, len(group)):
                b1, b2 = group[i], group[j]
                l1_1 = (b1["industry_l1"] or "").strip()
                l1_2 = (b2["industry_l1"] or "").strip()
                if l1_1 and l1_2 and l1_1 != l1_2:
                    continue
                sim = name_similarity(b1["name_cn"], b2["name_cn"])
                if sim >= 0.75:
                    add("L3", b1, b2, sim,
                        f"同主办({org})+同L1({l1_1})")
    
    # ═══ 输出报告 ═══
    def cluster(groups_list):
        parent = {}
        def find(x):
            if parent[x] != x:
                parent[x] = find(parent[x])
            return parent[x]
        def union(x, y):
            px, py = find(x), find(y)
            if px != py:
                parent[px] = py
        
        all_ids = set()
        for g in groups_list:
            all_ids.add(g["brand_a"]["brand_id"])
            all_ids.add(g["brand_b"]["brand_id"])
        for bid in all_ids:
            parent[bid] = bid
        for g in groups_list:
            union(g["brand_a"]["brand_id"], g["brand_b"]["brand_id"])
        
        clusters = defaultdict(list)
        for bid in all_ids:
            clusters[find(bid)].append(bid)
        return list(clusters.values())
    
    total_pairs = 0
    all_affected = set()
    
    for level in ["D0", "L0", "L1", "L2", "L3"]:
        cands = results[level]
        if not cands:
            continue
        groups = cluster(cands)
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
                bid = [b["brand_id"] for b in gbrands if b["name_cn"] == n]
                print(f"      • {n}")
            if len(names) > 6:
                print(f"      ... +{len(names)-6} more")
    
    # 合并数量预估
    d0_groups = sum(1 for g in cluster(results["D0"]) if len(g)>=2)
    l0_groups = sum(1 for g in cluster(results["L0"]) if len(g)>=2)
    l1_groups = sum(1 for g in cluster(results["L1"]) if len(g)>=2)
    l2_groups = sum(1 for g in cluster(results["L2"]) if len(g)>=2)
    l3_groups = sum(1 for g in cluster(results["L3"]) if len(g)>=2)
    total_groups = d0_groups + l0_groups + l1_groups + l2_groups + l3_groups
    
    print(f"\n{'='*70}")
    print(f"  SUMMARY")
    print(f"  D0  (同日期+同主办+同城市+sim>=80%):   {len(results['D0'])} pairs → {d0_groups} groups")
    print(f"  L0  (同月份+同主办+同城市+sim>=85%):   {len(results['L0'])} pairs → {l0_groups} groups")
    print(f"  L1  (标准化名完全一致):                  {len(results['L1'])} pairs → {l1_groups} groups")
    print(f"  L2  (同主办+同城市+同L2+sim>=80%):     {len(results['L2'])} pairs → {l2_groups} groups")
    print(f"  L3  (同主办+同L1+sim>=75%):             {len(results['L3'])} pairs → {l3_groups} groups")
    print(f"  ─────────────────────────────────────")
    print(f"  Total affected brands: {len(all_affected)}")
    print(f"  Post-merge brands (rough): {len(brands) - len(all_affected) + total_groups}")
    print(f"{'='*70}")
    
    conn.close()

if __name__ == "__main__":
    main()
