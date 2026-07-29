#!/usr/bin/env python3
"""
jufair.com 聚展网展会数据爬虫
===============================
功能：按品类关键词 + 时间窗口抓取列表页和详情页
输出：写入 SQLite raw_jufair 表
字段输出严格遵循 exhibition_editions schema（PRD §3.1 表B）

适用环境：Mac Mini 北京办公室节点（中国大陆IP可直接访问；添加 --proxy 支持 Tor SOCKS5）
"""

import argparse
import random
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from bs4 import BeautifulSoup

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))
from tools.url_utils import canonical_source_url
from tools.text_utils import normalize_cjk_spaces

# ============ 配置 ============
BASE_URL = "https://www.jufair.com"
# crawl_log 落主库（看板 /api/setting/status 从这里读），与原始库分开
MAIN_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "mwlab.db"
BASE_DELAY = 3.0   # 基础请求间隔（秒）
MAX_RETRIES = 3
TARGET_YEAR = 2026
RATE_LIMIT_BACKOFF = 15.0  # 触发反爬后的额外等待（秒）
PROXY_URL = "socks5h://127.0.0.1:9050"  # Tor 默认 SOCKS5 端口
_BATCH_PAUSE_EVERY = 50    # 每 N 个请求执行长休止
_BATCH_PAUSE_MIN = 60      # 长休止最小秒数
_BATCH_PAUSE_MAX = 120     # 长休止最大秒数
_CIRCUIT_BREAKER_MAX = 5   # 全局连续失败熔断阈值
# ============================

USER_AGENTS = [
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:128.0) Gecko/20100101 Firefox/128.0",
]

_proxy_enabled = False
# 运行前选定固定 UA（整轮爬取指纹一致）
_fixed_ua = random.choice(USER_AGENTS) if USER_AGENTS else USER_AGENTS[0]


# ====================================================================
# HTTP 请求（带反爬缓解）
# ====================================================================

_consecutive_403 = 0
_global_consecutive_fail = 0  # 全局熔断计数器
_request_count = 0            # 请求计数器（长休止用）


def _jitter_delay(base=BASE_DELAY):
    """随机抖动延迟，避免被检测到固定节奏。"""
    return base + random.uniform(-0.5, 1.5)


def _batch_pause_if_needed():
    """每 BATCH_PAUSE_EVERY 个请求执行长休止。"""
    global _request_count
    _request_count += 1
    if _request_count % _BATCH_PAUSE_EVERY == 0:
        pause = random.uniform(_BATCH_PAUSE_MIN, _BATCH_PAUSE_MAX)
        print(f"  [PAUSE] 已满 {_BATCH_PAUSE_EVERY} 请求，休止 {pause:.0f}s...")
        time.sleep(pause)


def _log(msg: str):
    """带时间戳的日志输出。"""
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{ts}] {msg}")


def _curl_headers():
    """本轮固定 UA + 常规浏览器头。"""
    return [
        f"User-Agent: {_fixed_ua}",
        "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language: zh-CN,zh;q=0.9,en;q=0.8",
        "Referer: https://www.jufair.com/",
    ]


def _curl_fetch(url, timeout=25):
    """用 curl 子进程抓取页面，绕过 requests TLS 指纹检测。

    [AUDIT P0-4] --proxy 必须在此透传，否则开关只是装饰。
    """
    import subprocess as _sp
    cmd = ["curl", "-sL", "--max-time", str(timeout), "--connect-timeout", "10"]
    if _proxy_enabled:
        # socks5h：让代理端做 DNS 解析，避免本地 DNS 泄漏
        cmd += ["--proxy", PROXY_URL]
    for h in _curl_headers():
        cmd += ["-H", h]
    cmd.append(url)
    try:
        r = _sp.run(cmd, capture_output=True, text=True, timeout=timeout + 5)
        return r.stdout if r.returncode == 0 and r.stdout else None
    except Exception:
        return None


# 软封禁判定所用的正常页面特征，按页面类型区分。
# [AUDIT] 此前不分类型，一律用列表页特征判定，导致每个详情页都被误判为封禁、
# 连续 5 次即触发熔断 —— --detail 从来没有成功过（详情覆盖率长期停在 124/5362）。
# 另外原条件写的是 ".exh-info-wrap"（带点的 CSS 选择器），而 HTML 里是
# class="exh-info-wrap" 不带点，该子条件对列表页也恒为假，只是被 pager-box 兜住了。
_PAGE_MARKERS = {
    "list":   ("exh-info-wrap", "pager-box", "page-box", "goods-item-container"),
    "detail": ("content-line", "主办单位", "举办城市", "application/ld+json"),
}


