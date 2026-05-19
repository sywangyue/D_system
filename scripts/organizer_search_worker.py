#!/usr/bin/env python3
"""MWLAB Organizer & Website Filler — Autonomous OpenCLI Search Worker

Reads brands missing organizer from mwlab.db, searches Baidu via OpenCLI,
extracts organizer + website, updates database. Supports resume from crash.

Usage: python3 scripts/organizer_search_worker.py
"""

import sqlite3
import subprocess
import json
import re
import time
import sys
import os
from datetime import datetime

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "mwlab.db")
PROGRESS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "organizer_fill_progress.json")
BATCH_SIZE = 5
DELAY_BETWEEN = 4  # seconds between searches
MAX_RETRIES = 2

def load_progress():
    if os.path.exists(PROGRESS_FILE):
        with open(PROGRESS_FILE) as f:
            return json.load(f)
    return {"total": 0, "completed": 0, "failed": 0, "last_id": None, "errors": []}

def save_progress(prog):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(prog, f, indent=2, ensure_ascii=False)

def search_opencli(query):
    """Search Baidu via OpenCLI, return raw output"""
    try:
        result = subprocess.run(
            ["opencli", "baidu", "search", query, "-f", "json"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0 and result.stdout.strip():
            return json.loads(result.stdout)
    except Exception as e:
        print(f"  ⚠️ OpenCLI error: {e}")
    return None

def extract_organizer_url(search_results):
    """Extract organizer and website from search results"""
    org = None
    url = None
    
    if not search_results:
        return None, None
    
    # search_results could be a list of dicts with title/snippet/url
    results = search_results if isinstance(search_results, list) else []
    
    org_patterns = [
        r'主办[单位方]?[：:]\s*([^\s,，。；;]+)',
        r'由\s*([^\s,，。；;]{2,20})\s*主办',
        r'承办[单位方]?[：:]\s*([^\s,，。；;]+)',
        r'组委会[：:]\s*([^\s,，。；;]+)',
    ]
    
    for item in results[:5]:
        text = str(item.get('title', '')) + ' ' + str(item.get('snippet', ''))
        
        # Extract organizer
        for pat in org_patterns:
            m = re.search(pat, text)
            if m:
                candidate = m.group(1).strip()
                # Filter out noise
                if len(candidate) >= 3 and not re.search(r'[0-9]{4}|新闻|资讯|百度|展会网', candidate):
                    org = candidate
                    break
        if org:
            break
    
    # Extract website from first result URL
    for item in results[:3]:
        u = item.get('url', '')
        if u and not any(skip in u for skip in ['baidu.com', 'zhihu.com', 'weibo.com', 'douyin.com']):
            url = u
            break
    
    return org, url

def main():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    
    prog = load_progress()
    print(f"📊 Progress: {prog['completed']}/{prog['total']}, failed={prog['failed']}")
    
    # Get brands needing organizer
    cur.execute("""
    SELECT brand_id, name_cn 
    FROM exhibition_brand
    WHERE (organizer IS NULL OR organizer = '')
    AND name_cn IS NOT NULL AND name_cn != ''
    AND industry_l1 IS NOT NULL AND industry_l1 != ''
    ORDER BY brand_id
    """)
    brands = cur.fetchall()
    
    if prog['last_id']:
        # Resume from last processed
        brands = [b for b in brands if b['brand_id'] > prog['last_id']]
    
    prog['total'] = len(brands)
    save_progress(prog)
    
    print(f"🎯 {len(brands)} brands to process")
    
    processed = 0
    for i, b in enumerate(brands):
        bid = b['brand_id']
        name = b['name_cn']
        
        # Search
        query = f"{name} 展览会 主办方"
        print(f"\n[{i+1}/{len(brands)}] [{bid}] {name[:50]}")
        
        org = None
        url = None
        
        for attempt in range(MAX_RETRIES + 1):
            results = search_opencli(query)
            if results:
                org, url = extract_organizer_url(results)
                if org:
                    break
            if attempt < MAX_RETRIES:
                time.sleep(2)
        
        # Update DB
        if org:
            cur.execute("""
            UPDATE exhibition_brand 
            SET organizer = ?, website = COALESCE(NULLIF(website,''), ?), updated_at = datetime('now')
            WHERE brand_id = ?
            """, (org, url or '', bid))
            print(f"  ✅ organizer: {org[:40]}")
            if url:
                print(f"     website: {url[:60]}")
            prog['completed'] += 1
        else:
            print(f"  ❌ not found")
            prog['failed'] += 1
        
        conn.commit()
        prog['last_id'] = bid
        processed += 1
        
        # Progress save every 10
        if processed % 10 == 0:
            save_progress(prog)
            pct = (i+1)/len(brands)*100
            print(f"  📊 {prog['completed']} found, {prog['failed']} failed ({pct:.0f}%)")
        
        # Rate limit
        time.sleep(DELAY_BETWEEN)
    
    save_progress(prog)
    
    # Final stats
    cur.execute("""
    SELECT COUNT(*) FROM exhibition_brand
    WHERE (organizer IS NULL OR organizer = '')
    """)
    still_missing = cur.fetchone()[0]
    
    print(f"\n{'='*50}")
    print(f"✅ 完成！")
    print(f"   找到: {prog['completed']}")
    print(f"   未找到: {prog['failed']}")
    print(f"   仍缺失: {still_missing}")
    
    conn.close()

if __name__ == "__main__":
    main()
