#!/usr/bin/env python3
"""Run cnexpo crawl in a tight loop, 10 min per iteration."""
import subprocess
import sqlite3
import sys
import time
from datetime import datetime
from pathlib import Path

_ROOT = Path(__file__).resolve().parent
DB = str(_ROOT / "cnexpo_2026.db")
SCRIPT = str(_ROOT / "crawlers" / "cnexpo_crawler.py")

for i in range(20):
    before = sqlite3.connect(DB).execute("SELECT COUNT(*) FROM raw_cnexpo").fetchone()[0]
    print(f"\n[{datetime.now().isoformat()}] Iteration {i+1}/20, before={before}")
    r = subprocess.run(
        [sys.executable, SCRIPT, "--db", DB, "--max-pages", "229"],
        capture_output=True, text=True, timeout=700,
    )
    after = sqlite3.connect(DB).execute("SELECT COUNT(*) FROM raw_cnexpo").fetchone()[0]
    added = after - before
    print(f"  added={added}, total={after}, last_output={r.stdout[-200:] if r.stdout else ''}")
    if added == 0 and i > 0:
        print("  No new records, done!")
        break
print(f"\nFinal: {after}")