def fetch_page(url, label="", timeout=25, kind="list"):
    """HTTP GET + 自动重试 + 反爬缓解。使用 curl 绕过 TLS 指纹检测。

    kind: 'list' | 'detail' —— 决定用哪组特征判断页面是否正常返回。
    """
    global _consecutive_403, _global_consecutive_fail, _request_count
    _batch_pause_if_needed()
    for attempt in range(1, MAX_RETRIES + 1):
        text = _curl_fetch(url, timeout)
        if text is None:
            _log(f"[!] {label} curl 返回空 (第{attempt}次)")
            _global_consecutive_fail += 1
            if _global_consecutive_fail >= _CIRCUIT_BREAKER_MAX:
                _log(f"[ABORT] 全局连续失败 {_CIRCUIT_BREAKER_MAX} 次，终止运行")
                return None
            if attempt < MAX_RETRIES:
                time.sleep(BASE_DELAY * attempt)
            else:
                _log(f"  放弃 {label}")
                return None
            continue

        # 软封禁检测：按页面类型匹配对应特征，命中任一即视为正常
        markers = _PAGE_MARKERS.get(kind, _PAGE_MARKERS["list"])
        if not any(m in text for m in markers):
            _log(f"[WARN] {label} HTTP 200 但无 {kind} 页特征，疑似封禁/验证码页")
            _global_consecutive_fail += 1
            if _global_consecutive_fail >= _CIRCUIT_BREAKER_MAX:
                _log(f"[ABORT] 全局连续失败 {_CIRCUIT_BREAKER_MAX} 次，终止运行")
                return None
            if attempt < MAX_RETRIES:
                time.sleep(BASE_DELAY * attempt)
            continue

        _consecutive_403 = 0
        _global_consecutive_fail = 0
        return text

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
    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(RAW_JUFAIR_SCHEMA)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rj_source_url ON raw_jufair(source_url)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_rj_batch ON raw_jufair(crawl_batch_id)")
    conn.commit()
    return conn


def get_crawled_urls(conn):
    """返回已爬取的 source_url 集合（用于去重）。"""
    return {r[0] for r in conn.execute("SELECT source_url FROM raw_jufair").fetchall()}


def insert_batch(conn, records, crawled_urls):
    """批量写入 raw_jufair（INSERT OR IGNORE 防重复），返回真实新增行数。"""
    if not records:
        return 0
    before = conn.total_changes
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
    after = conn.total_changes
    actual = after - before
    for r in records:
        crawled_urls.add(r["source_url"])
    return actual


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
    """取 'data + .unitText' 拼接值，为空返回 ''。"""
    val = _data_value(container, "data")
    unit_el = container.select_one(".unitText")
    unit = unit_el.get_text(strip=True) if unit_el else ""
    return val + unit if val else ""


def _scale_field(container, expected_unit_keyword):
    """
    从 .scale-remind 容器提取统计值，单位文本含 expected_unit_keyword 时才返回值。
    expected_unit_keyword: '平方米'/'人'/'家'
    单位不符时置空并 [WARN]。
    """
    raw = _data_with_unit(container)
    if not raw:
        return ""
    unit_el = container.select_one(".unitText")
    unit = unit_el.get_text(strip=True) if unit_el else ""
    if expected_unit_keyword not in unit:
        _log(f"[WARN] 统计字段单位不符（期望含'{expected_unit_keyword}'，实际'{unit}'），置空")
        return ""
    return raw


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
        # 规范化：站点改版后 /exhibition/{id}.html 与 /exhibition/{id}/ 并存，
        # 而 source_url 是 UNIQUE 键，不归一会把同一展会收成两条（AUDIT）
        detail_url = canonical_source_url(BASE_URL + href if href.startswith("/") else href)

        en_name = art.select_one(".En_name")
        time_tag = art.select_one("time")
        venue_tag = art.select_one(".pavilion-name")

        date_str = time_tag.get_text(strip=True) if time_tag else ""

        # 统计数据区域（带单位校验）
        scale_divs = art.select(".scale-remind")
        area_str = visitors_str = exhibitors_str = ""
        if scale_divs:
            area_str = _scale_field(scale_divs[0], "平方米")
            children = scale_divs[0].select("div")
            if len(children) >= 2:
                visitors_str = _scale_field(children[1], "人")
            if len(scale_divs) >= 2:
                exhibitors_str = _scale_field(scale_divs[1], "家")

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
    html = fetch_page(detail_url, label=f"详情 {detail_url[-40:]}", kind="detail")
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

    # [AUDIT 2026-07-29] 「印度新德里」这类词被 HTML 标签从中间切开，
    # get_text() 在标签边界补空格，入库成「印 度新德里」（全库 539 处），
    # 在打标 Excel 里直接暴露给人看。只删汉字之间的空白，英文名的空格保留。
    return {k: normalize_cjk_spaces(v) if isinstance(v, str) else v
            for k, v in data.items()}


