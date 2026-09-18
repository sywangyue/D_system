#!/usr/bin/env python3
"""改某个账号的登录密码。

为什么需要它：系统里**没有任何改密码的途径** —— 登录接口只校验不修改，
个人资料页没有这个功能，`seed_users.py` 是幂等的（账号已存在就跳过，改不了密码）。
在此之前只能手写 SQL 直接改库。

用法:
  python3 scripts/set_password.py admin@mwlab.internal          # 交互式输入，不留 shell 历史
  python3 scripts/set_password.py admin@mwlab.internal --show   # 改完回显一次，用于抄给同事
  python3 scripts/set_password.py --list                        # 只看有哪些账号

⚠️ 改的是**本地库** `data/mwlab.db`。本地库是唯一数据源，改完要同步到服务器才在线上生效：
     sqlite3 data/mwlab.db ".backup /tmp/mwlab_upload.db"
     rsync -avz -e "ssh -i ~/.ssh/MWlab.pem" /tmp/mwlab_upload.db \
       admin@47.79.17.71:/home/admin/dashboard/data/mwlab.db
     ssh -i ~/.ssh/MWlab.pem admin@47.79.17.71 \
       "source ~/.nvm/nvm.sh && pm2 reload mwlab-dashboard"
   见 docs/DEPLOY.md「同步数据库」。
"""
import argparse
import getpass
import sqlite3
import sys
from pathlib import Path

import bcrypt

ROOT = Path(__file__).resolve().parent.parent
DB = ROOT / "data" / "mwlab.db"

# 与线上登录页的提示一致：太短的密码挡住，别让公网系统上出现 123456
MIN_LEN = 8


def main() -> int:
    ap = argparse.ArgumentParser(description="改账号登录密码")
    ap.add_argument("email", nargs="?", help="要改的账号邮箱")
    ap.add_argument("--db", default=str(DB), help=f"数据库路径（默认 {DB}）")
    ap.add_argument("--show", action="store_true", help="改完回显一次明文")
    ap.add_argument("--list", action="store_true", help="只列出账号，不改")
    ap.add_argument("--force", action="store_true", help="允许短于 8 位的密码")
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    rows = conn.execute("SELECT user_id, email, role, is_active FROM user ORDER BY user_id").fetchall()
    if args.list or not args.email:
        print(f"{args.db} 里的账号：\n")
        for r in rows:
            state = "启用" if r["is_active"] else "停用"
            print(f"  {r['user_id']}  {r['email']:<28} {r['role']:<9} {state}")
        if not args.email:
            print("\n改密码：python3 scripts/set_password.py <邮箱>")
        return 0

    email = args.email.strip().lower()
    user = conn.execute("SELECT user_id, email, role FROM user WHERE lower(email) = ?", (email,)).fetchone()
    if user is None:
        print(f"✗ 没有这个账号：{args.email}", file=sys.stderr)
        print("  现有账号：" + "、".join(r["email"] for r in rows), file=sys.stderr)
        return 1

    pw = getpass.getpass(f"给 {user['email']}（{user['role']}）设新密码: ")
    if not pw:
        print("✗ 密码为空，没改", file=sys.stderr)
        return 1
    if len(pw) < MIN_LEN and not args.force:
        print(f"✗ 密码短于 {MIN_LEN} 位。线上是公网可访问的，别用弱密码。", file=sys.stderr)
        print("  确实要用短密码：加 --force", file=sys.stderr)
        return 1
    if pw != getpass.getpass("再输一次确认: "):
        print("✗ 两次不一致，没改", file=sys.stderr)
        return 1

    hashed = bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    conn.execute(
        "UPDATE user SET password_hash = ? WHERE user_id = ?",
        (hashed, user["user_id"]),
    )
    conn.commit()
    conn.close()

    print(f"\n✓ 已改 {user['email']} 的密码")
    if args.show:
        print(f"  明文：{pw}")
    print("\n⚠️ 改的是本地库。线上生效要同步数据库并重启服务，见本文件头部或 docs/DEPLOY.md。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
