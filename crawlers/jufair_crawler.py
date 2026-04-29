#!/usr/bin/env python3
"""
jufair.com 聚展网展会数据爬虫
===============================
功能：按品类关键词 + 时间窗口抓取列表页和详情页
输出：写入 SQLite raw_jufair 表
字段输出严格遵循 exhibition_editions schema（PRD §3.1 表B）

适用环境：Mac Mini 北京办公室节点（中国大陆IP可直接访问，无需代理）
"""

import argparse
import sqlite3
import sys
import time
from datetime import datetime

import requests
from bs4 import BeautifulSoup

# ============ 配置 ============
BASE_URL = "https://www.jufair.com"
BASE_DELAY = 3.0   # 基础请求间隔（秒）
MAX_RETRIES = 3
TARGET_YEAR = 2026
RATE_LIMIT_BACKOFF = 15.0  # 触发反爬后的额外等待（秒）
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
    "Referer": "https://www.jufair.com/",
})


# ====================================================================
# HTTP 请求（带反爬缓解）
# ====================================================================

_ua_index = 0
_consecutive_403 = 0


def _rotate_ua():
    global _ua_index
    _ua_index = (_ua_index + 1) % len(USER_AGENTS)
    return USER_AGENTS[_ua_index]


def _jitter_delay(base=BASE_DELAY):
    """随机抖动延迟，避免被检测到固定节奏。"""
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
                print(f"  [!] {label} HTTP 403 (第{attempt}次) 等待{backoff:.0f}s...", end="")
                if attempt < MAX_RETRIES:
                    print()
                    time.sleep(backoff)
                else:
                    print(" 放弃")
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
            print(f"  [!] {label} 异常: {e} (第{attempt}次)", end="")
            if attempt < MAX_RETRIES:
                delay = BASE_DELAY * attempt
                print(f" 等待{delay:.0f}s...")
                time.sleep(delay)
            else:
                print(" 放弃")
                return None
    return None


# ====================================================================
# 数据库 — raw_jufair 表
# ====================================================================

RAW_JUFAIR_SCHEMA = """
    CREATE TABLE IF NOT EXISTS raw_jufair (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        -- 基础字段（来自列表页）
        cn_name TEXT NOT NULL,
        en_name TEXT DEFAULT '',
        date_str TEXT DEFAULT '',              -- exhibition_editions.date_start/date_end 的原始输入
        year INTEGER,                           -- 提取的举办年份
        venue TEXT DEFAULT '',                  -- exhibition_editions.venue
        city TEXT DEFAULT '',                   -- exhibition_editions.city
        area_str TEXT DEFAULT '',               -- exhibition_editions.area_sqm 的原始输入
        visitors_str TEXT DEFAULT '',           -- exhibition_editions.visitors_count 的原始输入
        exhibitors_str TEXT DEFAULT '',         -- exhibition_editions.exhibitors_count 的原始输入
        organizer TEXT DEFAULT '',              -- exhibition_editions.organizer
        cycle TEXT DEFAULT '',                  -- exhibition_editions.frequency
        industry TEXT DEFAULT '',               -- industry_l1/l2 辅助
        -- 溯源
        source_type TEXT NOT NULL DEFAULT '',   -- domestic / international
        source_url TEXT NOT NULL UNIQUE,        -- 详情页URL（主键去重）
        detail_crawled INTEGER DEFAULT 0,       -- 是否已爬详情页
        crawl_batch_id TEXT DEFAULT '',
        crawled_at TEXT DEFAULT (datetime('now'))
    )
"""


def init_db(db_path):
    """创建/打开数据库，确保 raw_jufair 表存在。"""
    conn = sqlite3.connect(db_path)
    conn.execute(RAW_JUFAIR_SCHEMA)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rj_source_url ON raw_jufair(source_url)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rj_batch ON raw_jufair(crawl_batch_id)")
    conn.commit()
    return conn


def get_crawled_urls(conn):
    """返回已爬取的 source_url 集合（用于去重）。"""
    return {r[0] for r in conn.execute("SELECT source_url FROM raw_jufair").fetchall()}


