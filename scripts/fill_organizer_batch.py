#!/usr/bin/env python3
"""Batch extract organizer & website from jufair detail pages via HTTP scraping.

Reads brands missing organizer from mwlab.db, fetches their jufair source_url,
extracts organizer and optional website, updates database.

Usage: python3 scripts/fill_organizer_batch.py [--limit N]
"""

import sqlite3
import urllib.request
import re
import time
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "mwlab.db")
MAX_WORKERS = 8
REQUEST_TIMEOUT = 12
DELAY_PER_WORKER = 0.3  # seconds between requests per thread

ORGANIZER_RE = re.compile(r'主办单位[：:]\s*</dt>\s*<dd[^>]*>\s*([^<]+)')

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

def fetch_organizer(url):
    """Fetch a jufair detail page and extract organizer"""
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        resp = urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT)
        html = resp.read().decode('utf-8', errors='ignore')
        m = ORGANIZER_RE.search(html)
        if m:
            org = m.group(1).strip()
            if org and len(org) >= 2 and org != '-':
                return org
    except Exception:
        pass
    return None

def process_brand(bid, name, url):
    """Process a single brand"""
    org = fetch_organizer(url)
    time.sleep(DELAY_PER_WORKER)
    return (bid, name, org)

def main():
    limit = None
    for arg in sys.argv[1:]:
        if arg.startswith('--limit='):
            limit = int(arg.split('=')[1])
    
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    # Get brands with jufair URLs that need organizer
    cur.execute("""
    SELECT DISTINCT b.brand_id, b.name_cn, dp.source_url
    FROM exhibition_brand b
    JOIN data_provenance dp ON b.brand_id = dp.brand_id
    WHERE (b.organizer IS NULL OR b.organizer = '')
    AND dp.source_url LIKE '%jufair.com/exhibition/%'
    AND dp.source_url IS NOT NULL
    ORDER BY b.brand_id
    """ + (f" LIMIT {limit}" if limit else ""))
    
    brands = cur.fetchall()
    total = len(brands)
    print(f"🎯 {total} brands with jufair URLs to process")
    
    if total == 0:
        print("No brands to process")
        conn.close()
        return
    
    found = 0
    not_found = 0
    errors = 0
    
    # Process in batches
    batch_size = 50
    for batch_start in range(0, total, batch_size):
        batch = brands[batch_start:batch_start + batch_size]
        
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {}
            for b in batch:
                f = executor.submit(process_brand, b['brand_id'], b['name_cn'], b['source_url'])
                futures[f] = b
            
            for f in as_completed(futures):
                bid, name, org = f.result()
                if org:
                    cur.execute("""
                    UPDATE exhibition_brand 
                    SET organizer = ?, updated_at = datetime('now')
                    WHERE brand_id = ?
                    """, (org, bid))
                    found += 1
                else:
                    not_found += 1
        
        conn.commit()
        pct = min(batch_start + batch_size, total) / total * 100
        print(f"  [{min(batch_start+batch_size,total)}/{total}] {pct:.0f}% | found={found} miss={not_found}")
    
    # Final stats
    cur.execute("""
    SELECT COUNT(*) FROM exhibition_brand
    WHERE (organizer IS NULL OR organizer = '')
    AND name_cn IS NOT NULL AND name_cn != ''
    """)
    still_missing = cur.fetchone()[0]
    
    print(f"\n{'='*50}")
    print(f"✅ 完成: found={found}, not_found={not_found}")
    print(f"仍缺失: {still_missing}")
    
    conn.close()

if __name__ == "__main__":
    main()
