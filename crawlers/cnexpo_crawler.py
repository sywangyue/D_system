#!/usr/bin/env python3
"""
cnexpo.com 中国会展网展会数据爬虫
===================================
功能：按品类关键词 + 时间窗口抓取列表页和详情页
输出：写入 SQLite raw_cnexpo 表
字段输出严格遵循 exhibition_editions schema（PRD §3.1 表B）

注意：cnexpo 列表页仅包含展会名称和链接，所有数据字段（日期/展馆/面积/展商/观众/主办方）
均需从详情页提取 —— 因此 --detail 是默认行为。

适用环境：Mac Mini 北京办公室节点（中国大陆IP可直接访问）
"""

import argparse
import re
import sqlite3
import sys
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://www.cnexpo.com"
BASE_DELAY = 2.5   # 基础请求间隔（秒）
MAX_RETRIES = 3
RATE_LIMIT_BACKOFF = 15.0
# ============================

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0",
]

SESSION = requests.Session()
SESSION.headers.update({
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "Referer": "https://www.cnexpo.com/",
})

_ua_index = 0
_consecutive_403 = 0


def _rotate_ua():
    global _ua_index
    _ua_index = (_ua_index + 1) % len(USER_AGENTS)
    return USER_AGENTS[_ua_index]


def _jitter_delay(base=BASE_DELAY):
    import random
    return base + random.uniform(-0.5, 1.5)


def fetch_page(url, label="", timeout=25):
    """HTTP GET + 自动重试 + 反爬缓解。"""
    global _consecutive_403
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            SESSION.headers.update({"User-Agent": _rotate_ua()})
            resp = SESSION.get(url, timeout=timeout)
            if resp.status_code == 200:
                _consecutive_403 = 0
                return resp.text
            if resp.status_code == 403:
                _consecutive_403 += 1
                backoff = RATE_LIMIT_BACKOFF * _consecutive_403
                print(f"  [!] {label} HTTP 403 (第{attempt}次) 等待{backoff:.0f}s...")
                if attempt < MAX_RETRIES:
                    time.sleep(backoff)
                else:
                    print("  放弃")
                    _consecutive_403 = 0
                    return None
            else:
                print(f"  [!] {label} HTTP {resp.status_code} (第{attempt}次)")
                if attempt < MAX_RETRIES:
                    time.sleep(BASE_DELAY * attempt)
                else:
                    print("  放弃")
                    return None
        except requests.RequestException as e:
            print(f"  [!] {label} 异常: {e} (第{attempt}次)")
            if attempt < MAX_RETRIES:
                time.sleep(BASE_DELAY * attempt)
            else:
                print("  放弃")
                return None
    return None


# ====================================================================
# 数据库 — raw_cnexpo 表
# ====================================================================

RAW_CNEXPO_SCHEMA = """
    CREATE TABLE IF NOT EXISTS raw_cnexpo (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cn_name TEXT NOT NULL,
        en_name TEXT DEFAULT '',
        date_str TEXT DEFAULT '',
        year INTEGER,
        venue TEXT DEFAULT '',
        city TEXT DEFAULT '',
        area_str TEXT DEFAULT '',
        visitors_str TEXT DEFAULT '',
        exhibitors_str TEXT DEFAULT '',
        organizer TEXT DEFAULT '',
        cycle TEXT DEFAULT '',
        industry TEXT DEFAULT '',
        source_url TEXT NOT NULL UNIQUE,
        crawl_batch_id TEXT DEFAULT '',
        crawled_at TEXT DEFAULT (datetime('now'))
    )
"""


def init_db(db_path):
    conn = sqlite3.connect(db_path)
    conn.execute(RAW_CNEXPO_SCHEMA)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rc_source_url ON raw_cnexpo(source_url)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rc_batch ON raw_cnexpo(crawl_batch_id)")
    conn.commit()
    return conn


def get_crawled_urls(conn):
    return {r[0] for r in conn.execute("SELECT source_url FROM raw_cnexpo").fetchall()}