def insert_batch(conn, records, crawled_urls):
    """批量写入 raw_jufair（INSERT OR IGNORE 防重复）。"""
    if not records:
        return 0
    conn.executemany(
        """INSERT OR IGNORE INTO raw_jufair
           (cn_name, en_name, date_str, year, venue, city,
            area_str, visitors_str, exhibitors_str,
            organizer, cycle, industry,
            source_type, source_url, detail_crawled, crawl_batch_id)
           VALUES (:cn_name, :en_name, :date_str, :year, :venue, :city,
                   :area_str, :visitors_str, :exhibitors_str,
                   :organizer, :cycle, :industry,
                   :source_type, :source_url, :detail_crawled, :crawl_batch_id)""",
        records,
    )
    conn.commit()
    for r in records:
        crawled_urls.add(r["source_url"])
    return len(records)


# ====================================================================
# 列表页解析
# ====================================================================

def _extract_year(date_str):
    """从 '2026.11.05-11.10' 格式提取年份。"""
    try:
        parts = date_str.split(".")
        return int(parts[0]) if parts else 0
    except (ValueError, IndexError):
        return 0


def _data_value(container, tag="data"):
    """取容器内 data 元素的文本。"""
    el = container.select_one(tag)
    return el.get_text(strip=True) if el else ""


def _data_with_unit(container):
    """取 'data + .unitText' 拼接值。"""
    val = _data_value(container, "data")
    unit_el = container.select_one(".unitText")
    unit = unit_el.get_text(strip=True) if unit_el else ""
    return val + unit if val else ""


def parse_list_page(html, source_type, crawl_batch_id):
    """
    解析列表页 HTML，返回展会条目列表。
    从 .exh-info-wrap 容器提取 7 个基础字段。
    """
    soup = BeautifulSoup(html, "html.parser")
    articles = soup.select(".exh-info-wrap")
    results = []

    for art in articles:
        a_tag = art.select_one("h2 a")
        if not a_tag:
            continue

        cn_name = a_tag.get_text(strip=True)
        href = a_tag.get("href", "")
        detail_url = BASE_URL + href if href.startswith("/") else href

        en_name = art.select_one(".En_name")
        time_tag = art.select_one("time")
        venue_tag = art.select_one(".pavilion-name")

        date_str = time_tag.get_text(strip=True) if time_tag else ""

        # 统计数据区域
        scale_divs = art.select(".scale-remind")
        area_str = visitors_str = exhibitors_str = ""
        if scale_divs:
            area_str = _data_with_unit(scale_divs[0])
            children = scale_divs[0].select("div")
            if len(children) >= 2:
                visitors_str = _data_with_unit(children[1])
            if len(scale_divs) >= 2:
                exhibitors_str = _data_with_unit(scale_divs[1])

        item = {
            "cn_name": cn_name,
            "en_name": en_name.get_text(strip=True) if en_name else "",
            "date_str": date_str,
            "year": _extract_year(date_str),
            "venue": venue_tag.get_text(strip=True) if venue_tag else "",
            "city": "",
            "area_str": area_str,
            "visitors_str": visitors_str,
            "exhibitors_str": exhibitors_str,
            "organizer": "",
            "cycle": "",
            "industry": "",
            "source_type": source_type,
            "source_url": detail_url,
            "detail_crawled": 0,
            "crawl_batch_id": crawl_batch_id,
        }
        results.append(item)

    return results


def has_target_year(html, year=TARGET_YEAR):
    """页面是否包含目标年份数据。"""
    return f"{year}." in html


# ====================================================================
# 详情页解析
# ====================================================================

def parse_detail_page(detail_url):
    """
    从详情页提取额外字段：主办方、周期、城市、行业、统计数据。
    返回值 dict，仅含非空字段。
    """
    html = fetch_page(detail_url, label=f"详情 {detail_url[-40:]}")
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")
    data = {}

    # --- 从 dl.content-line 提取主办单位/所属行业/举办城市/举办展馆 ---
    for dl in soup.select("dl.content-line"):
        dt = dl.find("dt")
        dd = dl.find("dd")
        if not dt or not dd:
            continue
        label = dt.get_text(strip=True).rstrip(":")
        value = dd.get_text(strip=True)
        if "主办单位" in label:
            data["organizer"] = value
        elif "所属行业" in label:
            links = dd.find_all("a")
            data["industry"] = ", ".join(a.get_text(strip=True) for a in links) if links else value
        elif "举办城市" in label:
            data["city"] = value
        elif "举办展馆" in label and "venue" not in data:
            data["venue"] = value

    # --- 从通用 dl 提取举办周期/展览面积/展商数量/观众数量 ---
    for dl in soup.find_all("dl"):
        dt = dl.find("dt")
        dd = dl.find("dd")
        if not dt or not dd:
            continue
        label = dt.get_text(strip=True)
        value = dd.get_text(strip=True)
        if label == "举办周期":
            data["cycle"] = value
        elif label == "展览面积" and "area_str" not in data:
            data["area_str"] = value
        elif label == "展商数量" and "exhibitors_str" not in data:
            data["exhibitors_str"] = value
        elif label == "观众数量" and "visitors_str" not in data:
            data["visitors_str"] = value

    return data


