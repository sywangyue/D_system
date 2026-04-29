#!/usr/bin/env python3
"""
聚展网 2026 年展会数据爬虫（v3 - Tor 代理版）
=============================================
策略说明：
- 5月~12月（未过期）：月筛直接显示 2026 年数据，用按月分页爬取
- 1月~4月（已过期）：月筛跳到了 2027 年，需从全量视图（month=0）中提取
- 使用 curl + Tor SOCKS5 代理绕过 IP 黑名单

数据库：SQLite at jufair_2026.db
"""

import sqlite3
import time
import re
import sys
import subprocess
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://www.jufair.com"
DB_PATH = "/Volumes/databoard/AI Project/Mds_cc_do/jufair_2026.db"
REQUEST_DELAY = 3.0
DOMESTIC_MAX_PAGES = 122
INTERNATIONAL_MAX_PAGES = 300
TARGET_YEAR = "2026"
MAX_RETRIES = 3
# ============================

CURL_BASE = [
    "curl", "-s", "--socks5-hostname", "127.0.0.1:9050", "--max-time", "30",
    "-A", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "-H", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "-H", "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8",
    "-H", "Referer: https://www.jufair.com/",
    "--compressed",
]

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:122.0) Gecko/20100101 Firefox/122.0",
]
_ua_idx = 0


def _rotate_ua():
    global _ua_idx
    _ua_idx = (_ua_idx + 1) % len(USER_AGENTS)
    return USER_AGENTS[_ua_idx]


def fetch_page(url, label=""):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            cmd = CURL_BASE.copy()
            ua = _rotate_ua() if attempt > 1 else USER_AGENTS[0]
            cmd[cmd.index("-A") + 1] = ua
            cmd.append(url)

            r = subprocess.run(cmd, capture_output=True, text=True, timeout=35)
            if r.returncode == 0 and r.stdout and "403 Forbidden" not in r.stdout[:500]:
                return r.stdout

            err = "返回403" if "403 Forbidden" in (r.stdout or "")[:500] else f"curl码{r.returncode}"
            print(f"  [!] {label} {err} (第{attempt}次)", end="")
            if attempt < MAX_RETRIES:
                w = REQUEST_DELAY * 2 * attempt
                print(f" 等待{w:.0f}s...")
                time.sleep(w)
            else:
                print(" 放弃")
                return None
        except subprocess.TimeoutExpired:
            print(f"  [!] {label} 超时 (第{attempt}次)", end="")
            if attempt < MAX_RETRIES:
                time.sleep(REQUEST_DELAY * attempt)
            else:
                print(" 放弃")
                return None
        except Exception as e:
            print(f"  [!] {label} 异常: {e}")
            return None
    return None


# ============ 数据库 ============

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS exhibitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cn_name TEXT NOT NULL,
            en_name TEXT DEFAULT '',
            date TEXT DEFAULT '',
            venue TEXT DEFAULT '',
            area TEXT DEFAULT '',
            visitors TEXT DEFAULT '',
            exhibitors TEXT DEFAULT '',
            source_type TEXT NOT NULL,
            source_url TEXT NOT NULL UNIQUE,
            crawled_at TEXT DEFAULT (datetime('now'))
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ex_surl ON exhibitions(source_url)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ex_date ON exhibitions(date)")
    conn.commit()
    return conn


def get_crawled_urls(conn):
    return {r[0] for r in conn.execute("SELECT source_url FROM exhibitions").fetchall()}


# ============ 页面解析 ============

def parse_exhibition(article, source_type):
    result = {"source_type": source_type}

    a_tag = article.select_one("h2 a")
    result["cn_name"] = a_tag.get_text(strip=True) if a_tag else ""

    en_tag = article.select_one(".En_name")
    result["en_name"] = en_tag.get_text(strip=True) if en_tag else ""

    time_tag = article.select_one("time")
    result["date"] = time_tag.get_text(strip=True) if time_tag else ""

    venue_tag = article.select_one(".pavilion-name")
    result["venue"] = venue_tag.get_text(strip=True) if venue_tag else ""

    scale_divs = article.select(".scale-remind")
    if scale_divs:
        first_div = scale_divs[0]
        area_data = first_div.select_one("data")
        area_unit = first_div.select_one(".unitText")
        if area_data and area_unit:
            result["area"] = f"{area_data.get_text(strip=True)}{area_unit.get_text(strip=True)}"
        elif area_data:
            result["area"] = area_data.get_text(strip=True)
        else:
            result["area"] = ""

        divs_in_first = first_div.select("div")
        if len(divs_in_first) >= 2:
            v_data = divs_in_first[1].select_one("data")
            v_unit = divs_in_first[1].select_one(".unitText")
            if v_data and v_unit:
                result["visitors"] = f"{v_data.get_text(strip=True)}{v_unit.get_text(strip=True)}"
            elif v_data:
                result["visitors"] = v_data.get_text(strip=True)
            else:
                result["visitors"] = ""
        else:
            result["visitors"] = ""

        if len(scale_divs) >= 2:
            second_div = scale_divs[1]
            exh_data = second_div.select_one("data")
            exh_unit = second_div.select_one(".unitText")
            if exh_data and exh_unit:
                result["exhibitors"] = f"{exh_data.get_text(strip=True)}{exh_unit.get_text(strip=True)}"
            elif exh_data:
                result["exhibitors"] = exh_data.get_text(strip=True)
            else:
                result["exhibitors"] = ""
        else:
            result["exhibitors"] = ""
    else:
        result["area"] = result["visitors"] = result["exhibitors"] = ""

    href = a_tag.get("href", "") if a_tag else ""
    result["source_url"] = BASE_URL + href if href.startswith("/") else href
    return result


