"""
tests/conftest.py — 共享测试 fixtures

93 条样本数据来源：
  - 从 jufair_2026.db exhibitions 表取 88 行（映射到 raw_jufair schema）
  - 5 行注入脏数据变种（覆盖边界场景）
  - cnexpo 侧：取其中 20 行做镜像，覆盖双源合并逻辑
"""
import sqlite3
import sys
import os
import re
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from schema.db import init_db

PROJECT_DIR   = Path(__file__).parent.parent
JUFAIR_SRC_DB = PROJECT_DIR / "jufair_2026.db"

# ── 脏数据注入场景 ─────────────────────────────────────────────────────────────
DIRTY_VARIANTS = [
    # (替换字段, 脏值, 说明)
    ('area_str',       '面积:10,000平方米',        'cnexpo格式前缀'),
    ('visitors_str',   '观众:5.0万人',             '小数万单位'),
    ('exhibitors_str', '展商：300，家',             '全角逗号噪音'),
    ('date_str',       '2026年05月06日~05月08日',   '中文日期格式'),
    ('cn_name',        '  上海国际机床展  ',        '首尾空白'),
]


def build_raw_jufair_fixture(conn: sqlite3.Connection) -> None:
    """从 jufair_2026.db 读取 88 条，加 5 条脏数据，写入 raw_jufair。"""
    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_jufair (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            cn_name         TEXT NOT NULL,
            en_name         TEXT DEFAULT '',
            date_str        TEXT DEFAULT '',
            year            INTEGER,
            venue           TEXT DEFAULT '',
            city            TEXT DEFAULT '',
            area_str        TEXT DEFAULT '',
            visitors_str    TEXT DEFAULT '',
            exhibitors_str  TEXT DEFAULT '',
            organizer       TEXT DEFAULT '',
            cycle           TEXT DEFAULT '',
            industry        TEXT DEFAULT '',
            source_type     TEXT DEFAULT '',
            source_url      TEXT NOT NULL UNIQUE,
            detail_crawled  INTEGER DEFAULT 0,
            crawl_batch_id  TEXT DEFAULT '',
            crawled_at      TEXT DEFAULT (datetime('now'))
        )
    """)

    if not JUFAIR_SRC_DB.exists():
        # fallback: 生成合成记录
        _insert_synthetic_jufair(conn, 88)
    else:
        src = sqlite3.connect(str(JUFAIR_SRC_DB))
        src.row_factory = sqlite3.Row
        rows = src.execute("SELECT * FROM exhibitions LIMIT 88").fetchall()
        src.close()
        for r in rows:
            _insert_raw_jufair_row(conn, dict(r), 'TEST-BATCH-001')

    # 注入 5 条脏数据
    for i, (field, dirty_val, _desc) in enumerate(DIRTY_VARIANTS):
        base = {
            'cn_name':        f'脏数据展{i+1}',
            'en_name':        'DIRTY',
            'date_str':       '2026.06.01-06.03',
            'year':           2026,
            'venue':          '测试展馆',
            'city':           '上海上海',
            'area_str':       '5万平方米',
            'visitors_str':   '3万人',
            'exhibitors_str': '200家',
            'organizer':      '测试主办方',
            'cycle':          '1年1届',
            'industry':       '测试行业',
            'source_type':    'domestic',
            'source_url':     f'https://www.jufair.com/dirty/{i+9000}.html',
            'crawl_batch_id': 'TEST-BATCH-001',
        }
        base[field] = dirty_val
        _insert_raw_jufair_row(conn, base, 'TEST-BATCH-001')


def build_raw_cnexpo_fixture(
    conn: sqlite3.Connection,
    jufair_conn: sqlite3.Connection | None = None
) -> None:
    """
    取 jufair 前 20 条做 cnexpo 镜像，覆盖双源合并逻辑。
    jufair_conn: 含 raw_jufair 表的连接（可与 conn 不同）。
    """
    conn.execute("""
        CREATE TABLE IF NOT EXISTS raw_cnexpo (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            cn_name         TEXT NOT NULL,
            en_name         TEXT DEFAULT '',
            date_str        TEXT DEFAULT '',
            year            INTEGER,
            venue           TEXT DEFAULT '',
            city            TEXT DEFAULT '',
            area_str        TEXT DEFAULT '',
            visitors_str    TEXT DEFAULT '',
            exhibitors_str  TEXT DEFAULT '',
            organizer       TEXT DEFAULT '',
            cycle           TEXT DEFAULT '',
            industry        TEXT DEFAULT '',
            source_url      TEXT NOT NULL UNIQUE,
            crawl_batch_id  TEXT DEFAULT '',
            crawled_at      TEXT DEFAULT (datetime('now'))
        )
    """)
    src = jufair_conn if jufair_conn is not None else conn
    rows = src.execute("SELECT * FROM raw_jufair LIMIT 20").fetchall()
    col_names = [d[0] for d in src.execute("SELECT * FROM raw_jufair LIMIT 0").description]
    for row in rows:
        d = dict(zip(col_names, row))
        # cnexpo 使用不同的 source_url（防止 UNIQUE 冲突）
        d['source_url'] = re.sub(r'jufair\.com', 'cnexpo.com', str(d['source_url']))
        # 数值调大 10%（验证取最大值规则）
        for f in ('area_str', 'visitors_str', 'exhibitors_str'):
            val = d.get(f, '')
            m = re.search(r'(\d+)', str(val))
            if m:
                bigger = int(m.group(1)) + 100
                d[f] = re.sub(r'\d+', str(bigger), str(val), count=1)
        d['crawl_batch_id'] = 'TEST-BATCH-001'
        conn.execute("""
            INSERT OR IGNORE INTO raw_cnexpo
            (cn_name, en_name, date_str, year, venue, city,
             area_str, visitors_str, exhibitors_str, organizer,
             cycle, industry, source_url, crawl_batch_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            d['cn_name'], d.get('en_name',''), d.get('date_str',''),
            d.get('year'), d.get('venue',''), d.get('city',''),
            d.get('area_str',''), d.get('visitors_str',''), d.get('exhibitors_str',''),
            d.get('organizer',''), d.get('cycle',''), d.get('industry',''),
            d['source_url'], d['crawl_batch_id'],
        ))
    conn.commit()