# ====================================================================
# 爬取逻辑
# ====================================================================

def crawl_month(conn, month, source_type, keyword=None, crawl_detail=False, batch_id=""):
    """
    爬取指定月份的全部展会列表页。
    - month: 1-12
    - source_type: 'domestic' | 'international'
    - keyword: 可选关键词过滤（匹配中文名或英文名）
    - crawl_detail: 是否进详情页补爬额外字段
    """
    type_code = "1" if source_type == "domestic" else "0"
    base_path = f"/exhibition-0-0-{type_code}-0-0-{month:02d}-"
    crawled = get_crawled_urls(conn)
    new_count = 0
    page = 1

    while True:
        url = f"{BASE_URL}{base_path}{page}/"
        label = f"月{month:02d} {source_type} p{page}"
        html = fetch_page(url, label)
        if html is None:
            break
        if not has_target_year(html):
            print(f"    [p{page}] 无{TARGET_YEAR}年数据，停止")
            break

        items = parse_list_page(html, source_type, batch_id)
        if not items:
            print(f"    [p{page}] 无条目，停止")
            break

        # 关键词过滤
        if keyword:
            kw = keyword.lower()
            items = [
                it for it in items
                if kw in it["cn_name"].lower() or kw in it["en_name"].lower()
            ]

        if not items:
            print(f"    [p{page}] 无'{keyword}'匹配，跳过")
            page += 1
            time.sleep(_jitter_delay())
            continue

        # 去重写入
        new_records = [it for it in items if it["source_url"] not in crawled]
        n = insert_batch(conn, new_records, crawled)
        new_count += n

        # 详情页补爬
        detail_ok = 0
        if crawl_detail and new_records:
            for rec in new_records:
                extra = parse_detail_page(rec["source_url"])
                if extra:
                    updates = {k: extra.get(k, "") for k in
                               ["organizer", "city", "cycle", "industry", "area_str", "visitors_str", "exhibitors_str"]}
                    updates["detail_crawled"] = 1
                    updates["source_url"] = rec["source_url"]
                    conn.execute(
                        """UPDATE raw_jufair SET
                           organizer=:organizer, city=:city, cycle=:cycle, industry=:industry,
                           area_str=:area_str, visitors_str=:visitors_str, exhibitors_str=:exhibitors_str,
                           detail_crawled=:detail_crawled
                           WHERE source_url=:source_url""",
                        updates,
                    )
                    detail_ok += 1
                time.sleep(_jitter_delay())
            conn.commit()

        detail_msg = f" 详情{detail_ok}/{len(new_records)}" if crawl_detail else ""
        print(f"    [p{page}] {len(items)}条 → 新增{n}{detail_msg}")

        page += 1
        time.sleep(_jitter_delay())

    return new_count


def crawl_all(db_path, months=None, keyword=None, crawl_detail=False, batch_id=None):
    """全量爬取入口。遍历指定月份，每个月份爬国内+国际。"""
    if batch_id is None:
        batch_id = datetime.now().strftime("jufair_%Y%m%d_%H%M%S")
    if months is None:
        months = list(range(1, 13))

    conn = init_db(db_path)
    total = 0

    for m in sorted(months):
        print(f"\n📅 {TARGET_YEAR}年{m:02d}月")
        for st in ["domestic", "international"]:
            label = "国内" if st == "domestic" else "国际"
            print(f"  [{label}]")
            n = crawl_month(conn, m, st, keyword=keyword, crawl_detail=crawl_detail, batch_id=batch_id)
            total += n
            if n:
                print(f"  ✅ 新增 {n} 条")
            else:
                print(f"  - 无新增")

    conn.close()
    return total, batch_id


# ====================================================================
# 统计与导出
# ====================================================================