def parse_page(html, source_type):
    soup = BeautifulSoup(html, "html.parser")
    articles = soup.select(".exh-info-wrap")
    results = []
    for art in articles:
        item = parse_exhibition(art, source_type)
        if item["date"].startswith(TARGET_YEAR):
            results.append(item)
    return results


def has_2026_data(html):
    return f"{TARGET_YEAR}." in html


def _extract_month(date_str):
    if not date_str.startswith(TARGET_YEAR):
        return 0
    parts = date_str.split(".")
    try:
        return int(parts[1]) if len(parts) >= 2 else 0
    except ValueError:
        return 0


def insert_batch(conn, batch, crawled):
    if not batch:
        return 0
    conn.executemany(
        """INSERT OR IGNORE INTO exhibitions
           (cn_name, en_name, date, venue, area, visitors, exhibitors, source_type, source_url)
           VALUES (:cn_name, :en_name, :date, :venue, :area, :visitors, :exhibitors, :source_type, :source_url)""",
        batch,
    )
    conn.commit()
    for it in batch:
        crawled.add(it["source_url"])
    return len(batch)


# ============ 爬取 ============

def crawl_monthly(conn, month, source_type):
    type_code = "1" if source_type == "domestic" else "0"
    base_path = f"/exhibition-0-0-{type_code}-0-0-{month}-"
    crawled = get_crawled_urls(conn)
    new_count = 0

    html = fetch_page(f"{BASE_URL}{base_path}1/", f"月筛{month:02d} {source_type} p1")
    if html is None:
        return 0

    items = parse_page(html, source_type)
    if not items:
        return 0

    batch = [it for it in items if it["source_url"] not in crawled]
    n = insert_batch(conn, batch, crawled)
    new_count += n
    print(f"    第1页: {len(items)} 条 (新增{n})")

    page = 1
    while True:
        page += 1
        html = fetch_page(f"{BASE_URL}{base_path}{page}/", f"月筛{month:02d} {source_type} p{page}")
        if html is None:
            break
        if not has_2026_data(html):
            print(f"    第{page}页: 无更多2026数据，停止")
            break
        items = parse_page(html, source_type)
        if not items:
            print(f"    第{page}页: 无2026数据，停止")
            break
        batch = [it for it in items if it["source_url"] not in crawled]
        n = insert_batch(conn, batch, crawled)
        new_count += n
        print(f"    第{page}页: {len(items)} 条 (新增{n})")
        time.sleep(REQUEST_DELAY)

    return new_count


def crawl_allview(conn, source_type, max_pages=122, target_months=None):
    type_code = "1" if source_type == "domestic" else "0"
    base_path = f"/exhibition-0-0-{type_code}-0-0-0-"
    crawled = get_crawled_urls(conn)
    new_count = 0
    blanks = 0

    for page in range(1, max_pages + 1):
        html = fetch_page(f"{BASE_URL}{base_path}{page}/", f"全量{source_type} p{page}/{max_pages}")
        if html is None:
            break
        if not has_2026_data(html):
            blanks += 1
            if blanks >= 5:
                print(f"    连续5页无2026数据，停止（翻到第{page}页）")
                break
            continue
        blanks = 0

        items = parse_page(html, source_type)
        if target_months:
            items = [it for it in items if _extract_month(it["date"]) in target_months]
        if not items:
            continue

        batch = [it for it in items if it["source_url"] not in crawled]
        n = insert_batch(conn, batch, crawled)
        new_count += n
        print(f"    第{page}/{max_pages}页: {n} 新增 (共{len(items)}条2026)")

        time.sleep(REQUEST_DELAY)

    return new_count


# ============ 导出 ============

