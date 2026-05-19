#!/usr/bin/env python3
"""
dry_run_dedup.py — 品牌去重 dry-run 分析
只读不写，输出 L0-L4 候选合并组报告
"""
from __future__ import annotations

import difflib
import re
import sqlite3
from collections import defaultdict
from pathlib import Path

DB_PATH = Path("/Volumes/databoard/AI Project/D_dashboard/mwlab.db")

# ─── 名称标准化 ───────────────────────────────────────────────────

def strip_years(text: str) -> str:
    """去除年份前缀"""
    return re.sub(r'^\s*20[2-9]\d\s*', '', text)

def strip_edition(text: str) -> str:
    """去除届次前缀"""
    return re.sub(r'^第\s*\d+\s*届\s*', '', text)

def strip_city_parens(text: str) -> str:
    """去除城市括号 如（上海）（北京）"""
    return re.sub(r'[（(][^）)]*[市省][^）)]*[）)]', '', text)

def normalize_name(name: str) -> str:
    """标准化品牌名：去年份、去届次、去城市括号、去空格、去冗余符号"""
    if not name:
        return ""
    name = strip_years(name)
    name = strip_edition(name)
    name = strip_city_parens(name)
    name = re.sub(r'\s+', '', name)
    name = re.sub(r'[（()）\-,、，·]', '', name)
    return name.strip()

def extract_edition_num(name: str) -> int | None:
    """从名称中提取届次号"""
    m = re.search(r'第\s*(\d+)\s*届', name)
    if m:
        return int(m.group(1))
    return None

# ─── 数据加载 ─────────────────────────────────────────────────────

def load_data(conn):
    """加载所有品牌 + 届次数据"""
    brands = conn.execute("""
        SELECT b.brand_id, b.name_cn, b.name_en, b.organizer, b.city,
               b.industry_l1, b.industry_l2, b.first_year,
               e.edition_id, e.year, e.date_start, e.date_end,
               e.area_sqm, e.exhibitors_count, e.visitors_count
        FROM exhibition_brand b
        LEFT JOIN exhibition_edition e ON e.brand_id = b.brand_id
            AND e.year = (SELECT MAX(year) FROM exhibition_edition WHERE brand_id = b.brand_id)
        ORDER BY b.organizer, b.city, b.name_cn
    """).fetchall()
    return brands

# ─── 名称相似度 ───────────────────────────────────────────────────

def name_similarity(a: str, b: str) -> float:
    """计算标准化名称之间的相似度"""
    na = normalize_name(a)
    nb = normalize_name(b)
    if not na or not nb:
        return 0.0
    return difflib.SequenceMatcher(None, na, nb).ratio()

# ─── 匹配引擎 ─────────────────────────────────────────────────────

def find_candidates(brands):
    """在品牌列表中找出所有匹配候选组"""
    # 建立索引
    org_city_map = defaultdict(list)  # (organizer, city) -> [brands]
    org_month_map = defaultdict(list)  # (organizer, city, month) -> [brands]
    
    for b in brands:
        org = (b["organizer"] or "").strip()
        city = (b["city"] or "").strip()
        if org and org != "test" and city:
            org_city_map[(org, city)].append(b)
            # 提取月份
            ds = b["date_start"]
            if ds and len(ds) >= 7:
                month = int(ds[5:7])
                org_month_map[(org, city, month)].append(b)
    
    results = {"L0": [], "L1": [], "L2": [], "L3": [], "L4": []}
    seen_pairs = set()  # 去重
    
    def add_candidate(level, b1, b2, similarity, reason=""):
        pair_key = tuple(sorted([b1["brand_id"], b2["brand_id"]]))
        if pair_key in seen_pairs:
            return
        seen_pairs.add(pair_key)
        results[level].append({
            "brand_a": b1, "brand_b": b2,
            "similarity": round(similarity, 3),
            "reason": reason,
            "name_a_norm": normalize_name(b1["name_cn"]),
            "name_b_norm": normalize_name(b2["name_cn"]),
        })
    
    all_brands = [b for b in brands if (b["organizer"] or "").strip() and (b["organizer"] or "").strip() != "test"]
    
    # ── L0: (org, city, month) + similarity >= 0.85 ──
    for key, group in org_month_map.items():
        org, city, month = key
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                sim = name_similarity(group[i]["name_cn"], group[j]["name_cn"])
                if sim >= 0.85:
                    add_candidate("L0", group[i], group[j], sim,
                                  f"同主办+同城市+同{month}月")
    
    # ── L1: 标准化名完全一致 ──
    name_index = defaultdict(list)
    for b in all_brands:
        nn = normalize_name(b["name_cn"])
        if len(nn) >= 4:
            name_index[nn].append(b)
    
    for nn, group in name_index.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                add_candidate("L1", group[i], group[j], 1.0,
                              f"标准化名完全一致: '{nn}'")
    
    # ── L2: (org, city) + similarity >= 0.80 ──
    for key, group in org_city_map.items():
        org, city = key
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                sim = name_similarity(group[i]["name_cn"], group[j]["name_cn"])
                if sim >= 0.80:
                    add_candidate("L2", group[i], group[j], sim,
                                  f"同主办({org}) + 同城市({city})")
    
    # ── L3: same organizer + similarity >= 0.75 ──
    org_map = defaultdict(list)
    for b in all_brands:
        org_map[b["organizer"]].append(b)
    
    for org, group in org_map.items():
        if len(group) < 2:
            continue
        for i in range(len(group)):
            for j in range(i + 1, len(group)):
                sim = name_similarity(group[i]["name_cn"], group[j]["name_cn"])
                if sim >= 0.75:
                    add_candidate("L3", group[i], group[j], sim,
                                  f"同主办({org})")
    
    # ── L4: cross-organizer similarity >= 0.70 ──
    # 仅比较名称长度>=6的，避免短名称假阳性
    for i in range(len(all_brands)):
        if len(all_brands[i]["name_cn"]) < 6:
            continue
        for j in range(i + 1, len(all_brands)):
            if len(all_brands[j]["name_cn"]) < 6:
                continue
            if all_brands[i]["organizer"] == all_brands[j]["organizer"]:
                continue  # 已在 L3 中
            sim = name_similarity(all_brands[i]["name_cn"], all_brands[j]["name_cn"])
            if sim >= 0.70:
                add_candidate("L4", all_brands[i], all_brands[j], sim,
                              "名称高度相似(跨主办方)")
    
    return results


