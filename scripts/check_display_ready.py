#!/usr/bin/env python3
"""
display_ready 检查脚本
=======================
扫描 exhibition_brand 表，按展示池最低条件标记 display_ready。

条件：
  - name_cn 非空
  - organizer 非空
  - name_cn 不含中英文混排（排除数据异常）
  - industry_l1 非空
  - competition_relation 非空

满足全部条件的设 display_ready = 1，否则设 0。
加入 crontab 每周跑一次，数据补全后自动进入展示池。

用法：
  python3 scripts/check_display_ready.py        # 正常执行
  python3 scripts/check_display_ready.py --dry  # 只报告，不实际写入
"""

import sqlite3
import sys
import os
from datetime import datetime

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DB_PATH = os.path.join(PROJECT_ROOT, "mwlab.db")

CONDITIONS = """
    (name_cn IS NOT NULL AND name_cn != '')
    AND (organizer IS NOT NULL AND organizer != '')
    AND name_cn NOT GLOB '*[A-Za-z]*[! -~]*'
    AND (industry_l1 IS NOT NULL AND industry_l1 != '')
    AND (competition_relation IS NOT NULL AND competition_relation != '')
"""


def ensure_column(conn):
    """确保 exhibition_brand 表有 display_ready 列，没有则添加。"""
    cols = [row[1] for row in conn.execute("PRAGMA table_info(exhibition_brand)")]
    if "display_ready" not in cols:
        conn.execute("ALTER TABLE exhibition_brand ADD COLUMN display_ready INTEGER NOT NULL DEFAULT 0")
        conn.commit()
        print("  [i] display_ready 列已添加")


def scan(conn):
    """扫描记录，返回统计结果。"""
    total = conn.execute("SELECT COUNT(*) FROM exhibition_brand").fetchone()[0]
    display_ready = conn.execute(
        f"SELECT COUNT(*) FROM exhibition_brand WHERE {CONDITIONS}"
    ).fetchone()[0]
    pending = total - display_ready
    return total, display_ready, pending


def update(conn):
    """更新 display_ready 标记。"""
    conn.execute(
        f"UPDATE exhibition_brand SET display_ready = 1 WHERE {CONDITIONS}"
    )
    conn.execute(
        "UPDATE exhibition_brand SET display_ready = 0 WHERE NOT ({})".format(CONDITIONS)
    )
    conn.commit()


def main():
    dry_run = "--dry" in sys.argv

    conn = sqlite3.connect(DB_PATH)
    ensure_column(conn)

    total, display_ready, pending = scan(conn)

    if not dry_run:
        update(conn)

    conn.close()

    print(f"\n{'='*45}")
    print(f"  display_ready 报告")
    print(f"  时间: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*45}")
    print(f"  总记录数:     {total:>6} 条")
    print(f"  可展示:       {display_ready:>6} 条")
    print(f"  待补全:       {pending:>6} 条")
    print(f"  展示率:       {display_ready/total*100:>5.1f}%" if total > 0 else "  展示率:       N/A")
    print(f"{'='*45}")

    if dry_run:
        print("  (DRY RUN · 未写入)")
    else:
        print(f"  ✅ 已更新 {display_ready} 条为 display_ready = 1，{pending} 条为 0")

    if pending > 0:
        print(f"\n  提示: 有 {pending} 条记录数据不完整，补全后将在下周自动进入展示池。")

    return 0 if display_ready > 0 else 1


if __name__ == "__main__":
    main()
