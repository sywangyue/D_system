"""Continue crawling remaining months for jufair 2026 data via Tor proxy"""
import subprocess, time, sqlite3
from bs4 import BeautifulSoup

BASE = "https://www.jufair.com"
DB = "/Volumes/databoard/AI Project/Mds_cc_do/jufair_2026.db"
CURL = [
    "curl", "-s", "--socks5-hostname", "127.0.0.1:9050", "--max-time", "30",
    "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "-H", "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8",
    "-H", "Referer: https://www.jufair.com/",
    "--compressed",
]

def fetch(url, label=""):
    r = subprocess.run(CURL + [url], capture_output=True, text=True, timeout=35)
    if r.returncode == 0 and r.stdout and "403 Forbidden" not in r.stdout[:500]:
        return r.stdout
    print(f"  [!] {label} failed (rc={r.returncode})")
    return None

def parse_page(html, stype):
    soup = BeautifulSoup(html, "html.parser")
    results = []
    for art in soup.select(".exh-info-wrap"):
        a = art.select_one("h2 a")
        if not a:
            continue
        cn = a.get_text(strip=True)
        en = (art.select_one(".En_name") or type("",(),{"get_text":lambda s:""})()).get_text(strip=True)
        dt = (art.select_one("time") or type("",(),{"get_text":lambda s:""})()).get_text(strip=True)
        if not dt.startswith("2026"):
            continue
        ve = (art.select_one(".pavilion-name") or type("",(),{"get_text":lambda s,**kw:""})()).get_text(strip=True)
        sds = art.select(".scale-remind")
        ar = vi = ex = ""
        if sds:
            d1 = sds[0].select_one("data")
            u1 = sds[0].select_one(".unitText")
            ar = f"{d1.get_text(strip=True)}{u1.get_text(strip=True)}" if d1 and u1 else (d1.get_text(strip=True) if d1 else "")
            divs = sds[0].select("div")
            if len(divs) >= 2:
                vd = divs[1].select_one("data")
                vu = divs[1].select_one(".unitText")
                vi = f"{vd.get_text(strip=True)}{vu.get_text(strip=True)}" if vd and vu else (vd.get_text(strip=True) if vd else "")
            if len(sds) >= 2:
                ed = sds[1].select_one("data")
                eu = sds[1].select_one(".unitText")
                ex = f"{ed.get_text(strip=True)}{eu.get_text(strip=True)}" if ed and eu else (ed.get_text(strip=True) if ed else "")
        href = a.get("href", "")
        results.append((cn, en, dt, ve, ar, vi, ex, stype, BASE + href if href.startswith("/") else href))
    return results

conn = sqlite3.connect(DB)
crawled = {r[0] for r in conn.execute("SELECT source_url FROM exhibitions").fetchall()}
total_new = 0

for month in [11, 12]:
    for stype, code in [("domestic","1"), ("international","0")]:
        path = f"/exhibition-0-0-{code}-0-0-{month}-"
        page = 1
        print(f"\n--- {stype} {month:02d}/2026 ---")
        while True:
            html = fetch(f"{BASE}{path}{page}/", f"M{month:02d} {stype} p{page}")
            if not html:
                break
            if "2026." not in html:
                print(f"  p{page}: no 2026 data, stop")
                break
            items = parse_page(html, stype)
            if not items:
                print(f"  p{page}: 0 items, stop")
                break
            batch = [it for it in items if it[8] not in crawled]
            if batch:
                conn.executemany(
                    "INSERT OR IGNORE INTO exhibitions (cn_name, en_name, date, venue, area, visitors, exhibitors, source_type, source_url) VALUES (?,?,?,?,?,?,?,?,?)",
                    batch)
                conn.commit()
                for it in batch:
                    crawled.add(it[8])
                total_new += len(batch)
            print(f"  p{page}: {len(items)} items (+{len(batch)})")
            page += 1
            time.sleep(2.5)

print(f"\n=== Nov+Dec done, +{total_new} new ===")

# Now also try to catch remaining from all-view for Jan-Apr
print("\n--- All-view catchup for Jan-Apr ---")
for stype, code in [("domestic","1"), ("international","0")]:
    path = f"/exhibition-0-0-{code}-0-0-0-"
    for page in range(1, 50):  # just try first 50 pages
        if total_new > 100:  # if we got enough, skip all-view
            break
        html = fetch(f"{BASE}{path}{page}/", f"all {stype} p{page}")
        if not html or "2026." not in html:
            continue
        items = parse_page(html, stype)
        # only keep Jan-Apr
        items = [it for it in items if it[2].startswith("2026") and int(it[2].split(".")[1]) <= 4]
        if not items:
            continue
        batch = [it for it in items if it[8] not in crawled]
        if batch:
            conn.executemany(
                "INSERT OR IGNORE INTO exhibitions (cn_name, en_name, date, venue, area, visitors, exhibitors, source_type, source_url) VALUES (?,?,?,?,?,?,?,?,?)",
                batch)
            conn.commit()
            for it in batch:
                crawled.add(it[8])
            total_new += len(batch)
            print(f"  all {stype} p{page}: +{len(batch)} (Jan-Apr)")
        time.sleep(2.5)

conn.close()
print(f"\n✅ Total new records: {total_new}")
