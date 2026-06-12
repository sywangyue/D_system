#!/usr/bin/env python3
"""
从 exhibition_brand.name_cn 中提取地理信息
填充 city / city_en / country_cn / country_en

逻辑优先级：
  1. name_cn 中匹配「外国国家 + 外国城市」 → city + country
  2. name_cn 中匹配「中国城市」             → city, country=中国
  3. name_cn 中匹配「中国省份」             → city=省份, country=中国
  4. name_cn 中匹配「外国城市」             → city, country=查表
  5. name_cn 中匹配「国家」                 → country
  6. 以上都不匹配 + 推理规则                → 尝试推断 country
  7. 全部失败                               → 留空

用法:
  python3 tools/extract_geo.py [--dry-run] [--db mwlab.db]
"""

import os
import re
import sqlite3
import sys
import argparse
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, PROJECT_DIR)

from tools.geo_dict import (
    CN_CITIES, CN_PROVINCES, FOREIGN_CITIES,
    COUNTRIES_CN, NON_COUNTRY_TERMS,
)


def build_matchers():
    """Build sorted matcher lists (longest first for greedy matching)."""
    # City matchers: CN cities + foreign cities + provinces
    city_patterns = []
    
    # Chinese cities (highest priority)
    for cn_name, (en_name, country_cn, country_en) in sorted(CN_CITIES.items(), key=lambda x: -len(x[0])):
        city_patterns.append({
            "keyword": cn_name,
            "city_cn": cn_name,
            "city_en": en_name,
            "country_cn": country_cn,
            "country_en": country_en,
            "type": "cn_city",
            "len": len(cn_name),
        })
    
    # Chinese provinces
    for cn_name, (en_name, country_cn, country_en) in sorted(CN_PROVINCES.items(), key=lambda x: -len(x[0])):
        city_patterns.append({
            "keyword": cn_name,
            "city_cn": cn_name,
            "city_en": en_name,
            "country_cn": country_cn,
            "country_en": country_en,
            "type": "cn_province",
            "len": len(cn_name),
        })
    
    # Foreign cities
    for cn_name, (en_name, country_cn, country_en) in sorted(FOREIGN_CITIES.items(), key=lambda x: -len(x[0])):
        city_patterns.append({
            "keyword": cn_name,
            "city_cn": cn_name,
            "city_en": en_name,
            "country_cn": country_cn,
            "country_en": country_en,
            "type": "foreign_city",
            "len": len(cn_name),
        })
    
    # Country matchers (longest first)
    country_patterns = []
    for cn_name, en_name in sorted(COUNTRIES_CN.items(), key=lambda x: -len(x[0])):
        country_patterns.append({
            "keyword": cn_name,
            "country_cn": cn_name,
            "country_en": en_name,
            "len": len(cn_name),
        })
    
    return city_patterns, country_patterns


