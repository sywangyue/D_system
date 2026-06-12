#!/usr/bin/env python3
"""
本地回填 organizer — 在用户 Mac 上直接运行
使用 opencli browser 通过本地 Chrome 访问聚展详情页

前提条件:
  - opencli 已安装，daemon 运行在 19825
  - Chrome 扩展已连接
  - 本地 IP 能访问 jufair.com（大陆 IP）

用法:
  python3 tools/backfill_organizer_local.py

选项:
  --dry-run    只打印不写库
  --delay N    每页间隔秒数 (默认 1.0)
  --db PATH    数据库路径
"""

import csv
import json
import os
import re
import sqlite3
import subprocess
import sys
import time
import argparse
from datetime import datetime

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
DB_PATH = os.path.join(PROJECT_DIR, "mwlab.db")
CSV_PATH = "/tmp/organizer_backfill.csv"

# opencli session name (create once, reuse)
SESSION = "organizer_backfill"


def export_csv(db_path):
    """Export missing organizer brands to CSV."""
    print("导出待回填列表...")
    result = subprocess.run(
        ["sqlite3", "-csv", "-header", db_path,
         """SELECT b.brand_id, b.name_cn, dp.source_url
            FROM exhibition_brand b
            JOIN data_provenance dp ON b.brand_id = dp.brand_id
            WHERE b.organizer = ''
              AND dp.source_site = 'jufair'
              AND dp.source_url LIKE '%jufair.com/exhibition/%'
            GROUP BY b.brand_id
            ORDER BY b.brand_id"""],
        capture_output=True, text=True
    )
    with open(CSV_PATH, "w") as f:
        f.write(result.stdout)
    lines = result.stdout.strip().count("\n") 
    print(f"导出 {lines} 条到 {CSV_PATH}")
    return lines


def opencli_eval(url, js):
    """Open URL in opencli browser and eval JS. Returns parsed JSON or None."""
    try:
        # Open URL
        r = subprocess.run(
            ["opencli", "browser", SESSION, "open", url],
            capture_output=True, text=True, timeout=20
        )
        if r.returncode != 0:
            return None
        data = json.loads(r.stdout)
        page_id = data.get("page")
        if not page_id:
            return None
        
        # Small wait for page render
        time.sleep(0.5)
        
        # Eval JS
        r = subprocess.run(
            ["opencli", "browser", SESSION, "eval", "--tab", page_id, js],
            capture_output=True, text=True, timeout=10
        )
        if r.returncode != 0:
            return None
        return json.loads(r.stdout)
    except Exception as e:
        print(f"[WARN] {url}: {e}")
        return None


def extract_organizer(url):
    """Extract organizer from jufair detail page via opencli."""
    js = """JSON.stringify({
        organizer: (document.body.innerText.match(/主办单位[:\\s]*\\n?\\s*(.+?)(?:\\n|$)/)||[])[1]||null,
        has_forbidden: document.body.innerText.includes('403 Forbidden')
    })"""
    
    result = opencli_eval(url, js)
    if not result:
        return None
    
    if result.get("has_forbidden"):
        return "__FORBIDDEN__"
    
    org = result.get("organizer")
    if org:
        org = org.strip()
        return org if org else None
    return None


def update_db(db_path, brand_id, organizer):
    """Update organizer in DB."""
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = sqlite3.connect(db_path)
    try:
        conn.execute(
            "UPDATE exhibition_brand SET organizer = ?, updated_at = ? WHERE brand_id = ?",
            (organizer, now, brand_id)
        )
        conn.execute(
            """INSERT INTO manual_tag_history 
               (brand_id, field_name, old_value, new_value, changed_by, changed_at)
               VALUES (?, 'organizer', '', ?, 'auto_jufair_opencli', ?)""",
            (brand_id, organizer, now)
        )
        conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"  DB ERROR: {e}")
        return False
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="本地回填 organizer")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--delay", type=float, default=1.0)
    parser.add_argument("--db", default=DB_PATH)
    parser.add_argument("--start", type=int, default=0)
    parser.add_argument("--limit", type=int, default=0)
    args = parser.parse_args()
    
    # Re-export CSV to get fresh list of missing organizers
    if not os.path.exists(CSV_PATH) or args.start == 0:
        export_csv(args.db)
    else:
        print(f"使用已有 CSV: {CSV_PATH}")
    
    rows = []
    with open(CSV_PATH, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    
    if args.start > 0:
        rows = rows[args.start:]
    if args.limit > 0:
        rows = rows[:args.limit]
    
    total = len(rows)
    print(f"\n开始回填: {total} 条, 间隔 {args.delay}s, dry_run={args.dry_run}")
    print("=" * 60)
    
    ok_count = 0
    not_found = 0
    forbidden = 0
    error_count = 0
    start_time = time.time()
    
    for i, row in enumerate(rows):
        brand_id = row["brand_id"]
        name_cn = row.get("name_cn", "")
        url = row["source_url"]
        
        time.sleep(args.delay)
        
        organizer = extract_organizer(url)
        
        if organizer == "__FORBIDDEN__":
            forbidden += 1
            print(f"[{i+1}/{total}] 🚫 {brand_id} {name_cn[:30]} — IP blocked, stopping")
            break
        elif organizer:
            if not args.dry_run:
                if update_db(args.db, brand_id, organizer):
                    ok_count += 1
                    icon = "✓"
                else:
                    error_count += 1
                    icon = "⚠"
            else:
                ok_count += 1
                icon = "○"
            
            org_display = organizer if len(organizer) <= 40 else organizer[:37] + "..."
            print(f"[{i+1}/{total}] {icon} {brand_id} {name_cn[:30]:30s} → {org_display}")
        else:
            not_found += 1
            print(f"[{i+1}/{total}] ✗ {brand_id} {name_cn[:30]:30s} → (无)")
    
    elapsed = time.time() - start_time
    print("=" * 60)
    print(f"完成: {elapsed:.0f}s | 成功: {ok_count} | 未找到: {not_found} | 被禁: {forbidden} | 错误: {error_count}")


if __name__ == "__main__":
    main()