def insert_batch(conn, records, crawled_urls):
    if not records:
        return 0
    conn.executemany(
        """INSERT OR IGNORE INTO raw_cnexpo
           (cn_name, en_name, date_str, year, venue, city,
            area_str, visitors_str, exhibitors_str,
            organizer, cycle, industry,
            source_url, crawl_batch_id)
           VALUES (:cn_name, :en_name, :date_str, :year, :venue, :city,
                   :area_str, :visitors_str, :exhibitors_str,
                   :organizer, :cycle, :industry,
                   :source_url, :crawl_batch_id)""",
        records,
    )
    conn.commit()
    for r in records:
        crawled_urls.add(r["source_url"])
    return len(records)


# ====================================================================
# 列表页解析
# ====================================================================

def parse_list_page(html):
    """
    解析 cnexpo 列表页，提取展会名称和详情页链接。
    cnexpo 列表页仅包含：名称 + 链接，无其他数据字段。
    """
    soup = BeautifulSoup(html, "html.parser")
    results = []

    for a_tag in soup.find_all("a", href=True):
        href = a_tag["href"]
        if not re.match(r"^/event/\d+(\.html)?$", href):
            continue
        text = a_tag.get_text(strip=True)
        if not text or len(text) < 4:
            continue
        full_url = BASE_URL + href
        # 避免重复链接
        if any(r["source_url"] == full_url for r in results):
            continue
        # 清理名称中的推荐/热门/精选前缀
        clean_name = re.sub(r"^(推荐|热门|精选|头条)\s*", "", text)
        results.append({
            "cn_name": clean_name.strip(),
            "source_url": full_url,
        })

    return results


# ====================================================================
# 详情页解析
# ====================================================================

def _extract_year(date_str):
    """从 '2026.05.06 - 05.08' 格式提取年份。"""
    m = re.search(r"(\d{4})", str(date_str))
    return int(m.group(1)) if m else 0


def parse_detail_page(detail_url):
    """
    从 cnexpo 详情页提取全部字段。
    数据分布在 <p> 标签中，第 2~5 个 <p> 包含结构化信息。
    """
    html = fetch_page(detail_url, label=f"详情 {detail_url[-40:]}")
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    data = {}

    # --- 收集所有非空 <p> 标签文本 ---
    paragraphs = []
    for p in soup.find_all("p"):
        t = p.get_text(strip=True)
        if t:
            paragraphs.append(t)

    # --- 1. 中文名 ---
    h1 = soup.find("h1")
    if h1:
        data["cn_name"] = h1.get_text(strip=True)
    else:
        title_tag = soup.find("title")
        if title_tag:
            t = title_tag.get_text(strip=True)
            data["cn_name"] = re.sub(r"-中国会展网$", "", t).strip()

    # --- 2. 日期 ---
    if len(paragraphs) > 2:
        m = re.search(r"(\d{4}\.\d{2}\.\d{2}\s*-\s*\d{2}\.\d{2})", paragraphs[2])
        if m:
            data["date_str"] = m.group(1)

    # --- 3. 展馆名称（含城市信息）---
    if len(paragraphs) > 3:
        venue_line = paragraphs[3]
        venue_line = re.sub(r"^[\s]+", "", venue_line)
        # 提取城市（城市格式：省份-城市 或 城市-城市）
        city_m = re.match(r"([\u4e00-\u9fff]+)-([\u4e00-\u9fff]+)\s+", venue_line)
        if city_m:
            data["city"] = city_m.group(2)
        # 提取场馆名（去掉城市前缀后的剩余部分）
        venue_m = re.search(r"(?:[\u4e00-\u9fff]+-[\u4e00-\u9fff]+\s+)?(.+)", venue_line)
        if venue_m and venue_m.group(1):
            data["venue"] = venue_m.group(1).strip()

    # --- 4. 主办单位 ---
    if len(paragraphs) > 4:
        m = re.search(r"主办单位[：:](.+)", paragraphs[4])
        if m:
            data["organizer"] = m.group(1).strip()

    # --- 5. 统计数据（面积/展商/观众/周期）---
    if len(paragraphs) > 5:
        stats_line = paragraphs[5]
        m_area = re.search(r"会展面积[：:]\s*([\d,]+平方米)", stats_line)
        if m_area:
            data["area_str"] = "面积:" + m_area.group(1)
        m_exh = re.search(r"展商数量[：:]\s*([\d,]+家)", stats_line)
        if m_exh:
            data["exhibitors_str"] = "展商:" + m_exh.group(1)
        m_vis = re.search(r"观众数量[：:]\s*([\d,]+人)", stats_line)
        if m_vis:
            data["visitors_str"] = "观众:" + m_vis.group(1)
        m_cyc = re.search(r"举办周期[：:]\s*([^\s]+)", stats_line)
        if m_cyc:
            data["cycle"] = m_cyc.group(1)

    # --- 6. 英文名（从页面文本中正则提取）---
    page_text = "\n".join(paragraphs)
    eng_pattern = r"([A-Z][A-Za-z\s/&\-',]+(?:Expo|Exhibition|Fair|Show|Conference|Summit)[A-Za-z\s/&\-',0-9]*)"
    eng_m = re.search(eng_pattern, page_text)
    if eng_m:
        eng = eng_m.group(1).strip()
        if len(eng) > 8 and not re.search(r"[\u4e00-\u9fff]", eng) and len(eng) < 100:
            data["en_name"] = eng

    # --- 年份 ---
    if "date_str" in data:
        data["year"] = _extract_year(data["date_str"])
    else:
        data["year"] = 0

    return data


