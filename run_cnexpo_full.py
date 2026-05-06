#!/usr/bin/env python3
"""
cnexpo 全量爬取包装器 — 分批执行，自动续爬
每次运行前检查已爬数量，继续下一批
"""
import sqlite3
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
DB = str(_ROOT / "cnexpo_2026.db")
SCRIPT = str(_ROOT / "crawlers" / "cnexpo_crawler.py")
MAX_PAGES = 229
BATCH_PAGES = 20  # 每批爬20页

LOG = str(_ROOT / "cnexpo_crawl_progress.log")


def get_progress():
    conn = sqlite3.connect(DB)
    total = conn.execute("SELECT COUNT(*) FROM raw_cnexpo").fetchone()[0]
    conn.close()
    return total


def main():
    start_total = get_progress()
    print(f"[{datetime.now().isoformat()}] 开始 cnexpo 全量采集")
    print(f"  当前已有: {start_total} 条")
    print(f"  目标: {MAX_PAGES} 页")

    # 单个长进程跑全部
    cmd = [
        sys.executable, SCRIPT,
        "--db", DB,
        "--max-pages", str(MAX_PAGES),
        "--batch-id", f"full_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
    ]

    with open(LOG, "w") as logfile:
        logfile.write(f"[{datetime.now().isoformat()}] Starting cnexpo full crawl\n")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=36000)
        logfile.write(result.stdout)
        if result.stderr:
            logfile.write("\n--- STDERR ---\n")
            logfile.write(result.stderr)

    end_total = get_progress()
    added = end_total - start_total
    print(f"[{datetime.now().isoformat()}] 完成!")
    print(f"  新增: {added} 条")
    print(f"  总计: {end_total} 条")
    print(f"  日志: {LOG}")

    # 输出日志内容
    with open(LOG) as f:
        print(f.read()[-2000:])


if __name__ == "__main__":
    main()