# ====================================================================
# 爬取逻辑
# ====================================================================

def crawl_month(conn, month, source_type, keyword=None, crawl_detail=False, batch_id="", crawled=None):
    """
    爬取指定月份的全部展会列表页。
    - month: 1-12
    - source_type: 'domestic' | 'international'
    - keyword: 可选关键词过滤（匹配中文名或英文名）
    - crawl_detail: 是否进详情页补爬额外字段
    - crawled: 已爬 URL 集合（由 crawl_all 统一维护，避免重复查询 DB）
    """
    # [v2] Jufair URL 格式变更（2026-07 发现）：/exhibition-0-0-1-0-0-08-1/ → /n-cn/m-8/
    type_prefix = "n-cn" if source_type == "domestic" else "n-intl"
    if crawled is None:  # [CRWL-19] fallback for direct callers
        crawled = get_crawled_urls(conn)
    new_count = 0
    page = 1

    while True:
        if page == 1:
            url = f"{BASE_URL}/{type_prefix}/m-{month}/"
        else:
            url = f"{BASE_URL}/{type_prefix}/m-{month}/p-{page}/"
        label = f"月{month:02d} {source_type} p{page}"
        html = fetch_page(url, label)
        if html is None:
            break
        if not has_target_year(html):
            _log(f"  [p{page}] 无{TARGET_YEAR}年数据，停止")
            break

        items = parse_list_page(html, source_type, batch_id)
        if not items:
            _log(f"  [p{page}] 无条目，停止")
            break

        # 关键词过滤
        if keyword:
            kw = keyword.lower()
            items = [
                it for it in items
                if kw in it["cn_name"].lower() or kw in it["en_name"].lower()
            ]

        if not items:
            _log(f"  [p{page}] 无'{keyword}'匹配，跳过")
            page += 1
            time.sleep(_jitter_delay())
            continue

        # 去重写入
        new_records = [it for it in items if it["source_url"] not in crawled]
        n = insert_batch(conn, new_records, crawled)
        new_count += n

        # 详情页补爬 —— 只处理本页新增
        #
        # [AUDIT] 原实现在这里额外拉取全表 detail_crawled=0 的记录一并重爬。
        # 该集合当前有 5,238 条，意味着「每爬一个列表页就把全表详情页重扫一遍」：
        # 单页约 4.4 小时，全量 12 个月约 44 天，且 commit 在整个循环之后，
        # 进度完全不可见。存量补爬已拆为独立的 backfill_details()，用 --backfill-detail 触发。
        detail_ok = 0
        if crawl_detail and new_records:
            detail_ok = _crawl_details(conn, [r["source_url"] for r in new_records])

        detail_msg = f" 详情{detail_ok}/{len(new_records)}" if crawl_detail else ""
        _log(f"  [p{page}] {len(items)}条 → 新增{n}{detail_msg}")

        page += 1
        time.sleep(_jitter_delay())

    return new_count


_DETAIL_FIELDS = ("organizer", "city", "cycle", "industry",
                  "area_str", "visitors_str", "exhibitors_str")


def _crawl_details(conn, urls, commit_every=20, label=""):
    """抓取给定 URL 的详情页并回写。返回成功条数。

    每 commit_every 条提交一次，保证长任务中途可见进度、可安全中断。
    """
    ok = 0
    total = len(urls)
    for i, surl in enumerate(urls, 1):
        extra = parse_detail_page(surl)
        if extra:
            non_empty = {k: v for k, v in extra.items() if v and k in _DETAIL_FIELDS}
            if non_empty:
                set_clause = ", ".join(f"{k}=:_{k}" for k in non_empty)
                params = {f"_{k}": v for k, v in non_empty.items()}
                params["_source_url"] = surl
                conn.execute(
                    f"UPDATE raw_jufair SET {set_clause}, detail_crawled=1 "
                    f"WHERE source_url=:_source_url",
                    params,
                )
                ok += 1
            else:
                # 页面取不到任何字段也标记已处理，避免下次重复抓
                conn.execute(
                    "UPDATE raw_jufair SET detail_crawled=1 WHERE source_url=?", (surl,)
                )
        if i % commit_every == 0:
            conn.commit()
            if label:
                _log(f"  {label} 详情进度 {i}/{total}（成功 {ok}）")
        time.sleep(_jitter_delay())
    conn.commit()
    return ok