def show_stats(conn):
    total = conn.execute("SELECT COUNT(*) FROM exhibitions").fetchone()[0]
    by_type = conn.execute("SELECT source_type, COUNT(*) FROM exhibitions GROUP BY source_type").fetchall()
    by_month = conn.execute("SELECT substr(date, 1, 7) as ym, COUNT(*) FROM exhibitions GROUP BY ym ORDER BY ym").fetchall()
    print(f"\n{'='*50}")
    print(f"  数据库统计")
    print(f"{'='*50}")
    print(f"  总记录数: {total}")
    for t, c in by_type:
        print(f"    {t}: {c}")
    print(f"  按月分布:")
    for ym, c in by_month:
        print(f"    {ym}: {c} 条")


def export_json(conn):
    import json
    rows = conn.execute(
        "SELECT cn_name, en_name, date, venue, area, visitors, exhibitors, source_type, source_url "
        "FROM exhibitions ORDER BY date, cn_name"
    ).fetchall()
    columns = ["cn_name", "en_name", "date", "venue", "area", "visitors", "exhibitors", "source_type", "source_url"]
    data = [dict(zip(columns, row)) for row in rows]
    out = "/Volumes/databoard/AI Project/Mds_cc_do/jufair_2026_all.json"
    with open(out, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"\n  📄 JSON: {out} ({len(data)} 条)")


def export_csv(conn):
    import csv
    rows = conn.execute(
        "SELECT cn_name, en_name, date, venue, area, visitors, exhibitors, source_type "
        "FROM exhibitions ORDER BY date, cn_name"
    ).fetchall()
    out = "/Volumes/databoard/AI Project/Mds_cc_do/jufair_2026_all.csv"
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["展会中文名", "展会英文名", "举办日期", "展馆名称", "展览面积", "观众数量", "展商数量", "来源类型"])
        w.writerows(rows)
    print(f"  📄 CSV: {out} ({len(rows)} 条)")


# ============ 命令 ============

def cmd_batch(label, months_upcoming, months_past):
    print(f"\n{'='*60}")
    print(f"  批次: {label}")
    print(f"{'='*60}")
    conn = init_db()
    total = 0

    for m in months_upcoming:
        print(f"\n  📅 {TARGET_YEAR}年{m:02d}月（月筛）")
        for st in ["domestic", "international"]:
            label_t = "国内" if st == "domestic" else "国际"
            print(f"    [{label_t}]")
            n = crawl_monthly(conn, m, st)
            if n:
                total += n
                print(f"    ✅ 新增 {n} 条")
            else:
                print(f"    - 无新增")

    for m in months_past:
        print(f"\n  📅 {TARGET_YEAR}年{m:02d}月（全量补爬）")
        for st in ["domestic", "international"]:
            label_t = "国内" if st == "domestic" else "国际"
            print(f"    [{label_t}]")
            mp = DOMESTIC_MAX_PAGES if st == "domestic" else INTERNATIONAL_MAX_PAGES
            n = crawl_allview(conn, st, max_pages=mp, target_months=[m])
            if n:
                total += n
                print(f"    ✅ 新增 {n} 条")
            else:
                print(f"    - 无新增")

    conn.close()
    print(f"\n  ✅ {label} 完成，共新增 {total} 条")
    return total


def cmd_fix_past():
    return cmd_batch("补爬1~4月", [], [1, 2, 3, 4])


def cmd_all():
    total = 0
    total += cmd_batch("01月~04月（全量补爬）", [], [1, 2, 3, 4])
    total += cmd_batch("05月~08月（月筛）", [5, 6, 7, 8], [])
    total += cmd_batch("09月~12月（月筛）", [9, 10, 11, 12], [])
    print(f"\n{'='*60}")
    print(f"  🎉 全部完成！累计 {total} 条")
    print(f"{'='*60}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("用法: python crawl_jufair.py <命令>")
        print()
        print("命令:")
        print("  batch1      爬取 05月~08月（月筛）")
        print("  batch2      爬取 09月~12月（月筛）")
        print("  fix-past    补爬 01月~04月（全量视图）")
        print("  all         全部一次性完成")
        print("  stats       查看数据库统计")
        print("  export      导出 JSON + CSV")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "batch1":
        cmd_batch("05月~08月", [5, 6, 7, 8], [])
    elif cmd == "batch2":
        cmd_batch("09月~12月", [9, 10, 11, 12], [])
    elif cmd == "fix-past":
        cmd_fix_past()
    elif cmd == "all":
        cmd_all()
    elif cmd == "stats":
        conn = init_db()
        show_stats(conn)
        conn.close()
    elif cmd == "export":
        conn = init_db()
        export_json(conn)
        export_csv(conn)
        conn.close()
    else:
        print(f"未知命令: {cmd}")
