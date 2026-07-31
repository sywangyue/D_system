#!/usr/bin/env python3
"""
expofinder.com（展查查）展会数据采集器

为什么要走浏览器而不是 curl：
    展会的真实展商数/观众数/面积、官网 URL、参展商名单**不在服务端渲染的 HTML 里**。
    带登录 cookie 用 curl 抓页面，拿到的内容与未登录逐字段完全一致（实测 diff = 0）。
    这些字段是 hydration 之后前端再调 /expo-finder-web/api/.../page-data-v3 取的，
    而该接口直接请求会 Unauthorized。所以必须让页面自己渲染完再读 DOM。

    浏览器走 gstack 的 browse daemon（headed 常驻），登录态存在它的持久化 profile 里。
    登录是手机号+短信验证码，只能人工做一次；access_token 约 2 小时自动续，
    refresh_token 30 天 —— 即一个月补一次验证码。

限流的坑（务必保留判定逻辑）：
    阿里云 ESA 的速率限制不返回 429，而是**静默降级**成一个 HTTP 200 的
    「需要登录」页面。不做识别就会把大批公开展会误记成「需登录」，
    行数还对得上 —— 静默丢数据。实测 0.4s 间隔必挂、2.5s 稳定，本脚本默认 3s。

合规：
    robots.txt 允许 /detail/，但 Disallow /exhibitor/ 与 /api。
    参展商的名称与 id 从展会页读取，不抓 /exhibitor/{id}，也不直接调接口。

用法:
    python3 crawlers/expofinder_crawler.py --limit 10          # 先跑 10 个
    python3 crawlers/expofinder_crawler.py --all               # 全量（可断点续跑）
    python3 crawlers/expofinder_crawler.py --all --locale en   # 英文版
    python3 crawlers/expofinder_crawler.py --stats
"""
from __future__ import annotations

import argparse
import json
import random
import re
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR / "tools") not in sys.path:
    sys.path.insert(0, str(BASE_DIR / "tools"))
from expofinder_extract import extract  # noqa: E402

BASE_URL = "https://www.expofinder.com"
SITEMAP = f"{BASE_URL}/sitemap-exhibitions.xml"
DB_PATH = BASE_DIR / "data" / "expofinder.db"
BROWSE = Path.home() / ".claude/skills/gstack/browse/dist/browse"

BASE_DELAY = 3.0          # 实测 2.5s 稳定，留余量
RENDER_WAIT = 6.0         # 等 hydration 把解锁字段渲染出来
MAX_WALL_RETRY = 4        # 疑似限流时的重试次数（指数退避）
SESSION_CHECK_EVERY = 50  # 每 N 条校验一次登录态
CIRCUIT_BREAKER = 8       # 连续这么多条异常即判定系统性故障并终止


def _log(msg):
    print(f"[{datetime.now():%H:%M:%S}] {msg}", flush=True)


def _browse(*args, timeout=90):
    r = subprocess.run([str(BROWSE), "--headed", *args],
                       capture_output=True, text=True, timeout=timeout)
    return r.stdout