def backfill_details(db_path, limit=None):
    """独立补爬存量 detail_crawled=0 的记录。

    此前这段逻辑嵌在列表页循环里，每翻一页就全表重扫一次（见 crawl_month 注释）。
    拆出来后可单独运行、可断点续跑（已处理的会置 detail_crawled=1）。
    """
    conn = init_db(db_path)
    try:
        sql = "SELECT source_url FROM raw_jufair WHERE detail_crawled=0"
        if limit:
            sql += f" LIMIT {int(limit)}"
        urls = [r[0] for r in conn.execute(sql).fetchall()]
        if not urls:
            _log("无待补爬记录")
            return 0
        _log(f"待补爬 {len(urls)} 条详情页，预计 {len(urls) * BASE_DELAY / 60:.0f} 分钟")
        ok = _crawl_details(conn, urls, label="[backfill]")
        _log(f"补爬完成：成功 {ok}/{len(urls)}")
        return ok
    finally:
        conn.close()


def _write_crawl_log(_unused_conn, batch_id, status, total_fetched=0, total_inserted=0):
    """写入 crawl_log 记录到主库 data/mwlab.db。

    [AUDIT P1-10] 此前写入的是原始库（jufair_2026.db），而该库并无 crawl_log 表，
    异常又被静默吞掉；看板 /api/setting/status 从主库读，于是"最近爬取"恒为 null。
    crawl_log 是给看板看的运营数据，必须落主库。
    第一个参数保留仅为兼容既有调用点，不再使用。
    """
    from datetime import datetime as dt
    now = dt.now().strftime("%Y-%m-%d %H:%M:%S")
    try:
        conn = sqlite3.connect(str(MAIN_DB_PATH))
        conn.execute("PRAGMA foreign_keys = ON")
    except Exception as e:
        _log(f"[WARN] crawl_log 无法连接主库 {MAIN_DB_PATH}: {e}")
        return
    try:
        if status == "running":
            conn.execute(
                "INSERT INTO crawl_log(batch_id, source_site, status, started_at) "
                "VALUES (?, 'jufair', ?, ?)",
                (batch_id, status, now),
            )
        else:
            conn.execute(
                "UPDATE crawl_log SET status=?, finished_at=?, total_fetched=?, total_inserted=? "
                "WHERE batch_id=?",
                (status, now, total_fetched, total_inserted, batch_id),
            )
        conn.commit()
    except Exception as e:
        # 不再静默：写不进日志表是运维问题，必须可见
        _log(f"[WARN] crawl_log 写入失败 (batch={batch_id}, status={status}): {e}")
    finally:
        conn.close()


def crawl_all(db_path, months=None, keyword=None, crawl_detail=False, batch_id=None):
    """全量爬取入口。遍历指定月份，每个月份爬国内+国际。"""
    if batch_id is None:
        batch_id = datetime.now().strftime("jufair_%Y%m%d_%H%M%S")
    if months is None:
        months = list(range(1, 13))

    conn = init_db(db_path)
    _write_crawl_log(conn, batch_id, "running")
    total = 0
    aborted = False

    try:
        crawled = get_crawled_urls(conn)  # [CRWL-19] fetch once, pass into month loops
        for m in sorted(months):
            _log(f"\n📅 {TARGET_YEAR}年{m:02d}月")
            for st in ["domestic", "international"]:
                if aborted:
                    break
                label = "国内" if st == "domestic" else "国际"
                _log(f"  [{label}]")
                n = crawl_month(conn, m, st, keyword=keyword, crawl_detail=crawl_detail, batch_id=batch_id, crawled=crawled)
                total += n
                if n:
                    _log(f"  ✅ 新增 {n} 条")
                else:
                    _log(f"  - 无新增")
            if aborted:
                break
    except Exception as e:
        _log(f"  [EXCEPTION] {e}")
        _write_crawl_log(conn, batch_id, "failed", total_fetched=0, total_inserted=total)
        conn.close()
        raise

    conn.close()
    return total, batch_id, aborted


