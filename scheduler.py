#!/usr/bin/env python3
"""
定时任务调度器 · Phase 1 数据采集调度
========================================
策略：
  周一（weekday=0） → 增量爬取（仅爬最近3个月的新增数据）
  每月1日           → 全量爬取（重新抓取所有月份）

写入 crawl_log 表，失败重试3次后告警。

用法：
  python3 scheduler.py --cron       # 自动判断今天该执行什么
  python3 scheduler.py --run-now    # 强制立即执行一次增量+全量
  python3 scheduler.py --status     # 查看最近爬取记录
"""

import argparse
import sqlite3
import subprocess
import sys
import time
from datetime import date, datetime
from pathlib import Path

# ============ 配置 ============
_PROJECT_ROOT = Path(__file__).resolve().parent
PROJECT_DIR = str(_PROJECT_ROOT)
DB_PATH = str(_PROJECT_ROOT / "crawl_scheduler.db")
JUFAIR_DB = str(_PROJECT_ROOT / "jufair_2026.db")
CNEXPO_DB = str(_PROJECT_ROOT / "cnexpo_2026.db")
MAX_RETRIES = 3
RETRY_DELAY = 30  # 重试间隔（秒）
# ============================

CRAWLERS = {
    "jufair": {
        "script": f"{PROJECT_DIR}/crawlers/jufair_crawler.py",
        "db": JUFAIR_DB,
    },
    "cnexpo": {
        "script": f"{PROJECT_DIR}/crawlers/cnexpo_crawler.py",
        "db": CNEXPO_DB,
    },
}


# ====================================================================
# 数据库 — crawl_log 表
# ====================================================================

CRAWL_LOG_SCHEMA = """
    CREATE TABLE IF NOT EXISTS crawl_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crawl_batch_id TEXT NOT NULL,
        source TEXT NOT NULL,              -- jufair / cnexpo
        crawl_type TEXT NOT NULL,           -- incremental / full
        status TEXT NOT NULL DEFAULT 'running',  -- running / completed / failed
        started_at TEXT NOT NULL,
        finished_at TEXT,
        records_added INTEGER DEFAULT 0,
        error_message TEXT DEFAULT '',
        retry_count INTEGER DEFAULT 0
    )
"""


