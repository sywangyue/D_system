"""
fix_audit_data.py — 一次性生产数据清洗脚本

对 mwlab.db 执行三类修复（默认 dry-run）：
  - fix_data_source：去重 exhibition_edition.data_source 中的重复段
  - fix_truncated_cities：恢复被截断的四字城市名
  - report_provenance：预览 007 迁移将删除的 data_provenance 重复行

用法：
    python3 tools/fix_audit_data.py                # dry-run（默认，作用于 data/mwlab.db）
    python3 tools/fix_audit_data.py --apply        # 实际写库
    python3 tools/fix_audit_data.py --db /path/to/other.db --apply
"""
import argparse
import sqlite3
import sys
from pathlib import Path

# 确保项目根目录在 sys.path 中，使 tools.geo_dict 可导入
_project_root = Path(__file__).resolve().parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))
from tools.geo_dict import CN_CITIES


def fix_data_source(conn: sqlite3.Connection, dry_run: bool) -> dict:
    """去重 data_source 中的重复段。"""
    rows = conn.execute(
        "SELECT rowid, edition_id, data_source FROM exhibition_edition WHERE data_source LIKE '%/%'"
    ).fetchall()

    fixed = []
    for row in rows:
        parts = row['data_source'].split('/')
        deduped = '/'.join(dict.fromkeys(parts))
        if deduped != row['data_source']:
            fixed.append((row['rowid'], row['edition_id'], row['data_source'], deduped))

    if not dry_run:
        conn.executemany(
            "UPDATE exhibition_edition SET data_source = ? WHERE rowid = ?",
            [(r[3], r[0]) for r in fixed]
        )

    return {'total_checked': len(rows), 'fixed': len(fixed), 'samples': fixed[:10]}


def fix_truncated_cities(conn: sqlite3.Connection, dry_run: bool) -> dict:
    """恢复被截断的四字城市名。"""
    # 从 CN_CITIES 构建映射：浩特→呼和浩特（仅映射值唯一时修复）
    suffix_map: dict[str, str] = {}
    for city in CN_CITIES:
        if len(city) == 4:
            suffix = city[2:]  # 后两字
            if suffix in suffix_map:
                suffix_map[suffix] = None  # 标记歧义
            else:
                suffix_map[suffix] = city

    fixed_edition = []
    ambiguous = []
    for table, col in [('exhibition_edition', 'city'), ('exhibition_brand', 'city')]:
        rows = conn.execute(
            f"SELECT rowid, {col} as val FROM {table} WHERE {col} IS NOT NULL AND {col} != ''"
        ).fetchall()
        for row in rows:
            val = row['val']
            repair = suffix_map.get(val)
            if repair:
                fixed_edition.append((row['rowid'], table, val, repair))
            elif val in suffix_map and suffix_map[val] is None:
                ambiguous.append((row['rowid'], table, val))

        if not dry_run and fixed_edition:
            for r in fixed_edition:
                if r[1] == table:
                    conn.execute(
                        f"UPDATE {table} SET {col} = ? WHERE rowid = ?",
                        (r[3], r[0])
                    )

    return {
        'fixed': len(fixed_edition),
        'ambiguous': len(ambiguous),
        'samples': fixed_edition[:10],
        'ambiguous_samples': ambiguous[:10],
    }


def report_provenance(conn: sqlite3.Connection) -> dict:
    """报告 data_provenance 中 (brand_id, source_url) 重复组统计。"""
    dup_groups = conn.execute("""
        SELECT brand_id, source_url, COUNT(*) as cnt, MIN(rowid) as keep_rowid
        FROM data_provenance
        GROUP BY brand_id, source_url
        HAVING cnt > 1
        ORDER BY cnt DESC
    """).fetchall()

    total_keep = len(dup_groups)
    total_delete = sum(r['cnt'] - 1 for r in dup_groups)

    # 取前 10 组样例，每组显示保留行和将删行的 url/source_site
    samples = []
    for g in dup_groups[:10]:
        rows = conn.execute(
            "SELECT rowid, source_site, crawl_batch_id FROM data_provenance "
            "WHERE brand_id = ? AND source_url = ? ORDER BY rowid",
            (g['brand_id'], g['source_url'])
        ).fetchall()
        kept = rows[0]
        deleted = [dict(r) for r in rows[1:]]
        samples.append({
            'brand_id': g['brand_id'],
            'source_url': g['source_url'],
            'count': g['cnt'],
            'kept': dict(kept),
            'to_delete': deleted,
        })

    return {
        'total_groups': total_keep + (conn.execute(
            "SELECT COUNT(*) FROM (SELECT 1 FROM data_provenance GROUP BY brand_id, source_url HAVING COUNT(*) = 1)"
        ).fetchone()[0]),
        'duplicate_groups': total_keep,
        'total_delete': total_delete,
        'samples': samples,
    }


def main():
    parser = argparse.ArgumentParser(description='清洗生产库存量数据')
    parser.add_argument('--db', default=str(_project_root / 'data' / 'mwlab.db'),
                        help='目标数据库路径（默认 data/mwlab.db）')
    parser.add_argument('--apply', action='store_true', help='实际写库（默认 dry-run）')
    args = parser.parse_args()

    db_path = Path(args.db)
    if not db_path.exists():
        print(f"错误：数据库不存在 {db_path}")
        sys.exit(1)

    dry_run = not args.apply
    print(f"{'DRY-RUN' if dry_run else 'APPLY'} | 数据库: {db_path}")

    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row

    try:
        print("\n=== 1. fix_data_source ===")
        r1 = fix_data_source(conn, dry_run)
        print(f"   检查 {r1['total_checked']} 行 | 修复 {r1['fixed']} 行")
        for s in r1['samples']:
            print(f"   {s[1]}: {s[2]} → {s[3]}")

        print("\n=== 2. fix_truncated_cities ===")
        r2 = fix_truncated_cities(conn, dry_run)
        print(f"   修复 {r2['fixed']} 行 | 歧义跳过 {r2['ambiguous']} 行")
        for s in r2['samples']:
            print(f"   {s[0]}({s[1]}): {s[2]} → {s[3]}")
        if r2['ambiguous_samples']:
            for s in r2['ambiguous_samples']:
                print(f"   [歧义] {s[0]}({s[1]}): {s[2]}")

        print("\n=== 3. report_provenance (007 DELETE 预览) ===")
        r3 = report_provenance(conn)
        print(f"   总(唯一)组数: {r3['total_groups']}")
        print(f"   重复组数: {r3['duplicate_groups']}")
        print(f"   将删行数: {r3['total_delete']}")
        for s in r3['samples']:
            print(f"   {s['brand_id']} | {s['source_url']} | cnt={s['count']}")
            print(f"     保留: rowid={s['kept']['rowid']} site={s['kept']['source_site']}")
            for d in s['to_delete']:
                print(f"     删除: rowid={d['rowid']} site={d['source_site']}")

        if not dry_run:
            conn.commit()
            print(f"\n✅ 已写入数据库 (共 {r1['fixed'] + r2['fixed']} 行改动)")

    finally:
        conn.close()


if __name__ == '__main__':
    main()
