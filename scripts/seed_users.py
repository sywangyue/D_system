"""
seed_users.py — 向 data/mwlab.db 的 user 表插入初始开发账号（bcrypt 密码哈希）。

用法:
    python3 scripts/seed_users.py

幂等：已存在的 email 会跳过。

⚠️ 下列为本地开发用弱口令，生产环境务必改密（见 README「用户与权限」）。
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import bcrypt

DB_PATH = Path(__file__).resolve().parent.parent / "data" / "mwlab.db"

USERS = [
    {
        "email": "admin@mwlab.internal",
        "password": "admin123",
        "role": "admin",
        "display_name": "管理员",
    },
    {
        "email": "manager@mwlab.internal",
        "password": "manager123",
        "role": "manager",
        "display_name": "经理",
    },
    {
        "email": "readonly@mwlab.internal",
        "password": "readonly123",
        "role": "readonly",
        "display_name": "只读用户",
    },
]


def main() -> None:
    conn = sqlite3.connect(str(DB_PATH))
    try:
        existing = set(
            row[0]
            for row in conn.execute("SELECT email FROM user").fetchall()
        )

        inserted = 0
        skipped = 0
        for u in USERS:
            if u["email"] in existing:
                print(f"  SKIP  {u['email']} — 已存在")
                skipped += 1
                continue

            password_hash = bcrypt.hashpw(
                u["password"].encode("utf-8"), bcrypt.gensalt()
            ).decode("utf-8")
            conn.execute(
                """
                INSERT INTO user (email, password_hash, role, display_name, is_active)
                VALUES (?, ?, ?, ?, 1)
                """,
                (u["email"], password_hash, u["role"], u["display_name"]),
            )
            print(f"  OK    {u['email']} (role={u['role']})")
            inserted += 1

        conn.commit()
        print(f"\n完成：插入 {inserted}，跳过 {skipped}")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