# ====================================================================
# 爬取逻辑
# ====================================================================

def crawl_list_pages(conn, max_pages=100, keyword=None, batch_id=""):
    """
    遍历 cnexpo 列表页，提取所有展会 URL，再逐个爬详情页。
    cnexpo 没有按月份筛选的 URL 模式，故全量爬取后按年份/关键词过滤。
    """
    crawled = get_crawled_urls(conn)
    new_count = 0
    blanks = 0

    for page in range(1, max_pages + 1):
        url = f"{BASE_URL}/events/1000/0/{page}"
        label = f"列表 p{page}/{max_pages}"
        html = fetch_page(url, label)
        if html is None:
            blanks += 1
            if blanks >= 5:
                print(f"  连续5页无响应，停止")
                break
            continue
        blanks = 0

        items = parse_list_page(html)
        if not items:
            print(f"  [p{page}] 无展会链接，停止")
            break

        # 过滤未爬取的新链接
        new_links = [it for it in items if it["source_url"] not in crawled]
        if not new_links:
            print(f"  [p{page}] {len(items)}条，全部已爬")
            time.sleep(_jitter_delay())
            continue

        print(f"  [p{page}] {len(items)}条展会链接，{len(new_links)}条新")

        # 逐个爬详情页
        page_new = 0
        for item in new_links:
            detail = parse_detail_page(item["source_url"])
            if not detail:
                continue

            # 关键词过滤
            if keyword:
                kw = keyword.lower()
                cn = detail.get("cn_name", "").lower()
                en = detail.get("en_name", "").lower()
                if kw not in cn and kw not in en:
                    continue

            record = {
                "cn_name": detail.get("cn_name", item["cn_name"]),
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
                "source_url": item["source_url"],
                "crawl_batch_id": batch_id,
            }
            n = insert_batch(conn, [record], crawled)
            if n:
                page_new += 1
            time.sleep(_jitter_delay())

        new_count += page_new
        print(f"    → 新增{page_new}条")
        time.sleep(_jitter_delay())

    return new_count


def crawl_all(db_path, max_pages=100, keyword=None, batch_id=None):
    """全量爬取入口。"""
    if batch_id is None:
        batch_id = datetime.now().strftime("cnexpo_%Y%m%d_%H%M%S")

    conn = init_db(db_path)
    total = crawl_list_pages(conn, max_pages=max_pages, keyword=keyword, batch_id=batch_id)
    conn.close()
    return total, batch_id


# ====================================================================
# 统计与导出
# ====================================================================