def init_db(path=DB_PATH):
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS raw_expofinder (
        public_id        TEXT NOT NULL,
        locale           TEXT NOT NULL DEFAULT 'zh',
        name_cn          TEXT DEFAULT '',
        name_en          TEXT DEFAULT '',
        summary          TEXT DEFAULT '',
        date_start       TEXT DEFAULT '',
        date_end         TEXT DEFAULT '',
        location         TEXT DEFAULT '',
        organizer        TEXT DEFAULT '',
        official_website TEXT DEFAULT '',
        -- 统计值保留原始串（"5w+" / "438"），换算留给合并阶段，避免过早丢精度
        stat_exhibitors  TEXT DEFAULT '',
        stat_visitors    TEXT DEFAULT '',
        stat_area        TEXT DEFAULT '',
        stat_countries   TEXT DEFAULT '',
        exhibitor_count  INTEGER DEFAULT 0,
        payload          TEXT NOT NULL,      -- 完整提取结果，便于回溯与二次解析
        crawl_batch_id   TEXT DEFAULT '',
        crawled_at       TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        PRIMARY KEY (public_id, locale)
    );
    CREATE INDEX IF NOT EXISTS idx_ef_date ON raw_expofinder(date_start);
    CREATE TABLE IF NOT EXISTS crawl_state (
        public_id  TEXT NOT NULL,
        locale     TEXT NOT NULL DEFAULT 'zh',
        status     TEXT NOT NULL,            -- ok / wall / error
        attempts   INTEGER NOT NULL DEFAULT 0,
        note       TEXT DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
        PRIMARY KEY (public_id, locale)
    );
    """)
    conn.commit()
    return conn


def fetch_ids():
    """从 sitemap 取全部展会 publicId（中文页；英文页是同一批 id）。"""
    import urllib.request
    req = urllib.request.Request(SITEMAP, headers={"User-Agent": "Mozilla/5.0",
                                                   "Accept-Encoding": "gzip"})
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    if data[:2] == b"\x1f\x8b":
        import gzip
        data = gzip.decompress(data)
    xml = data.decode("utf-8", "replace")
    return sorted(set(re.findall(r"<loc>https://www\.expofinder\.com/detail/([A-Za-z0-9]+)</loc>", xml)))


def is_wall(html: str) -> bool:
    """限流降级页与真·登录墙长得一样：HTTP 200 + 完整 HTML + 「需要登录」。"""
    return "需要登录" in html or "productCategories" not in html


def session_alive(navigate: bool = True) -> bool:
    """判断登录态。

    必须先导航到站内页再判 —— 浏览器可能停在别的页面上。
    access_token 约 2 小时到期，但页面加载时前端会用 refresh_token 自动续，
    并把 refresh_token 滚动续回 30 天（实测）。所以只要定期跑，就不用重新登录。
    """
    if navigate:
        _browse("goto", f"{BASE_URL}/")
        time.sleep(4)
    out = _browse("js", "document.body.innerText.includes('Expo Explorer')")
    return "true" in out.lower()


def crawl_one(conn, pid, locale, batch):
    url = f"{BASE_URL}/detail/{pid}" if locale == "zh" else f"{BASE_URL}/en/detail/{pid}"
    for attempt in range(1, MAX_WALL_RETRY + 1):
        _browse("goto", url)
        time.sleep(RENDER_WAIT)
        html = _browse("html", timeout=120)
        if not is_wall(html):
            rec = extract(html)
            if not rec.get("public_id"):
                rec["public_id"] = pid
            st = rec.get("stats") or {}
            conn.execute("""
                INSERT INTO raw_expofinder
                    (public_id, locale, name_cn, name_en, summary, date_start, date_end,
                     location, organizer, official_website, stat_exhibitors, stat_visitors,
                     stat_area, stat_countries, exhibitor_count, payload, crawl_batch_id)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                ON CONFLICT(public_id, locale) DO UPDATE SET
                    name_cn=excluded.name_cn, name_en=excluded.name_en,
                    summary=excluded.summary, date_start=excluded.date_start,
                    date_end=excluded.date_end, location=excluded.location,
                    organizer=excluded.organizer, official_website=excluded.official_website,
                    stat_exhibitors=excluded.stat_exhibitors, stat_visitors=excluded.stat_visitors,
                    stat_area=excluded.stat_area, stat_countries=excluded.stat_countries,
                    exhibitor_count=excluded.exhibitor_count, payload=excluded.payload,
                    crawl_batch_id=excluded.crawl_batch_id,
                    crawled_at=datetime('now','localtime')
            """, (pid, locale, rec.get("name_cn") or "", rec.get("name_en") or "",
                  rec.get("summary") or "", rec.get("date_start") or "",
                  rec.get("date_end") or "", rec.get("location") or "",
                  rec.get("organizer") or "", rec.get("official_website") or "",
                  st.get("参展商(家)", ""), st.get("专业观众(人)", ""),
                  st.get("展出面积(m2)", ""), st.get("参展商国家及地区(个)", ""),
                  len(rec.get("exhibitors") or []),
                  json.dumps(rec, ensure_ascii=False), batch))
            conn.execute("INSERT INTO crawl_state (public_id, locale, status, attempts) "
                         "VALUES (?,?,'ok',?) ON CONFLICT(public_id, locale) DO UPDATE SET "
                         "status='ok', attempts=excluded.attempts, note='', "
                         "updated_at=datetime('now','localtime')", (pid, locale, attempt))
            conn.commit()
            return "ok", rec
        # 命中墙 —— 先判是限流还是会话掉了，两者处理方式完全不同
        if not session_alive():
            return "session_lost", None
        back = BASE_DELAY * (2 ** attempt) + random.uniform(0, 2)
        _log(f"    ⚠ {pid} 疑似限流降级（第 {attempt} 次），退避 {back:.0f}s")
        time.sleep(back)

    conn.execute("INSERT INTO crawl_state (public_id, locale, status, attempts, note) "
                 "VALUES (?,?,'wall',?,'多次退避后仍是墙，判定为真·需登录') "
                 "ON CONFLICT(public_id, locale) DO UPDATE SET status='wall', "
                 "attempts=excluded.attempts, updated_at=datetime('now','localtime')",
                 (pid, locale, MAX_WALL_RETRY))
    conn.commit()
    return "wall", None


def main():
    ap = argparse.ArgumentParser(description="展查查展会数据采集")
    ap.add_argument("--db", default=str(DB_PATH))
    ap.add_argument("--locale", choices=["zh", "en"], default="zh")
    ap.add_argument("--limit", type=int, help="只跑前 N 个未采集的")
    ap.add_argument("--all", action="store_true", help="跑全部未采集的")
    ap.add_argument("--ids", help="逗号分隔的 publicId，只跑这些")
    ap.add_argument("--redo", action="store_true", help="连已采集的也重跑")
    ap.add_argument("--stats", action="store_true", help="只看统计")
    ap.add_argument("--delay", type=float, default=BASE_DELAY)
    args = ap.parse_args()

    conn = init_db(Path(args.db))

    if args.stats:
        for k, q in [("已采集", "SELECT COUNT(*) FROM raw_expofinder"),
                     ("其中中文", "SELECT COUNT(*) FROM raw_expofinder WHERE locale='zh'"),
                     ("其中英文", "SELECT COUNT(*) FROM raw_expofinder WHERE locale='en'"),
                     ("真·需登录", "SELECT COUNT(*) FROM crawl_state WHERE status='wall'"),
                     ("有官网", "SELECT COUNT(*) FROM raw_expofinder WHERE official_website!=''"),
                     ("有展商数", "SELECT COUNT(*) FROM raw_expofinder WHERE stat_exhibitors!=''"),
                     ("有参展商名单", "SELECT COUNT(*) FROM raw_expofinder WHERE exhibitor_count>0")]:
            print(f"  {k:<14}{conn.execute(q).fetchone()[0]}")
        return

    if not session_alive():
        _log("✗ 未登录。请先在有头浏览器里用手机号+验证码登录，再重跑。")
        sys.exit(1)

    if args.ids:
        ids = [x.strip() for x in args.ids.split(",") if x.strip()]
    else:
        ids = fetch_ids()
        _log(f"sitemap 共 {len(ids)} 个展会")
        if not args.redo:
            done = {r[0] for r in conn.execute(
                "SELECT public_id FROM crawl_state WHERE locale=? AND status IN ('ok','wall')",
                (args.locale,))}
            ids = [i for i in ids if i not in done]
            _log(f"跳过已处理 {len(done)} 个，待采 {len(ids)} 个")
    if args.limit:
        ids = ids[:args.limit]
    if not ids:
        _log("无待采集记录")
        return

    batch = f"ef_{args.locale}_{datetime.now():%Y%m%d_%H%M%S}"
    _log(f"批次 {batch}，{len(ids)} 条，间隔 {args.delay}s，预计 "
         f"{len(ids)*(args.delay+RENDER_WAIT)/3600:.1f} 小时")
    ok = wall = err = 0
    consecutive_bad = 0
    for i, pid in enumerate(ids, 1):
        if i % SESSION_CHECK_EVERY == 0 and not session_alive():
            _log("✗ 停止原因：登录态已失效。重新登录后直接重跑即可断点续采。")
            break
        try:
            status, rec = crawl_one(conn, pid, args.locale, batch)
        except Exception as e:
            # 单页异常不能拖垮整批 —— 记下来继续，但连续失败要熔断
            err += 1
            consecutive_bad += 1
            _log(f"  [{i}/{len(ids)}] {pid} 异常：{type(e).__name__}: {str(e)[:120]}")
            conn.execute("INSERT INTO crawl_state (public_id, locale, status, attempts, note) "
                         "VALUES (?,?,'error',1,?) ON CONFLICT(public_id, locale) DO UPDATE SET "
                         "status='error', note=excluded.note, "
                         "updated_at=datetime('now','localtime')",
                         (pid, args.locale, f"{type(e).__name__}: {str(e)[:200]}"))
            conn.commit()
            if consecutive_bad >= CIRCUIT_BREAKER:
                _log(f"✗ 停止原因：连续 {CIRCUIT_BREAKER} 条异常/失败，判定为系统性故障"
                     f"（站点变更、浏览器挂死或网络中断），已终止。"
                     f"排查后重跑即可断点续采。")
                break
            time.sleep(args.delay * 3)
            continue
        if status == "session_lost":
            _log("✗ 停止原因：登录态已失效。重新登录后直接重跑即可断点续采。")
            break
        if status == "ok":
            consecutive_bad = 0
            ok += 1
            st = rec.get("stats") or {}
            _log(f"  [{i}/{len(ids)}] {pid} {(rec.get('name_cn') or '')[:24]} "
                 f"| 展商{st.get('参展商(家)','—')} 观众{st.get('专业观众(人)','—')} "
                 f"面积{st.get('展出面积(m2)','—')} | 名单{len(rec.get('exhibitors') or [])}")
        else:
            wall += 1
            consecutive_bad += 1
            _log(f"  [{i}/{len(ids)}] {pid} 真·需登录，跳过")
            if consecutive_bad >= CIRCUIT_BREAKER:
                _log(f"✗ 停止原因：连续 {CIRCUIT_BREAKER} 条判定为墙。正常情况下真·需登录"
                     f"的展会是零星分布的，连续命中说明是站点整体策略变更或限流未能恢复，"
                     f"已终止以免把公开数据误标成需登录。")
                break
        time.sleep(args.delay + random.uniform(0, 1.5))

    _log(f"完成：成功 {ok} · 需登录 {wall} · 异常 {err}")
    conn.close()


if __name__ == "__main__":
    main()