def extract_geo(name_cn, city_patterns, country_patterns):
    """
    Extract city and country from exhibition name.
    Returns (city_cn, city_en, country_cn, country_en, ambiguous) where ambiguous
    is a list of extra matching city keywords (empty when unambiguous).
    """
    if not name_cn:
        return None, None, None, None, []

    # Collect ALL matching cities, then prefer the longest (most specific) match.
    # city_patterns is sorted longest-first so iteration order already prefers longer
    # keywords; we still collect all matches to detect ambiguity.
    all_matches = []
    for cp in city_patterns:
        pos = name_cn.find(cp["keyword"])
        if pos >= 0:
            # Skip if a longer keyword that is a superset already matched at same pos
            # (e.g. "哈尔滨" subsumes "尔" — avoid spurious sub-matches)
            shadowed = any(
                m["pos"] <= pos and m["pos"] + m["len"] >= pos + cp["len"]
                for m in all_matches
            )
            if not shadowed:
                all_matches.append({**cp, "pos": pos})

    # Remove matches subsumed by a longer match found anywhere in all_matches
    def _is_subsumed(m):
        return any(
            o is not m and o["pos"] <= m["pos"] and o["pos"] + o["len"] >= m["pos"] + m["len"]
            for o in all_matches
        )
    all_matches = [m for m in all_matches if not _is_subsumed(m)]

    # Select best: longest keyword wins; break ties by earliest position
    all_matches.sort(key=lambda m: (-m["len"], m["pos"]))
    ambiguous = [m["keyword"] for m in all_matches[1:]] if len(all_matches) > 1 else []
    matched_city = all_matches[0] if all_matches else None

    # ---- Priority 1: Check if name contains "国家+城市" pattern ----
    # This is for names like "俄罗斯莫斯科紧固件展" where both appear
    # We check foreign cities first and validate against their expected country
    if matched_city and matched_city["type"] == "foreign_city":
        country_in_name = matched_city["country_cn"]
        if country_in_name in name_cn:
            # Country + city both present: use both
            return (
                matched_city["city_cn"],
                matched_city["city_en"],
                matched_city["country_cn"],
                matched_city["country_en"],
                ambiguous,
            )

    # If we found a CN city or province, that takes priority over country-only match
    if matched_city and matched_city["type"] in ("cn_city", "cn_province"):
        return (
            matched_city["city_cn"],
            matched_city["city_en"],
            matched_city["country_cn"],
            matched_city["country_en"],
            ambiguous,
        )

    # ---- Priority 2: Foreign city standalone (e.g., "巴黎航展") ----
    if matched_city and matched_city["type"] == "foreign_city":
        return (
            matched_city["city_cn"],
            matched_city["city_en"],
            matched_city["country_cn"],
            matched_city["country_en"],
            ambiguous,
        )
    
    # ---- Priority 3: Country-only (e.g., "土库曼斯坦石油展") ----
    matched_country = None
    matched_country_pos = len(name_cn) + 1

    for cp in country_patterns:
        pos = name_cn.find(cp["keyword"])
        if pos >= 0 and pos < matched_country_pos:
            kw = cp["keyword"]
            if kw not in NON_COUNTRY_TERMS:
                matched_country = cp
                matched_country_pos = pos

    if matched_country:
        return (
            None,
            None,
            matched_country["country_cn"],
            matched_country["country_en"],
            [],
        )

    # ---- Nothing matched ----
    return None, None, None, None, []


def infer_country(name_cn, is_international, is_international_source):
    """
    For names with zero geo info, try to infer country.
    Returns (country_cn, country_en) or (None, None).
    """
    if not name_cn:
        return None, None
    
    # Rule: If name is purely Chinese characters and no foreign indicators
    # and is_international = 0 → likely China
    has_chinese = bool(re.search(r'[\u4e00-\u9fff]', name_cn))
    
    if has_chinese and is_international == 0:
        # Check it doesn't contain explicit foreign references
        foreign_indicators = ["国际", "世界", "全球", "亚洲", "欧洲", "美洲", "非洲"]
        has_foreign_indicator = any(w in name_cn for w in foreign_indicators)
        
        if not has_foreign_indicator:
            return "中国", "China"
    
    # Rule: If name starts with a known international exhibition city indicator
    # but we couldn't match — leave empty rather than guess
    
    return None, None