def show_stats(db_path):
    """输出 raw_cnexpo 表统计信息。"""
    conn = sqlite3.connect(db_path)
    total = conn.execute("SELECT COUNT(*) FROM raw_cnexpo").fetchone()[0]

    fields = ["en_name", "date_str", "venue", "city", "area_str", "visitors_str", "exhibitors_str", "organizer", "cycle"]
    coverage = {}
    for f in fields:
        cnt = conn.execute(f"SELECT COUNT(*) FROM raw_cnexpo WHERE {f} != '' AND {f} IS NOT NULL").fetchone()[0]
        coverage[f] = (cnt, round(cnt / total * 100, 1) if total else 0)

    batches = conn.execute(
        "SELECT crawl_batch_id, COUNT(*) FROM raw_cnexpo GROUP BY crawl_batch_id ORDER BY crawl_batch_id"
    ).fetchall()

    # 按年份分布
    by_year = conn.execute(
        "SELECT year, COUNT(*) FROM raw_cnexpo WHERE year > 0 GROUP BY year ORDER BY year"
    ).fetchall()

    conn.close()

    print(f"\n{'='*55}")
    print(f"  raw_cnexpo 统计")
    print(f"{'='*55}")
    print(f"  总记录数: {total}")
    for y, c in by_year:
        print(f"  {y}年:      {c} 条")
    print(f"\n  字段覆盖率:")
    for f, (cnt, pct) in coverage.items():
        print(f"    {f:20s}  {cnt:>5d}/{total}  ({pct:>5.1f}%)")
    print(f"\n  批次:")
    for bid, cnt in batches:
        print(f"    {bid}: {cnt} 条")


def export_json(db_path, output_path=None):
    import json
    if output_path is None:
        output_path = db_path.replace(".db", "_all.json")
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT cn_name, en_name, date_str, year, venue, city, "
        "area_str, visitors_str, exhibitors_str, organizer, cycle, industry, "
        "source_url, crawl_batch_id, crawled_at "
        "FROM raw_cnexpo ORDER BY year, date_str, cn_name"
    ).fetchall()
    data = [dict(r) for r in rows]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  JSON: {output_path} ({len(data)} 条)")
    return output_path


def export_csv(db_path, output_path=None):
    import csv
    if output_path is None:
        output_path = db_path.replace(".db", "_all.csv")
    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT cn_name, en_name, date_str, year, venue, city, "
        "area_str, visitors_str, exhibitors_str, organizer, cycle, industry "
        "FROM raw_cnexpo ORDER BY year, date_str, cn_name"
    ).fetchall()
    headers = ["展会中文名", "展会英文名", "举办日期", "年份", "展馆名称", "举办城市",
               "展览面积", "观众数量", "展商数量", "主办方", "举办周期", "所属行业"]
    with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(headers)
        w.writerows(rows)
    print(f"  CSV: {output_path} ({len(rows)} 条)")
    return output_path


# ====================================================================
# CLI 入口
# ====================================================================

def main():
    parser = argparse.ArgumentParser(
        description="cnexpo.com 中国会展网数据采集器 (Phase 1 · Hermes 任务2)"
    )
    parser.add_argument("--db", default="cnexpo_2026.db",
                        help="SQLite 数据库路径 (默认: cnexpo_2026.db)")
    parser.add_argument("--max-pages", type=int, default=100,
                        help="最大翻页数 (默认: 100)")
    parser.add_argument("--keyword", type=str, default=None,
                        help="品类关键词过滤")
    parser.add_argument("--batch-id", type=str, default=None,
                        help="爬取批次标识")
    parser.add_argument("--stats", action="store_true",
                        help="显示数据库统计")
    parser.add_argument("--export", action="store_true",
                        help="导出 JSON + CSV")

    args = parser.parse_args()

    if args.stats:
        show_stats(args.db)
        return

    if args.export:
        export_json(args.db)
        export_csv(args.db)
        return

    total, batch_id = crawl_all(
        args.db,
        max_pages=args.max_pages,
        keyword=args.keyword,
        batch_id=args.batch_id,
    )
    print(f"\n{'='*55}")
    print(f"✅ 任务2 完成！批次: {batch_id}")
    print(f"   共计新增 {total} 条")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