def init_log_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute(CRAWL_LOG_SCHEMA)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cl_batch ON crawl_log(crawl_batch_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_cl_status ON crawl_log(status)")
    conn.commit()
    return conn


def log_start(conn, batch_id, source, crawl_type):
    cursor = conn.execute(
        "INSERT INTO crawl_log (crawl_batch_id, source, crawl_type, started_at) VALUES (?, ?, ?, ?)",
        (batch_id, source, crawl_type, datetime.now().isoformat()),
    )
    conn.commit()
    return cursor.lastrowid


def log_complete(conn, log_id, records_added):
    conn.execute(
        "UPDATE crawl_log SET status='completed', finished_at=?, records_added=? WHERE id=?",
        (datetime.now().isoformat(), records_added, log_id),
    )
    conn.commit()


def log_fail(conn, log_id, error_message, retry_count=0):
    conn.execute(
        "UPDATE crawl_log SET status='failed', finished_at=?, error_message=?, retry_count=? WHERE id=?",
        (datetime.now().isoformat(), error_message[:500], retry_count, log_id),
    )
    conn.commit()


def log_retry(conn, log_id, retry_count):
    conn.execute(
        "UPDATE crawl_log SET retry_count=? WHERE id=?",
        (retry_count, log_id),
    )
    conn.commit()


# ====================================================================
# 调度判断
# ====================================================================

def get_today_type():
    """
    返回今天应执行的爬取类型。
    - 每月1日 → 'full'
    - 周一    → 'incremental'
    - 其他    → None（不执行）
    如果同时满足（每月1日恰好是周一），返回 'full'（全量优先）。
    """
    today = date.today()
    is_first = today.day == 1
    is_monday = today.weekday() == 0  # 0 = Monday

    if is_first:
        return "full"
    if is_monday:
        return "incremental"
    return None


def get_incremental_months():
    """
    增量爬取的范围：最近3个月（含本月）。
    例如 5月底 → [3, 4, 5]
    """
    now = datetime.now()
    current = now.month
    year = now.year
    months = []
    for offset in range(3):
        m = current - offset
        if m <= 0:
            m += 12
            # 如果跨年，不跨（只爬本年可用月份）
            continue
        months.append(m)
    return sorted(months)


def get_full_months():
    """全量爬取范围：本年1~12月。"""
    return list(range(1, 13))


# ====================================================================
# 爬取执行
# ====================================================================

def run_jufair(months, crawl_type, batch_id):
    """
    调用 jufair_crawler.py 爬取指定月份。
    返回 (records_added, error_message)。
    """
    script = CRAWLERS["jufair"]["script"]
    db = CRAWLERS["jufair"]["db"]

    cmd = [
        sys.executable, script,
        "--db", db,
        "--batch-id", f"{batch_id}_jufair",
    ]

    if crawl_type == "incremental":
        # 增量：只爬指定月份，不爬详情页（速度快）
        cmd += ["--months"] + [str(m) for m in months]
    else:
        # 全量：爬全部12个月+详情页
        cmd += ["--all", "--detail"]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=7200,  # 2小时超时
        )
        output = result.stdout + result.stderr

        # 从输出中解析新增条数
        import re
        added = 0
        m = re.search(r"共计新增\s*(\d+)", output)
        if m:
            added = int(m.group(1))

        if result.returncode != 0:
            return added, f"jufair 返回码 {result.returncode}: {output[-200:]}"

        return added, ""

    except subprocess.TimeoutExpired:
        return 0, "jufair 超时（2小时）"
    except Exception as e:
        return 0, f"jufair 异常: {e}"


def run_cnexpo(crawl_type, batch_id):
    """
    调用 cnexpo_crawler.py。
    返回 (records_added, error_message)。
    """
    script = CRAWLERS["cnexpo"]["script"]
    db = CRAWLERS["cnexpo"]["db"]

    cmd = [
        sys.executable, script,
        "--db", db,
        "--batch-id", f"{batch_id}_cnexpo",
    ]

    if crawl_type == "incremental":
        # 增量：只爬前10页（最新展会通常在首页）
        cmd += ["--max-pages", "10"]
    else:
        # 全量：爬取所有页面
        cmd += ["--max-pages", "300"]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True, text=True, timeout=7200,
        )
        output = result.stdout + result.stderr

        import re
        added = 0
        m = re.search(r"共计新增\s*(\d+)", output)
        if m:
            added = int(m.group(1))

        if result.returncode != 0:
            return added, f"cnexpo 返回码 {result.returncode}: {output[-200:]}"

        return added, ""

    except subprocess.TimeoutExpired:
        return 0, "cnexpo 超时（2小时）"
    except Exception as e:
        return 0, f"cnexpo 异常: {e}"


def execute_with_retry(source, crawl_type, batch_id):
    """
    执行一次爬取，失败重试 MAX_RETRIES 次。
    返回 (records_added, final_error)。
    """
    months = get_incremental_months() if crawl_type == "incremental" else get_full_months()
    last_error = ""

    for attempt in range(1, MAX_RETRIES + 1):
        if source == "jufair":
            added, error = run_jufair(months, crawl_type, batch_id)
        else:
            added, error = run_cnexpo(crawl_type, batch_id)

        if not error:
            return added, ""

        last_error = error
        print(f"  [!] {source} 第{attempt}次失败: {error[:100]}")

        if attempt < MAX_RETRIES:
            delay = RETRY_DELAY * attempt
            print(f"      等待{delay}s后重试...")
            time.sleep(delay)

    return 0, last_error