def update_db(db_path, brand_id, city_cn, city_en, country_cn, country_en, dry_run):
    """Update geo fields in DB. Returns True if updated."""
    if dry_run:
        return True

    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(db_path)
    try:
        updates = []
        params = []

        if city_cn:
            updates.append("city = ?")
            params.append(city_cn)
        if city_en:
            updates.append("city_en = ?")
            params.append(city_en)
        if country_cn:
            updates.append("country_cn = ?")
            params.append(country_cn)
        if country_en:
            updates.append("country_en = ?")
            params.append(country_en)

        if not updates:
            conn.close()
            return False

        updates.append("updated_at = ?")
        params.append(now)
        params.append(brand_id)

        sql = f"UPDATE exhibition_brand SET {', '.join(updates)} WHERE brand_id = ?"
        conn.execute(sql, params)

        # Record one audit row per field with actual values written [CORE-11]
        field_values = []
        if city_cn:
            field_values.append(("city", city_cn))
        if city_en:
            field_values.append(("city_en", city_en))
        if country_cn:
            field_values.append(("country_cn", country_cn))
        if country_en:
            field_values.append(("country_en", country_en))
        for field_name, new_value in field_values:
            conn.execute(
                """INSERT INTO manual_tag_history
                   (brand_id, field_name, old_value, new_value, changed_by, changed_at)
                   VALUES (?, ?, '', ?, 'geo_extractor', ?)""",
                (brand_id, field_name, new_value, now)
            )

        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"[WARN] {brand_id}: {e}")  # [CORE-13] swallowed error now observable
        return False
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="从展会名称提取地理信息")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--db", default=os.path.join(PROJECT_DIR, "mwlab.db"))
    args = parser.parse_args()
    
    city_patterns, country_patterns = build_matchers()
    print(f"词典加载: {len(city_patterns)} 城市/省份词条, {len(country_patterns)} 国家词条")
    
    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row
    
    # Get brands needing geo fill
    cursor = conn.execute(
        """SELECT brand_id, name_cn, city, country_cn, is_international, is_international_source
           FROM exhibition_brand
           WHERE city = '' OR country_cn = ''
           ORDER BY brand_id"""
    )
    rows = cursor.fetchall()
    conn.close()
    
    total = len(rows)
    print(f"待处理: {total} 条\n")
    
    city_filled = 0
    country_filled = 0
    inferred = 0
    skipped = 0
    updated = 0
    
    for i, row in enumerate(rows):
        brand_id = row["brand_id"]
        name_cn = row["name_cn"]
        existing_city = row["city"]
        existing_country = row["country_cn"]
        is_intl = row["is_international"]
        is_intl_src = row["is_international_source"]
        
        # Only fill what's empty
        need_city = (existing_city == "" or existing_city is None)
        need_country = (existing_country == "" or existing_country is None)
        
        if not need_city and not need_country:
            skipped += 1
            continue
        
        # Try extraction from name
        ext_city, ext_city_en, ext_country, ext_country_en, ambiguous = extract_geo(
            name_cn, city_patterns, country_patterns
        )
        if ambiguous:
            print(f"[AMBIGUOUS] {brand_id} {name_cn[:40]!r}: matched '{ext_city}', also: {ambiguous}", file=sys.stderr)
        
        # Determine what to write
        write_city = None
        write_city_en = None
        write_country = None
        write_country_en = None
        method = ""
        
        if need_city and ext_city:
            write_city = ext_city
            write_city_en = ext_city_en
            city_filled += 1
            method = "extract"
        
        if need_country and ext_country:
            write_country = ext_country
            write_country_en = ext_country_en
            country_filled += 1
            method = "extract"
        
        # If still need country, try inference
        if need_country and not write_country:
            inf_country, inf_country_en = infer_country(name_cn, is_intl, is_intl_src)
            if inf_country:
                write_country = inf_country
                write_country_en = inf_country_en
                inferred += 1
                method = "infer"
        
        if write_city or write_country:
            ok = update_db(args.db, brand_id, write_city, write_city_en, 
                          write_country, write_country_en, args.dry_run)
            if ok:
                updated += 1
                icon = "○" if args.dry_run else "✓"
            else:
                icon = "⚠"
        else:
            icon = "-"
        
        # Progress output (every 50 or first/last 5)
        if i < 5 or i >= total - 5 or i % 200 == 0:
            geo_info = ""
            if write_city:
                geo_info += f"city={write_city}"
            if write_country:
                geo_info += f" country={write_country}"
            print(f"[{i+1}/{total}] {icon} {brand_id} {name_cn[:35]:35s} → {geo_info} [{method}]")
    
    print(f"\n{'='*60}")
    print(f"总计: {total} | 更新: {updated} | 城市填充: {city_filled} | 国家填充: {country_filled} | 推理: {inferred} | 跳过: {skipped}")
    if args.dry_run:
        print("DRY RUN - 未写入数据库")
    else:
        # Show final stats
        conn = sqlite3.connect(args.db)
        city_empty = conn.execute("SELECT COUNT(*) FROM exhibition_brand WHERE city = ''").fetchone()[0]
        country_empty = conn.execute("SELECT COUNT(*) FROM exhibition_brand WHERE country_cn = ''").fetchone()[0]
        conn.close()
        print(f"剩余空白: city={city_empty}, country_cn={country_empty}")


if __name__ == "__main__":
    main()
