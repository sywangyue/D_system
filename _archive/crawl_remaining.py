"""Quick crawl: just Nov international + Dec"""
import subprocess
import time
import sqlite3
from pathlib import Path

from bs4 import BeautifulSoup

BASE = "https://www.jufair.com"
_REPO_ROOT = Path(__file__).resolve().parent.parent
DB = str(_REPO_ROOT / "jufair_2026.db")
CURL = [
    "curl", "-s", "--socks5-hostname", "127.0.0.1:9050", "--max-time", "25",
    "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "-H", "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8",
    "-H", "Referer: https://www.jufair.com/",
    "--compressed",
]

def fetch(url):
    r = subprocess.run(CURL + [url], capture_output=True, text=True, timeout=30)
    if r.returncode == 0 and r.stdout and "403 Forbidden" not in r.stdout[:500]:
        return r.stdout
    return None

def parse_page(html, stype):
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for art in soup.select(".exh-info-wrap"):
        a = art.select_one("h2 a")
        if not a:
            continue
        cn = a.get_text(strip=True)
        en_tag = art.select_one(".En_name")
        en = en_tag.get_text(strip=True) if en_tag else ""
        dt_tag = art.select_one("time")
        dt = dt_tag.get_text(strip=True) if dt_tag else ""
        if not dt.startswith("2026"):
            continue
        ve_tag = art.select_one(".pavilion-name")
        ve = ve_tag.get_text(strip=True) if ve_tag else ""
        sds = art.select(".scale-remind")
        ar = vi = ex = ""
        if sds:
            d1 = sds[0].select_one("data")
            u1 = sds[0].select_one(".unitText")
            if d1:
                ar = d1.get_text(strip=True) + (u1.get_text(strip=True) if u1 else "")
            divs = sds[0].select("div")
            if len(divs) >= 2:
                vd = divs[1].select_one("data")
                vu = divs[1].select_one(".unitText")
                if vd:
                    vi = vd.get_text(strip=True) + (vu.get_text(strip=True) if vu else "")
            if len(sds) >= 2:
                ed = sds[1].select_one("data")
                eu = sds[1].select_one(".unitText")
                if ed:
                    ex = ed.get_text(strip=True) + (eu.get_text(strip=True) if eu else "")
        href = a.get("href", "")
        results.append((cn, en, dt, ve, ar, vi, ex, stype, BASE + href if href.startswith("/") else href))
    return results

conn = sqlite3.connect(DB)
crawled = {r[0] for r in conn.execute("SELECT source_url FROM exhibitions").fetchall()}
total = 0

for month, stype, code in [
    (11, "international", "0"),  # Nov international
    (12, "domestic", "1"),       # Dec domestic
    (12, "international", "0"),  # Dec international
]:
    path = f"/exhibition-0-0-{code}-0-0-{month}-"
    page = 1
    print(f"M{month:02d} {stype}:")
    while True:
        html = fetch(f"{BASE}{path}{page}/")
        if not html:
            print(f"  p{page}: fail -> stop")
            break
        if "2026." not in html:
            print(f"  p{page}: no 2026 -> stop")
            break
        items = parse_page(html, stype)
        if not items:
            print(f"  p{page}: 0 items -> stop")
            break
        batch = [it for it in items if it[8] not in crawled]
        if batch:
            conn.executemany(
                "INSERT OR IGNORE INTO exhibitions (cn_name, en_name, date, venue, area, visitors, exhibitors, source_type, source_url) VALUES (?,?,?,?,?,?,?,?,?)",
                batch)
            conn.commit()
            for it in batch:
                crawled.add(it[8])
            total += len(batch)
        print(f"  p{page}: {len(items)} items (+{len(batch)})")
        page += 1
        time.sleep(3)

conn.close()
print(f"\nTotal new: {total}")