def alert_error(message):
    """告警：打印到 stderr，后续可接入邮件/企业微信/webhook。"""
    print(f"\n*** 告警 *** {message}", file=sys.stderr)


# ====================================================================
# 主流程
# ====================================================================

def run_scheduled(crawl_type, batch_id):
    """执行计划中的爬取任务（两个数据源）。"""
    print(f"\n{'='*55}")
    print(f"  调度执行: {crawl_type.upper()}")
    print(f"  批次:     {batch_id}")
    print(f"  时间:     {datetime.now().isoformat()}")
    print(f"{'='*55}")

    if crawl_type == "incremental":
        print(f"\n  增量范围: {get_incremental_months()} 月")
    else:
        print(f"\n  全量范围: 1~12 月")

    conn = init_log_db()
    has_error = False

    for source in ["jufair", "cnexpo"]:
        print(f"\n--- {source} ---")
        log_id = log_start(conn, batch_id, source, crawl_type)

        added, error = execute_with_retry(source, crawl_type, batch_id)

        if error:
            log_fail(conn, log_id, error, retry_count=MAX_RETRIES)
            alert_error(f"[{source}] {crawl_type} 失败: {error}")
            has_error = True
            print(f"  ❌ {source} 失败: {error[:120]}")
        else:
            log_complete(conn, log_id, added)
            print(f"  ✅ {source} 完成，新增 {added} 条")

    conn.close()

    print(f"\n{'='*55}")
    if has_error:
        print(f"  ⚠️  部分任务失败，请检查 crawl_log")
    else:
        print(f"  🎉 全部完成！批次: {batch_id}")
    print(f"{'='*55}")


def cmd_cron():
    """自动判断今天应该执行什么并执行。"""
    crawl_type = get_today_type()
    if crawl_type is None:
        print(f"今日 ({date.today().isoformat()}) 无计划任务")
        print("  周一 → 增量 | 每月1日 → 全量")
        return

    batch_id = f"{crawl_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    run_scheduled(crawl_type, batch_id)


def cmd_run_now():
    """强制立即执行一次增量+全量。"""
    batch_id = f"manual_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    run_scheduled("full", batch_id)


def cmd_status():
    """查看最近爬取记录。"""
    conn = init_log_db()
    rows = conn.execute(
        """SELECT id, crawl_batch_id, source, crawl_type, status,
                  started_at, finished_at, records_added, error_message, retry_count
           FROM crawl_log
           ORDER BY id DESC LIMIT 20"""
    ).fetchall()

    print(f"\n{'='*70}")
    print(f"  最近爬取记录 (crawl_log)")
    print(f"{'='*70}")

    if not rows:
        print("  (无记录)")
        conn.close()
        return

    for r in rows:
        status_icon = "✅" if r[4] == "completed" else "❌" if r[4] == "failed" else "⏳"
        print(f"  #{r[0]} {status_icon} {r[2]:8s} | {r[3]:12s} | {r[4]:10s} | "
              f"新增{r[7]:>4d}条 | 重试{r[9]}次")
        print(f"      批次: {r[1]}")
        print(f"      开始: {r[5][:19]} | 结束: {r[6][:19] if r[6] else '进行中'}")
        if r[8]:
            print(f"      错误: {r[8][:100]}")
        print()

    conn.close()


def main():
    parser = argparse.ArgumentParser(
        description="定时任务调度器 (Phase 1 · Hermes 任务3)"
    )
    parser.add_argument("--cron", action="store_true",
                        help="自动判断今天该执行什么（周一增量/1号全量）")
    parser.add_argument("--run-now", action="store_true",
                        help="强制立即执行全量爬取")
    parser.add_argument("--status", action="store_true",
                        help="查看最近爬取记录")

    args = parser.parse_args()

    if args.cron:
        cmd_cron()
    elif args.run_now:
        cmd_run_now()
    elif args.status:
        cmd_status()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
