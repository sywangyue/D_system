#!/usr/bin/env python3
"""
clean_brands.py — Phase 05 品牌表清洗

Usage:
    python scripts/clean_brands.py name-en            # CLEAN-NAME-EN
    python scripts/clean_brands.py industry            # CLEAN-INDUSTRY
    python scripts/clean_brands.py mds                 # CLEAN-MDS (stub)
    python scripts/clean_brands.py jufair-l2           # CLEAN-JUFAIR-L2 (stub)
    python scripts/clean_brands.py --dry-run name-en   # Preview only, no writes
    python scripts/clean_brands.py --db /path/to/mwlab.db name-en
"""
from __future__ import annotations

import argparse
import logging
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

# Ensure project root is on sys.path for imports like scripts.data.*
BASE_DIR = Path(__file__).parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

DB_PATH = BASE_DIR / "mwlab.db"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)


# ─── Utilities ────────────────────────────────────────────────────────────────

def backup_table(conn: sqlite3.Connection) -> None:
    """在 UPDATE 前创建 exhibition_brand 表的快照。

    快照表名: exhibition_brand_backup_YYYYMMDD
    如果当天快照已存在则跳过（幂等）。
    """
    today = datetime.now().strftime("%Y%m%d")
    backup_name = f"exhibition_brand_backup_{today}"
    exists = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        (backup_name,),
    ).fetchone()
    if exists:
        log.info("备份表 %s 已存在，跳过", backup_name)
        return
    conn.execute(f"CREATE TABLE {backup_name} AS SELECT * FROM exhibition_brand")
    row_count = conn.execute(f"SELECT COUNT(*) FROM {backup_name}").fetchone()[0]
    log.info("已创建备份表 %s（%d 行）", backup_name, row_count)


# ─── name-en 子命令 ───────────────────────────────────────────────────────────

def cmd_name_en(args: argparse.Namespace) -> None:
    """CLEAN-NAME-EN: 标准化英文名称。

    Step 1: 清除 name_en 中包含中文字符的行（置为空）
    Step 2: 从 name_cn 提取嵌入英文（extract_embedded_en）
    Step 3: 为剩余空行生成标准英文名（generate_name_en）
    """
    from scripts.data.name_en_patterns import extract_embedded_en, generate_name_en

    conn = sqlite3.connect(str(args.db))
    conn.row_factory = sqlite3.Row

    if not args.dry_run:
        backup_table(conn)

    total = conn.execute("SELECT COUNT(*) FROM exhibition_brand").fetchone()[0]
    log.info("总行数: %d", total)

    # Step 1: 清除含中文的 name_en
    log.info("Step 1: 清除含有中文字符的 name_en...")
    if args.dry_run:
        count_dirty = conn.execute(
            "SELECT COUNT(*) FROM exhibition_brand WHERE name_en GLOB '*[一-龥]*'"
        ).fetchone()[0]
        log.info("[DRY-RUN] 将清除 %d 行含中文的 name_en", count_dirty)
        cleared = 0
    else:
        conn.execute(
            "UPDATE exhibition_brand SET name_en = '' WHERE name_en GLOB '*[一-龥]*'"
        )
        cleared = conn.execute("SELECT changes()").fetchone()[0]
    log.info("Step 1 完成: 处理 %d 行", cleared)

    # Step 2: 从 name_cn 提取嵌入英文
    log.info("Step 2: 从 name_cn 提取嵌入英文...")
    rows_empty_en = conn.execute(
        "SELECT brand_id, name_cn FROM exhibition_brand WHERE name_en = '' OR name_en IS NULL"
    ).fetchall()
    extracted = 0
    for row in rows_empty_en:
        en = extract_embedded_en(row["name_cn"] or "")
        if en:
            if args.dry_run:
                log.info("  [DRY-RUN] %s: name_cn=%r -> name_en=%r",
                         row["brand_id"], row["name_cn"], en)
            else:
                conn.execute(
                    "UPDATE exhibition_brand SET name_en = ? WHERE brand_id = ?",
                    (en, row["brand_id"]),
                )
            extracted += 1
    log.info("Step 2 完成: 提取 %d 个嵌入英文名", extracted)

    # Step 3: 为剩余空行生成英文名
    log.info("Step 3: 为剩余空行生成英文名...")
    rows_remaining = conn.execute(
        "SELECT brand_id, name_cn FROM exhibition_brand WHERE name_en = '' OR name_en IS NULL"
    ).fetchall()
    generated = 0
    for row in rows_remaining:
        en = generate_name_en(row["name_cn"] or "")
        if en:
            if args.dry_run:
                log.info("  [DRY-RUN] %s: name_cn=%r -> name_en=%r",
                         row["brand_id"], row["name_cn"], en)
            else:
                conn.execute(
                    "UPDATE exhibition_brand SET name_en = ? WHERE brand_id = ?",
                    (en, row["brand_id"]),
                )
            generated += 1
    log.info("Step 3 完成: 生成 %d 个英文名", generated)

    # 统计
    remaining = conn.execute(
        "SELECT COUNT(*) FROM exhibition_brand WHERE name_en = '' OR name_en IS NULL"
    ).fetchone()[0]
    skipped = total - cleared - extracted - generated - remaining
    log.info(
        "统计: 总行数=%d 清除含中文=%d 提取=%d 生成=%d 剩余=%d 跳过=%d",
        total, cleared, extracted, generated, remaining, skipped,
    )

    if args.dry_run:
        log.info("DRY-RUN 模式: 未写库，全部回滚")
    else:
        conn.commit()
        log.info("已提交变更到数据库")
    conn.close()


# ─── industry 子命令 (stub) ──────────────────────────────────────────────────

def cmd_industry(args: argparse.Namespace) -> None:
    """CLEAN-INDUSTRY: 将 industry_l1 归并为 6 个 MD 类别（stub）。"""
    print("Not yet implemented: industry sub-command")


# ─── mds 子命令 (stub) ────────────────────────────────────────────────────────

def cmd_mds(args: argparse.Namespace) -> None:
    """CLEAN-MDS: 从 Excel 标记 MD 自有品牌（stub）。"""
    print("Not yet implemented: mds sub-command")


# ─── jufair-l2 子命令 (stub) ──────────────────────────────────────────────────

def cmd_jufair_l2(args: argparse.Namespace) -> None:
    """CLEAN-JUFAIR-L2: 爬取 jufair 分类并匹配 L2（stub）。"""
    print("Not yet implemented: jufair-l2 sub-command")


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="MWLAB Phase 05 品牌表清洗",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    for cmd_name, func, help_text in [
        ("name-en", cmd_name_en, "标准化英文名称"),
        ("industry", cmd_industry, "归并 industry_l1 到 6 个 MD 类别"),
        ("mds", cmd_mds, "从 Excel 标记 MD 自有品牌"),
        ("jufair-l2", cmd_jufair_l2, "爬取 jufair 分类并匹配 L2"),
    ]:
        p = sub.add_parser(cmd_name, help=help_text)
        p.add_argument("--db", default=str(DB_PATH), help="目标数据库路径")
        p.add_argument(
            "--dry-run", action="store_true",
            help="预览模式：不写库，仅打印将要执行的变更",
        )
        p.set_defaults(func=func)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
