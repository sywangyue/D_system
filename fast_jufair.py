#!/usr/bin/env python3
"""jufair 快速全量采集 — 先扫列表页，再补详情页"""
import re
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

_DB_DIR = Path(__file__).resolve().parent
DB = str(_DB_DIR / "jufair_2026.db")
BASE = "https://www.jufair.com"
LIST_DELAY = 1.5    # 列表页间隔（秒）
DETAIL_DELAY = 3.0   # 详情页间隔（秒）
MAX_RETRIES = 3

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": "https://www.jufair.com/",
}
session = requests.Session()
session.headers.update(headers)

# 所有月份（1-12），只爬列表页
BATCH_ID = f"fast_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
TARGET_YEAR = 2026

def fetch(url, label, timeout=15):
    for a in range(1, MAX_RETRIES+1):
        try:
            r = session.get(url, timeout=timeout)
            if r.status_code == 200:
                return r.text
            print(f"  [!] {label} HTTP {r.status_code}")
            if a < MAX_RETRIES:
                time.sleep(5*a)
            else:
                return None
        except Exception as e:
            print(f"  [!] {label} {e}")
            if a < MAX_RETRIES:
                time.sleep(5*a)
            else:
                return None

def parse_list(html):
    soup = BeautifulSoup(html, "html.parser")
    items = []
    for art in soup.select(".exh-info-wrap"):
        a = art.select_one("h2 a")
        if not a: continue
        cn = a.get_text(strip=True)
        href = a.get("href","")
        url = BASE + href if href.startswith("/") else href
        en = art.select_one(".En_name")
        tm = art.select_one("time")
        vl = art.select_one(".pavilion-name")
        date_str = tm.get_text(strip=True) if tm else ""
        if not date_str.startswith(f"{TARGET_YEAR}."):
            continue
        sd = art.select(".scale-remind")
        area = vis = exh = ""
        if sd:
            d0 = sd[0].select_one("data")
            u0 = sd[0].select_one(".unitText")
            area = (d0.get_text(strip=True) or "") + (u0.get_text(strip=True) or "") if d0 else ""
            ch = sd[0].select("div")
            if len(ch) >= 2:
                dv = ch[1].select_one("data")
                uv = ch[1].select_one(".unitText")
                vis = (dv.get_text(strip=True) or "") + (uv.get_text(strip=True) or "") if dv else ""
            if len(sd) >= 2:
                de = sd[1].select_one("data")
                ue = sd[1].select_one(".unitText")
                exh = (de.get_text(strip=True) or "") + (ue.get_text(strip=True) or "") if de else ""
        items.append({
            "cn_name": cn,
            "en_name": en.get_text(strip=True) if en else "",
            "date_str": date_str,
            "venue": vl.get_text(strip=True) if vl else "",
            "city": "",
            "area_str": area,
            "visitors_str": vis,
            "exhibitors_str": exh,
            "source_url": url,
        })
    return items

def main():
    conn = sqlite3.connect(DB)
    conn.execute("""CREATE TABLE IF NOT EXISTS raw_jufair (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cn_name TEXT NOT NULL, en_name TEXT DEFAULT '', date_str TEXT DEFAULT '',
        year INTEGER DEFAULT 0, venue TEXT DEFAULT '', city TEXT DEFAULT '',
        area_str TEXT DEFAULT '', visitors_str TEXT DEFAULT '',
        exhibitors_str TEXT DEFAULT '', organizer TEXT DEFAULT '',
        cycle TEXT DEFAULT '', industry TEXT DEFAULT '',
        source_type TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL UNIQUE,
        detail_crawled INTEGER DEFAULT 0,
        crawl_batch_id TEXT DEFAULT '', crawled_at TEXT DEFAULT (datetime('now'))
    )""")
    conn.commit()

    existing = {r[0] for r in conn.execute("SELECT source_url FROM raw_jufair").fetchall()}
    print(f"已有: {len(existing)} 条")

    total_new = 0
    total_pages = 0

    for month in range(1, 13):
        for stype, tcode in [("domestic", "1"), ("international", "0")]:
            page = 1
            while True:
                url = f"{BASE}/exhibition-0-0-{tcode}-0-0-{month:02d}-{page}/"
                label = f"m{month:02d} {stype[:4]} p{page}"
                html = fetch(url, label)
                if not html:
                    print(f"  → {label} 终止")
                    break
                if f"{TARGET_YEAR}." not in html:
                    print(f"  → {label} 无{TARGET_YEAR}数据")
                    break
                items = parse_list(html)
                if not items:
                    print(f"  → {label} 无条目")
                    break

                new_items = [it for it in items if it["source_url"] not in existing]
                if new_items:
                    for it in new_items:
                        it["source_type"] = stype
                        it["crawl_batch_id"] = BATCH_ID
                        it["year"] = TARGET_YEAR
                        it.setdefault("organizer", "")
                        it.setdefault("cycle", "")
                        it.setdefault("industry", "")
                        try:
                            conn.execute("""INSERT OR IGNORE INTO raw_jufair
                                (cn_name,en_name,date_str,year,venue,city,area_str,visitors_str,
                                 exhibitors_str,organizer,cycle,industry,source_type,source_url,
                                 detail_crawled,crawl_batch_id)
                                VALUES (:cn_name,:en_name,:date_str,:year,:venue,:city,:area_str,
                                        :visitors_str,:exhibitors_str,:organizer,:cycle,:industry,
                                        :source_type,:source_url,0,:crawl_batch_id)""", it)
                            conn.commit()
                        except Exception as e:
                            print(f"    DB err: {e}")
                    existing.update(it["source_url"] for it in new_items)
                    total_new += len(new_items)
                total_pages += 1
                print(f"  {label}: {len(items)}条 (新增{len(new_items)})")
                page += 1
                time.sleep(LIST_DELAY)

    final = conn.execute("SELECT COUNT(*) FROM raw_jufair").fetchone()[0]
    conn.close()
    print(f"\n完成！共扫描 {total_pages} 页，新增 {total_new} 条，总计 {final} 条")

if __name__ == "__main__":
    main()
