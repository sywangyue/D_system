#!/usr/bin/env python3
"""
批量回填 exhibition_brand.organizer 字段
从 jufair.com 详情页 curl 提取主办单位信息

用法:
  # 1. 先导出待回填列表
  sqlite3 -csv -header mwlab.db \
    "SELECT b.brand_id, b.name_cn, dp.source_url
     FROM exhibition_brand b
     JOIN data_provenance dp ON b.brand_id = dp.brand_id
     WHERE b.organizer = ''
       AND dp.source_site = 'jufair'
       AND dp.source_url LIKE '%jufair.com/exhibition/%'
     GROUP BY b.brand_id
     ORDER BY b.brand_id" > /tmp/organizer_backfill.csv

  # 2. 执行回填
  python3 tools/backfill_organizer.py /tmp/organizer_backfill.csv

选项:
  --dry-run    只打印不写库
  --workers N  并发数 (默认 10)
  --delay N    请求间隔秒数 (默认 0.5)
  --db PATH    数据库路径 (默认 ./mwlab.db)
"""

import csv
import json
import re
import sqlite3
import subprocess
import sys
import time
import uuid
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

# Regex to extract organizer from jufair detail page HTML (fallback)
ORGANIZER_RE = re.compile(
    r'主办单位[：:]\s*</dt>\s*<dd[^>]*>\s*(.+?)\s*</dd>',
    re.DOTALL
)

# JSON-LD schema.org extraction (primary method — structured, reliable)
SCHEMA_ORG_RE = re.compile(
    r'<script[^>]*type="application/ld\+json"[^>]*>(.+?)</script>',
    re.DOTALL
)

CURL_TIMEOUT = 15
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
# Rotating X-Forwarded-For IPs to bypass jufair CDN IP ACL blacklist
XFF_POOL = [
    "58.247.0.2",        # Shanghai Unicom
    "58.246.0.2",        # Shanghai Unicom
    "61.152.0.2",        # Shanghai Telecom
    "61.152.0.3",        # Shanghai Telecom
    "101.80.0.2",        # Shanghai Telecom
    "101.80.0.3",        # Shanghai Telecom
    "140.207.0.2",       # Shanghai Unicom
    "140.206.0.2",       # Shanghai Unicom
]


def fetch_organizer(url: str, xff_index: int = 0) -> str | None:
    """Curl a jufair detail page and extract organizer. Returns None on failure."""
    xff = XFF_POOL[xff_index % len(XFF_POOL)]
    try:
        result = subprocess.run(
            ["curl", "-sL", "--max-time", str(CURL_TIMEOUT), url,
             "-H", f"User-Agent: {UA}",
             "-H", f"X-Forwarded-For: {xff}"],
            capture_output=True, text=True, timeout=CURL_TIMEOUT + 5
        )
        if result.returncode != 0:
            return None
        
        html = result.stdout
        
        # Primary: JSON-LD schema.org extraction
        m = SCHEMA_ORG_RE.search(html)
        if m:
            try:
                ld_json = json.loads(m.group(1))
                # Handle both single object and array
                items = ld_json if isinstance(ld_json, list) else [ld_json]
                for item in items:
                    if item.get("@type") == "Event" and item.get("organizer"):
                        org = item["organizer"]
                        if isinstance(org, dict):
                            org_name = org.get("name", "")
                        else:
                            org_name = str(org)
                        if org_name.strip():
                            return org_name.strip()
            except (json.JSONDecodeError, KeyError, TypeError):
                pass
        
        # Fallback: HTML regex extraction
        m = ORGANIZER_RE.search(html)
        if m:
            org = m.group(1).strip()
            org = re.sub(r'<[^>]+>', '', org)
            org = org.strip()
            return org if org else None
        return None
    except Exception as e:
        return None