def show_stats(db_path):
    """输出 raw_jufair 表统计信息。"""
    conn = sqlite3.connect(db_path)
    total = conn.execute("SELECT COUNT(*) FROM raw_jufair").fetchone()[0]
    detail_crawled = conn.execute("SELECT COUNT(*) FROM raw_jufair WHERE detail_crawled=1").fetchone()[0]
    by_type = conn.execute(
        "SELECT source_type, COUNT(*) FROM raw_jufair GROUP BY source_type"
    ).fetchall()
    batches = conn.execute(
        "SELECT crawl_batch_id, COUNT(*) FROM raw_jufair GROUP BY crawl_batch_id ORDER BY crawl_batch_id"
    ).fetchall()

    # 字段覆盖率
    fields = ["en_name", "date_str", "venue", "city", "area_str", "visitors_str", "exhibitors_str", "organizer", "cycle"]
    coverage = {}
    for f in fields:
        cnt = conn.execute(f"SELECT COUNT(*) FROM raw_jufair WHERE {f} != '' AND {f} IS NOT NULL").fetchone()[0]
        coverage[f] = (cnt, round(cnt / total * 100, 1) if total else 0)

    conn.close()

    print(f"\n{'='*55}")
    print(f"  raw_jufair 统计")
    print(f"{'='*55}")
    print(f"  总记录数:      {total}")
    print(f"  已爬详情页:    {detail_crawled}/{total}")
    for t, c in by_type:
        print(f"  {t}:           {c}")
    print(f"\n  字段覆盖率:")
    for f, (cnt, pct) in coverage.items():
        print(f"    {f:20s}  {cnt:>5d}/{total}  ({pct:>5.1f}%)")
    print(f"\n  批次:")
    for bid, cnt in batches:
        print(f"    {bid}: {cnt} 条")


def export_json(db_path, output_path=None):
    """导出 raw_jufair 为 JSON。"""
    import json
    if output_path is None:
        output_path = db_path.replace(".db", "_all.json")

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT cn_name, en_name, date_str, year, venue, city, "
        "area_str, visitors_str, exhibitors_str, organizer, cycle, industry, "
        "source_type, source_url, detail_crawled, crawl_batch_id, crawled_at "
        "FROM raw_jufair ORDER BY year, date_str, cn_name"
    ).fetchall()
    data = [dict(r) for r in rows]
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"  JSON: {output_path} ({len(data)} 条)")
    return output_path


def export_csv(db_path, output_path=None):
    """导出 raw_jufair 为 CSV。"""
    import csv
    if output_path is None:
        output_path = db_path.replace(".db", "_all.csv")

    conn = sqlite3.connect(db_path)
    rows = conn.execute(
        "SELECT cn_name, en_name, date_str, year, venue, city, "
        "area_str, visitors_str, exhibitors_str, organizer, cycle, industry, source_type "
        "FROM raw_jufair ORDER BY year, date_str, cn_name"
    ).fetchall()

    headers = ["展会中文名", "展会英文名", "举办日期", "年份", "展馆名称", "举办城市",
               "展览面积", "观众数量", "展商数量", "主办方", "举办周期", "所属行业", "来源类型"]
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
        description="jufair.com 聚展网展会数据采集器 (Phase 1 · Hermes 任务1)"
    )
    parser.add_argument("--db", default="jufair_2026.db",
                        help="SQLite 数据库路径 (默认: jufair_2026.db)")
    parser.add_argument("--months", type=int, nargs="+", default=None,
                        help="月份列表，如 --months 5 6 7")
    parser.add_argument("--keyword", type=str, default=None,
                        help="品类关键词过滤（匹配中/英文名）")
    parser.add_argument("--detail", action="store_true",
                        help="同时爬取详情页（补爬主办方/城市/行业等）")
    parser.add_argument("--batch-id", type=str, default=None,
                        help="爬取批次标识")
    parser.add_argument("--all", action="store_true",
                        help="爬取全部12个月")
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

    if not args.months and not args.all:
        parser.print_help()
        print("\n请指定 --months 或 --all 或 --stats 或 --export")
        sys.exit(1)

    if args.all:
        args.months = list(range(1, 13))

    total, batch_id = crawl_all(
        args.db,
        months=args.months,
        keyword=args.keyword,
        crawl_detail=args.detail,
        batch_id=args.batch_id,
    )
    print(f"\n{'='*55}")
    print(f"✅ 任务1 完成！批次: {batch_id}")
    print(f"   共计新增 {total} 条")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