def cluster_groups(candidates, level):
    """将候选对聚类为连通组"""
    # Union-Find
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
    for c in candidates:
        all_ids.add(c["brand_a"]["brand_id"])
        all_ids.add(c["brand_b"]["brand_id"])
    
    for bid in all_ids:
        parent[bid] = bid
    
    for c in candidates:
        union(c["brand_a"]["brand_id"], c["brand_b"]["brand_id"])
    
    # 收集组
    groups = defaultdict(list)
    for bid in all_ids:
        groups[find(bid)].append(bid)
    
    return list(groups.values())


# ─── 主流程 ───────────────────────────────────────────────────────

def main():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    
    brands = load_data(conn)
    print(f"加载品牌总数: {len(brands)}")
    
    results = find_candidates(brands)
    
    total_candidates = 0
    total_brands_affected = set()
    
    for level in ["L0", "L1", "L2", "L3", "L4"]:
        candidates = results[level]
        if not candidates:
            print(f"\n{'='*70}")
            print(f"  {level}: 0 个候选")
            continue
        
        groups = cluster_groups(candidates, level)
        brands_here = set()
        for g in groups:
            brands_here.update(g)
        
        total_candidates += len(candidates)
        total_brands_affected.update(brands_here)
        
        print(f"\n{'='*70}")
        print(f"  {level}: {len(candidates)} 个候选对 → {len(groups)} 个合并组 → {len(brands_here)} 个品牌受影响")
        print(f"{'='*70}")
        
        # 每组显示前 3 个品牌名
        for i, group in enumerate(groups):
            if len(group) < 2:
                continue
            group_brands = [b for b in brands if b["brand_id"] in group]
            names = [b["name_cn"] for b in group_brands]
            similarity = max(c["similarity"] for c in candidates 
                           if c["brand_a"]["brand_id"] in group and c["brand_b"]["brand_id"] in group)
            reason = next((c["reason"] for c in candidates 
                          if c["brand_a"]["brand_id"] in group and c["brand_b"]["brand_id"] in group), "")
            
            print(f"\n  组 {i+1} (相似度: {similarity:.0%}, {reason})")
            for n in names[:5]:
                print(f"    • {n}")
            if len(names) > 5:
                print(f"    ... 还有 {len(names)-5} 个")
    
    print(f"\n{'='*70}")
    print(f"  总计: {total_candidates} 个候选对, {len(total_brands_affected)} 个不重复品牌受影响")
    print(f"  合并后品牌数预估: {len(brands) - len(total_brands_affected) + sum(1 for g in cluster_groups(results['L0'], 'L0') if len(g)>=2) + sum(1 for g in cluster_groups(results['L1'], 'L1') if len(g)>=2) + sum(1 for g in cluster_groups(results['L2'], 'L2') if len(g)>=2) + sum(1 for g in cluster_groups(results['L3'], 'L3') if len(g)>=2)} (粗略)")
    print(f"{'='*70}")
    
    conn.close()


if __name__ == "__main__":
    main()