def _insert_raw_jufair_row(conn: sqlite3.Connection, d: dict, batch_id: str) -> None:
    # 字段映射：旧 exhibitions schema → raw_jufair schema
    conn.execute("""
        INSERT OR IGNORE INTO raw_jufair
        (cn_name, en_name, date_str, year, venue, city,
         area_str, visitors_str, exhibitors_str, organizer,
         cycle, industry, source_type, source_url, crawl_batch_id)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        (d.get('cn_name') or '').strip(),
        (d.get('en_name') or '').strip(),
        d.get('date_str') or d.get('date') or '',
        d.get('year'),
        (d.get('venue') or '').strip(),
        (d.get('city') or '').strip(),
        d.get('area_str')       or d.get('area')       or '',
        d.get('visitors_str')   or d.get('visitors')   or '',
        d.get('exhibitors_str') or d.get('exhibitors') or '',
        (d.get('organizer') or '').strip(),
        d.get('cycle') or '',
        d.get('industry') or '',
        d.get('source_type') or 'domestic',
        d.get('source_url') or '',
        batch_id,
    ))


def _insert_synthetic_jufair(conn: sqlite3.Connection, n: int) -> None:
    """无源库时生成合成记录（CI/CD 环境）。"""
    for i in range(n):
        conn.execute("""
            INSERT OR IGNORE INTO raw_jufair
            (cn_name, en_name, date_str, year, venue, city,
             area_str, visitors_str, exhibitors_str, organizer,
             cycle, industry, source_type, source_url, crawl_batch_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            f'合成展会{i:04d}', f'SYNTH-{i:04d}',
            f'2026.0{(i%12)+1:02d}.01-0{(i%12)+1:02d}.03',
            2026,
            f'合成展馆{i%10}', '北京北京',
            f'{(i+1)*2}万平方米', f'{(i+1)*3}万人', f'{(i+1)*10}家',
            f'主办方{i%5}', '1年1届', '机械/机床',
            'domestic',
            f'https://www.jufair.com/exhibition/{i+1000}.html',
            'TEST-BATCH-001',
        ))


def make_test_db() -> tuple[sqlite3.Connection, sqlite3.Connection]:
    """
    返回 (src_conn, target_conn)：
      src_conn    — 含 raw_jufair(93条) + raw_cnexpo(20条) 的源库
      target_conn — 含完整 schema 的目标库（in-memory）
    """
    src = sqlite3.connect(":memory:")
    src.row_factory = sqlite3.Row
    build_raw_jufair_fixture(src)
    build_raw_cnexpo_fixture(src)
    src.commit()

    target = init_db(":memory:")
    return src, target