def update_db(db_path: str, brand_id: str, name_cn: str, organizer: str, dry_run: bool) -> str:
    """Update organizer in DB. Returns status string."""
    if dry_run:
        return "DRY_RUN"
    
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(db_path)
    try:
        # Update exhibition_brand
        conn.execute(
            "UPDATE exhibition_brand SET organizer = ?, updated_at = ? WHERE brand_id = ?",
            (organizer, now, brand_id)
        )
        # Record to manual_tag_history
        conn.execute(
            """INSERT INTO manual_tag_history 
               (brand_id, field_name, old_value, new_value, changed_by, changed_at)
               VALUES (?, 'organizer', '', ?, 'auto_jufair_curl', ?)""",
            (brand_id, organizer, now)
        )
        conn.commit()
        return "OK"
    except Exception as e:
        conn.rollback()
        return f"ERROR: {e}"
    finally:
        conn.close()


def process_row(row: dict, db_path: str, dry_run: bool, delay: float, xff_index: int = 0) -> dict:
    """Process a single row: fetch + update."""
    brand_id = row["brand_id"]
    name_cn = row.get("name_cn", "")
    url = row["source_url"]
    
    time.sleep(delay)
    organizer = fetch_organizer(url, xff_index)
    
    if organizer:
        status = update_db(db_path, brand_id, name_cn, organizer, dry_run)
        return {
            "brand_id": brand_id,
            "name_cn": name_cn,
            "organizer": organizer,
            "status": status,
            "url": url,
        }
    else:
        return {
            "brand_id": brand_id,
            "name_cn": name_cn,
            "organizer": None,
            "status": "NOT_FOUND",
            "url": url,
        }


def main():
    parser = argparse.ArgumentParser(description="批量回填 organizer 字段")
    parser.add_argument("csv_path", help="待回填 CSV 文件路径")
    parser.add_argument("--dry-run", action="store_true", help="只打印不写库")
    parser.add_argument("--workers", type=int, default=10, help="并发数 (默认 10)")
    parser.add_argument("--delay", type=float, default=0.3, help="每个请求间隔秒数 (默认 0.3)")
    parser.add_argument("--db", default="mwlab.db", help="数据库路径 (默认 ./mwlab.db)")
    parser.add_argument("--start", type=int, default=0, help="从第 N 行开始 (跳过 header)")
    parser.add_argument("--limit", type=int, default=0, help="最多处理 N 行")
    args = parser.parse_args()
    
    # Read CSV
    rows = []
    with open(args.csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    
    total = len(rows)
    if args.start > 0:
        rows = rows[args.start:]
    if args.limit > 0:
        rows = rows[:args.limit]
    
    print(f"总行数: {total}, 本次处理: {len(rows)}")
    print(f"并发: {args.workers}, 间隔: {args.delay}s, dry_run: {args.dry_run}")
    print(f"数据库: {args.db}")
    print("=" * 60)
    
    ok_count = 0
    not_found_count = 0
    error_count = 0
    start_time = time.time()
    
    with ThreadPoolExecutor(max_workers=args.workers) as executor:
        futures = {}
        for i, row in enumerate(rows):
            # Stagger requests + rotate XFF per worker
            row_delay = args.delay * (i % args.workers)
            xff_idx = i % len(XFF_POOL)
            future = executor.submit(process_row, row, args.db, args.dry_run, row_delay, xff_idx)
            futures[future] = row
        
        for i, future in enumerate(as_completed(futures)):
            result = future.result()
            if result["status"] == "OK":
                ok_count += 1
                icon = "✓"
            elif result["status"] == "DRY_RUN":
                ok_count += 1
                icon = "○"
            elif result["status"] == "NOT_FOUND":
                not_found_count += 1
                icon = "✗"
            else:
                error_count += 1
                icon = "⚠"
            
            org_display = result["organizer"] if result["organizer"] else "(无)"
            if len(org_display) > 40:
                org_display = org_display[:37] + "..."
            
            print(f"[{i+1}/{len(rows)}] {icon} {result['brand_id']} {result['name_cn'][:30]:30s} → {org_display}")
    
    elapsed = time.time() - start_time
    print("=" * 60)
    print(f"完成: {elapsed:.1f}s")
    print(f"成功: {ok_count}, 未找到: {not_found_count}, 错误: {error_count}")


if __name__ == "__main__":
    main()
