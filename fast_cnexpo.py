#!/usr/bin/env python3
"""cnexpo 快速批量爬取：先扫列表页，再批量爬详情页，支持续传"""
import json
import re
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

_DB_DIR = Path(__file__).resolve().parent
DB = str(_DB_DIR / "cnexpo_2026.db")
MAX_PAGE = 229
BASE = "https://www.cnexpo.com"
BATCH_SIZE = 50  # 每批爬 50 个详情页
DELAY = 2.5

headers = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0.0.0 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
}

session = requests.Session()
session.headers.update(headers)


def init_db():
    conn = sqlite3.connect(DB)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_cnexpo (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cn_name TEXT NOT NULL, en_name TEXT DEFAULT '', date_str TEXT DEFAULT '',
            year INTEGER, venue TEXT DEFAULT '', city TEXT DEFAULT '',
            area_str TEXT DEFAULT '', visitors_str TEXT DEFAULT '',
            exhibitors_str TEXT DEFAULT '', organizer TEXT DEFAULT '',
            cycle TEXT DEFAULT '', industry TEXT DEFAULT '',
            source_url TEXT NOT NULL UNIQUE,
            crawl_batch_id TEXT DEFAULT '', crawled_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rc_url ON raw_cnexpo(source_url)")
    conn.commit()
    return conn


def fetch_urls_from_list_pages():
    """遍历所有列表页，收集所有展会URL"""
    urls = set()
    for p in range(1, MAX_PAGE + 1):
        try:
            r = session.get(f"{BASE}/events/1000/0/{p}", timeout=15)
            if r.status_code != 200:
                print(f"  [p{p}] HTTP {r.status_code}, skip")
                continue
            soup = BeautifulSoup(r.text, "html.parser")
            count = 0
            for a in soup.find_all("a", href=True):
                href = a["href"]
                if re.match(r"^/event/\d+(\.html)?$", href):
                    urls.add(BASE + href)
                    count += 1
            print(f"  [p{p:3d}] {count} links", end="")
            if p % 20 == 0:
                print(f"  (total {len(urls)})")
            else:
                print()
            time.sleep(0.3)
        except Exception as e:
            print(f"  [p{p}] Error: {e}")
    return urls


def crawl_detail(url):
    """爬单个详情页"""
    try:
        r = session.get(url, timeout=15)
        if r.status_code != 200:
            return None
        soup = BeautifulSoup(r.text, "html.parser")
        data = {"source_url": url}

        # 中文名
        h1 = soup.find("h1")
        if h1:
            data["cn_name"] = h1.get_text(strip=True)
        else:
            t = soup.find("title")
            if t:
                data["cn_name"] = re.sub(r"-中国会展网$", "", t.get_text(strip=True)).strip()

        # 段落提取
        paras = [p.get_text(strip=True) for p in soup.find_all("p") if p.get_text(strip=True)]

        if len(paras) > 2:
            m = re.search(r"(\d{4}\.\d{2}\.\d{2}\s*-\s*\d{2}\.\d{2})", paras[2])
            if m:
                data["date_str"] = m.group(1)

        if len(paras) > 3:
            vl = re.sub(r"^[\s]+", "", paras[3])
            cm = re.match(r"([\u4e00-\u9fff]+)-([\u4e00-\u9fff]+)\s+", vl)
            if cm:
                data["city"] = cm.group(2)
            vm = re.search(r"(?:[\u4e00-\u9fff]+-[\u4e00-\u9fff]+\s+)?(.+)", vl)
            if vm and vm.group(1):
                data["venue"] = vm.group(1).strip()

        if len(paras) > 4:
            m = re.search(r"主办单位[：:](.+)", paras[4])
            if m:
                data["organizer"] = m.group(1).strip()

        if len(paras) > 5:
            sl = paras[5]
            for pat, key in [(r"会展面积[：:]\s*([\d,]+平方米)", "area_str"),
                              (r"展商数量[：:]\s*([\d,]+家)", "exhibitors_str"),
                              (r"观众数量[：:]\s*([\d,]+人)", "visitors_str"),
                              (r"举办周期[：:]\s*([^\s]+)", "cycle")]:
                m = re.search(pat, sl)
                if m:
                    data[key] = m.group(1)

        # English name
        pt = "\n".join(paras)
        em = re.search(r"([A-Z][A-Za-z\s/&\-',]+(?:Expo|Exhibition|Fair|Show|Conference|Summit)[A-Za-z\s/&\-',0-9]*)", pt)
        if em:
            eng = em.group(1).strip()
            if len(eng) > 8 and not re.search(r"[\u4e00-\u9fff]", eng) and len(eng) < 100:
                data["en_name"] = eng

        # year
        if "date_str" in data:
            ym = re.search(r"(\d{4})", data["date_str"])
            if ym:
                data["year"] = int(ym.group(1))
        return data
    except Exception as e:
        return None


MAX_CRAWL = 150  # 每次最多爬150个详情页

def main():
    conn = init_db()
    batch_id = f"fast_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

    # 1. Scan all list pages for URLs
    existing = {r[0] for r in conn.execute("SELECT source_url FROM raw_cnexpo").fetchall()}
    print(f"Existing: {len(existing)}")

    print("Scanning all list pages for URLs...")
    all_urls = fetch_urls_from_list_pages()
    new_urls = [u for u in all_urls if u not in existing]
    print(f"\nTotal URLs: {len(all_urls)}, New: {len(new_urls)}")

    if not new_urls:
        print("All caught up!")
        conn.close()
        return

    # 2. Crawl detail pages in batches (limited to MAX_CRAWL per run)
    crawl_urls = new_urls[:MAX_CRAWL]
    print(f"  Crawling {len(crawl_urls)} detail pages this run...")

    for i in range(0, len(crawl_urls), BATCH_SIZE):
        batch = crawl_urls[i:i + BATCH_SIZE]
        batch_added = 0
        for url in batch:
            detail = crawl_detail(url)
            if not detail:
                continue
            rec = {
                "cn_name": detail.get("cn_name", ""),
                "en_name": detail.get("en_name", ""),
                "date_str": detail.get("date_str", ""),
                "year": detail.get("year", 0),
                "venue": detail.get("venue", ""),
                "city": detail.get("city", ""),
                "area_str": detail.get("area_str", ""),
                "visitors_str": detail.get("visitors_str", ""),
                "exhibitors_str": detail.get("exhibitors_str", ""),
                "organizer": detail.get("organizer", ""),
                "cycle": detail.get("cycle", ""),
                "industry": "",
                "source_url": url,
                "crawl_batch_id": batch_id,
            }
            try:
                conn.execute(
                    """INSERT OR IGNORE INTO raw_cnexpo
                       (cn_name, en_name, date_str, year, venue, city, area_str, visitors_str,
                        exhibitors_str, organizer, cycle, industry, source_url, crawl_batch_id)
                       VALUES (:cn_name, :en_name, :date_str, :year, :venue, :city, :area_str,
                               :visitors_str, :exhibitors_str, :organizer, :cycle, :industry,
                               :source_url, :crawl_batch_id)""",
                    rec,
                )
                conn.commit()
                batch_added += 1
            except sqlite3.IntegrityError:
                pass
            time.sleep(DELAY)

        total = conn.execute("SELECT COUNT(*) FROM raw_cnexpo").fetchone()[0]
        pct = (i + BATCH_SIZE) / len(new_urls) * 100
        print(f"  Batch {i//BATCH_SIZE+1}: +{batch_added}  total={total}  ({pct:.0f}%)")

    final = conn.execute("SELECT COUNT(*) FROM raw_cnexpo").fetchone()[0]
    print(f"\nDone! Total: {final}")
    conn.close()


if __name__ == "__main__":
    main()
