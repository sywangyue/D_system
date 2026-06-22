#!/usr/bin/env python3
"""
execute_dedup.py — 品牌去重执行脚本
D0: (org, city, date_start) + sim >= 80% + same industry_l2
L1: normalized name exact match
L2: (org, city) + sim >= 80% + same industry_l2

每条变更记录在 manual_tag_history 中
"""
from __future__ import annotations

import difflib
import re
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path

DB_PATH = Path("/Volumes/databoard/AI Project/D_dashboard/mwlab.db")
NOW = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

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

def extract_edition_num(name: str) -> int | None:
    m = re.search(r'第\s*(\d+)\s*届', name)
    if m:
        return int(m.group(1))
    return None

def name_similarity(a: str, b: str) -> float:
    na = normalize_name(a)
    nb = normalize_name(b)
    if not na or not nb:
        return 0.0
    return difflib.SequenceMatcher(None, na, nb).ratio()


def main():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    
    # ── 加载数据 ──
    brands = conn.execute("""
        SELECT b.*, e.year as latest_year, e.date_start, e.date_end,
               e.area_sqm, e.exhibitors_count, e.visitors_count, e.venue, e.status
        FROM exhibition_brand b
        LEFT JOIN exhibition_edition e ON e.brand_id = b.brand_id
            AND e.year = (SELECT MAX(year) FROM exhibition_edition WHERE brand_id = b.brand_id)
    """).fetchall()
    
    brand_by_id = {b["brand_id"]: dict(b) for b in brands}
    
    print(f"Loaded {len(brands)} brands")
    
    # ── 建立索引 ──
    date_key = defaultdict(list)      # (org, city, date_start)
    org_city_key = defaultdict(list)  # (org, city)
    name_key = defaultdict(list)      # normalized_name
    
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
    
    # ── 找合并组 ──
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
    
    all_bids = [b["brand_id"] for b in brands]
    for bid in all_bids:
        parent[bid] = bid
    
    merge_log = []  # (level, b1_id, b2_id, sim, reason)
    
    # D0: (org, city, date) + sim >= 0.80 + same industry_l2
    for key, group in date_key.items():
        org, city, ds = key
        for i in range(len(group)):
            for j in range(i+1, len(group)):
                b1, b2 = group[i], group[j]
                l2_1 = (b1["industry_l2"] or "").strip()
                l2_2 = (b2["industry_l2"] or "").strip()
                if l2_1 and l2_2 and l2_1 != l2_2:
                    continue  # different industry → skip
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
    for key, group in org_city_key.items():
        org, city = key
        for i in range(len(group)):
            for j in range(i+1, len(group)):
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
    
    # ── 收集合并组 ──
    groups_map = defaultdict(set)
    for bid in all_bids:
        groups_map[find(bid)].add(bid)
    
    merge_groups = [g for g in groups_map.values() if len(g) >= 2]
    print(f"\nFound {len(merge_groups)} merge groups")
    
    # ═══════════════════════════════════════════════════════
    # 执行合并
    # ═══════════════════════════════════════════════════════
    
    total_deleted = 0
    total_editions_migrated = 0
    total_provenance_migrated = 0
    report_lines = []
    
    for g_idx, group in enumerate(sorted(merge_groups, key=lambda g: min(g))):
        group_list = sorted(group)
        canonical = group_list[0]  # 保留最小 brand_id 作为主品牌
        to_delete = group_list[1:]
        
        gbrands = [brand_by_id[bid] for bid in group_list if bid in brand_by_id]
        names_str = " | ".join(b["name_cn"] for b in gbrands[:4])
        if len(gbrands) > 4:
            names_str += f" ... +{len(gbrands)-4}"
        
        # 收集 reasons
        reasons = set()
        for log in merge_log:
            if log[1] in group and log[2] in group:
                reasons.add(log[0])
        level_str = "+".join(sorted(reasons))
        
        print(f"\n  Group {g_idx+1} [{level_str}]: {canonical} ← {to_delete}")
        print(f"    {names_str}")
        
        # ── 合并字段 ──
        # 收集所有成员的值，选择最佳
        all_names_cn = [b["name_cn"] for b in gbrands if b["name_cn"]]
        all_names_en = [b["name_en"] for b in gbrands if b["name_en"]]
        all_organizers = [b["organizer"] for b in gbrands if b["organizer"]]
        all_cities = [b["city"] for b in gbrands if b["city"]]
        all_websites = [b["website"] for b in gbrands if b["website"]]
        all_l1 = [b["industry_l1"] for b in gbrands if b["industry_l1"]]
        all_l2 = [b["industry_l2"] for b in gbrands if b["industry_l2"]]
        
        # Pick canonical name: shortest non-year-prefixed version
        clean_names = [(normalize_name(n), n) for n in all_names_cn]
        clean_names.sort(key=lambda x: len(x[1]))  # shortest first
        canonical_name = clean_names[0][1] if clean_names else all_names_cn[0]
        
        # Pick best English name (non-empty, no Chinese)
        best_en = ""
        for en in all_names_en:
            if en and not re.search(r'[一-龥]', en):
                best_en = en
                break
        
        # Most common organizer
        from collections import Counter
        best_org = Counter(all_organizers).most_common(1)[0][0] if all_organizers else ""
        best_city = Counter(all_cities).most_common(1)[0][0] if all_cities else ""
        
        # First year: min of all
        all_first_years = [b["first_year"] for b in gbrands if b["first_year"]]
        first_year = min(all_first_years) if all_first_years else None
        
        # UFI
        is_ufi = max(b["is_ufi_certified"] or 0 for b in gbrands)
        
        # Frequency
        edition_years = set()
        for bid in group_list:
            yrs = conn.execute("SELECT year FROM exhibition_edition WHERE brand_id=?", (bid,)).fetchall()
            for r in yrs:
                if r["year"]:
                    edition_years.add(r["year"])
        frequency = "年展" if len(edition_years) >= 2 else (gbrands[0].get("frequency") or "")
        
        # Industry: majority
        best_l1 = Counter(all_l1).most_common(1)[0][0] if all_l1 else ""
        best_l2 = Counter(all_l2).most_common(1)[0][0] if all_l2 else ""
        
        # Website
        best_website = all_websites[0] if all_websites else ""
        
        # Update canonical brand
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
        values = list(updates.values()) + [canonical]
        conn.execute(f"UPDATE exhibition_brand SET {set_clause} WHERE brand_id = ?", values)
        
        # ── 记录打标历史 ──
        for bid in to_delete:
            old_name = (brand_by_id.get(bid, {}) or {}).get("name_cn", "")
            conn.execute("""
                INSERT INTO manual_tag_history (brand_id, field_name, old_value, new_value, changed_by, changed_at, reason)
                VALUES (?, 'merged_into', ?, ?, 'system/dedup', ?, 'auto-merge')
            """, (bid, old_name, canonical, NOW))
        
        # ── 迁移届次 ──
        for bid in to_delete:
            result = conn.execute("UPDATE exhibition_edition SET brand_id = ? WHERE brand_id = ?",
                                  (canonical, bid))
            total_editions_migrated += result.rowcount
        
        # ── 迁移溯源 ──
        for bid in to_delete:
            result = conn.execute("UPDATE data_provenance SET brand_id = ? WHERE brand_id = ?",
                                  (canonical, bid))
            total_provenance_migrated += result.rowcount
        
        # ── 删除冗余品牌 ──
        for bid in to_delete:
            conn.execute("DELETE FROM exhibition_brand WHERE brand_id = ?", (bid,))
            total_deleted += 1
        
        report_lines.append(f"  [{level_str}] {canonical}: {' ← '.join(to_delete)}")
        report_lines.append(f"         {canonical_name}")
    
    conn.commit()
    
    # ═══════════════════════════════════════════════════════
    # 报告
    # ═══════════════════════════════════════════════════════
    
    remaining = conn.execute("SELECT COUNT(*) FROM exhibition_brand").fetchone()[0]
    editions_now = conn.execute("SELECT COUNT(*) FROM exhibition_edition").fetchone()[0]
    multi_edition = conn.execute("""
        SELECT COUNT(*) FROM (
            SELECT brand_id FROM exhibition_edition GROUP BY brand_id HAVING COUNT(*) > 1
        )
    """).fetchone()[0]
    max_eds = conn.execute("""
        SELECT MAX(cnt) FROM (
            SELECT COUNT(*) as cnt FROM exhibition_edition GROUP BY brand_id
        )
    """).fetchone()[0]
    
    print(f"\n{'='*60}")
    print(f"  执行完成")
    print(f"  合并组数: {len(merge_groups)}")
    print(f"  删除品牌: {total_deleted}")
    print(f"  迁移届次: {total_editions_migrated}")
    print(f"  迁移溯源: {total_provenance_migrated}")
    print(f"  剩余品牌: {remaining}")
    print(f"  剩余届次: {editions_now}")
    print(f"  多届次品牌: {multi_edition} (曾为 149)")
    print(f"  最大届次/品牌: {max_eds} (曾为 2)")
    print(f"{'='*60}")
    
    # 输出完整审计日志
    log_path = DB_PATH.parent / "scripts" / "dedup_audit.log"
    with open(log_path, "w") as f:
        f.write(f"# Dedup Audit Log — {NOW}\n")
        f.write(f"# Groups: {len(merge_groups)}, Deleted: {total_deleted}\n\n")
        for line in report_lines:
            f.write(line + "\n")
    print(f"\n审计日志: {log_path}")
    
    conn.close()

if __name__ == "__main__":
    main()