# ====================================================================
# 统计与导出
# ====================================================================

def show_stats(db_path):
    """输出 raw_jufair 表统计信息。"""
    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA foreign_keys = ON")
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

    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA foreign_keys = ON")
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

    conn = sqlite3.connect(db_path, timeout=30)
    conn.execute("PRAGMA foreign_keys = ON")
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
    # 必须在任何读取之前声明（argparse 的 default=TARGET_YEAR 就是一次读取）
    global TARGET_YEAR, _proxy_enabled

    parser = argparse.ArgumentParser(
        description="jufair.com 聚展网展会数据采集器 (Phase 1 · Hermes 任务1)"
    )
    parser.add_argument("--db", default="data/jufair_2026.db",
                        help="SQLite 数据库路径 (默认: jufair_2026.db)")
    parser.add_argument("--months", type=int, nargs="+", default=None,
                        help="月份列表，如 --months 5 6 7")
    parser.add_argument("--keyword", type=str, default=None,
                        help="品类关键词过滤（匹配中/英文名）")
    parser.add_argument("--detail", action="store_true",
                        help="同时爬取详情页（补爬主办方/城市/行业等）")
    parser.add_argument("--batch-id", type=str, default=None,
                        help="爬取批次标识")
    parser.add_argument("--year", type=int, default=TARGET_YEAR,
                        help="目标年份（默认 2026）")
    parser.add_argument("--proxy", action="store_true",
                        help="通过 Tor SOCKS5 代理请求（需提前启动 Tor）")
    parser.add_argument("--all", action="store_true",
                        help="爬取全部12个月")
    parser.add_argument("--stats", action="store_true",
                        help="显示数据库统计")
    parser.add_argument("--backfill-detail", action="store_true",
                        help="只补爬存量 detail_crawled=0 的详情页（可断点续跑）")
    parser.add_argument("--limit", type=int, default=None,
                        help="配合 --backfill-detail 限制本次条数")
    parser.add_argument("--export", action="store_true",
                        help="导出 JSON + CSV")

    args = parser.parse_args()

    if args.stats:
        show_stats(args.db)
        return

    if args.backfill_detail:
        backfill_details(args.db, limit=args.limit)
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

    # [AUDIT] 原为 `import crawlers.jufair_crawler as _self` 再改其属性。
    # 以脚本方式执行时 sys.path[0] 是 crawlers/，crawlers 包不可导入 →
    # ModuleNotFoundError，即 `python3 crawlers/jufair_crawler.py` 从来跑不通。
    # 自身模块的模块级变量用 global 改即可（已在函数首行声明），无需自导入。
    TARGET_YEAR = args.year
    if args.proxy:
        _proxy_enabled = True
        try:
            r = requests.get("https://check.torproject.org/api/ip",
                           proxies={"http": PROXY_URL, "https": PROXY_URL},
                           timeout=10)
            result = r.json()
            if result.get("IsTor"):
                _log(f"🔒 Tor 代理已启用 (IP: {result.get('IP', 'unknown')})")
            else:
                _log("⚠️ 代理未通过 Tor 验证，退出")
                sys.exit(1)
        except Exception as e:
            _log(f"❌ 代理连接失败: {e}，退出")
            _proxy_enabled = False
            sys.exit(1)

    total, batch_id, aborted = crawl_all(
        args.db,
        months=args.months,
        keyword=args.keyword,
        crawl_detail=args.detail,
        batch_id=args.batch_id,
    )

    conn = sqlite3.connect(args.db)
    conn.execute("PRAGMA foreign_keys = ON")
    _write_crawl_log(conn, batch_id, "failed" if aborted else ("success" if total > 0 else "partial"),
                     total_fetched=0, total_inserted=total)
    conn.close()

    _log(f"\n{'='*55}")
    if total == 0:
        _log(f"⚠ 全部失败（批次: {batch_id}）")
        sys.exit(1)
    elif aborted:
        _log(f"⚠ 部分失败，共新增 {total} 条（批次: {batch_id}）")
        sys.exit(2)
    else:
        _log(f"✅ 任务完成！批次: {batch_id}")
        _log(f"   共计新增 {total} 条")
        _log(f"{'='*55}")


if __name__ == "__main__":
    main()
