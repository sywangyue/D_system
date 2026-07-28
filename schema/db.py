"""
schema/db.py — SQLite 连接与初始化工具

使用方式：
    from schema.db import init_db, get_conn
    conn = init_db("data/mwlab.db")
    with get_conn("data/mwlab.db") as conn:
        ...
"""
import sqlite3
import re
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path

_SCHEMA_DIR = Path(__file__).parent
_INIT_SQL    = _SCHEMA_DIR / "init_db.sql"
_MIGRATIONS  = sorted(_SCHEMA_DIR.glob("migrations/[0-9]*.sql"))
_NUM_RE = re.compile(r'^(\d+)')


def _migration_number(path: Path) -> int:
    """从迁移文件名提取整数编号，如 002_display_ready.sql → 2。"""
    m = _NUM_RE.match(path.name)
    return int(m.group(1)) if m else 0


def _reconcile_production(conn: sqlite3.Connection) -> list[tuple[int, str]]:
    """检测生产库中已应用但未登记 schema_version 的迁移，回填登记行。

    返回新登记的行列表 [(version, description), ...]。
    （仅在生产库存在 schema_version 表且仅有部分登记时才执行回填。）
    """
    row = conn.execute(
        "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='schema_version'"
    ).fetchone()
    if not row or row[0] == 0:
        return []

    registered = {
        r[0] for r in conn.execute("SELECT version FROM schema_version").fetchall()
    }
    backfilled = []

    # 版本 2: exhibition_brand.display_ready
    if 2 not in registered:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(exhibition_brand)").fetchall()}
        if 'display_ready' in cols:
            conn.execute(
                "INSERT INTO schema_version(version, description, applied_at) VALUES (2, '002_display_ready', ?)",
                (datetime.now().isoformat(),)
            )
            backfilled.append((2, '002_display_ready'))

    # 版本 3: user.dashboard_prefs
    if 3 not in registered:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(user)").fetchall()}
        if 'dashboard_prefs' in cols:
            conn.execute(
                "INSERT INTO schema_version(version, description, applied_at) VALUES (3, '003_user_prefs', ?)",
                (datetime.now().isoformat(),)
            )
            backfilled.append((3, '003_user_prefs'))

    # 版本 9: exhibition_brand.industry_raw
    if 9 not in registered:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(exhibition_brand)").fetchall()}
        if 'industry_raw' in cols:
            conn.execute(
                "INSERT INTO schema_version(version, description, applied_at) VALUES (9, '009_industry_raw', ?)",
                (datetime.now().isoformat(),)
            )
            backfilled.append((9, '009_industry_raw'))

    # 版本 10: exhibition_brand.first_year
    if 10 not in registered:
        cols = {r[1] for r in conn.execute("PRAGMA table_info(exhibition_brand)").fetchall()}
        if 'first_year' in cols:
            conn.execute(
                "INSERT INTO schema_version(version, description, applied_at) VALUES (10, '010_first_year', ?)",
                (datetime.now().isoformat(),)
            )
            backfilled.append((10, '010_first_year'))

    # 版本 6: intel_report / customer_prospect 表
    if 6 not in registered:
        tables = {
            r[0] for r in conn.execute(
                "SELECT name FROM sqlite_master WHERE type='table'"
            ).fetchall()
        }
        if 'intel_report' in tables and 'customer_prospect' in tables:
            conn.execute(
                "INSERT INTO schema_version(version, description, applied_at) VALUES (6, '006_intel_tables', ?)",
                (datetime.now().isoformat(),)
            )
            backfilled.append((6, '006_intel_tables'))

    return backfilled


def init_db(db_path: str | Path = ":memory:") -> sqlite3.Connection:
    """
    创建或打开数据库，确保 schema 和所有迁移已应用。
    返回已启用外键约束的连接（WAL 模式）。
    """
    conn = sqlite3.connect(str(db_path), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    # 应用主 schema
    sql = _INIT_SQL.read_text(encoding="utf-8")
    conn.executescript(sql)

    # 确保 schema_version 表存在（001_initial 提供）
    conn.executescript(
        (_SCHEMA_DIR / "migrations" / "001_initial.sql").read_text(encoding="utf-8")
    )

    # 生产库对账：检测已应用但未登记的迁移
    backfilled = _reconcile_production(conn)

    # 按编号顺序遍历迁移，跳过已登记项
    registered = {
        r[0] for r in conn.execute("SELECT version FROM schema_version").fetchall()
    }
    applied = []

    for mig_path in _MIGRATIONS:
        version = _migration_number(mig_path)
        if version == 0 or version == 1:  # 1 已由 001_initial 处理
            continue
        if version in registered:
            continue

        mig_sql = mig_path.read_text(encoding="utf-8")
        conn.executescript(mig_sql)
        conn.execute(
            "INSERT INTO schema_version(version, description, applied_at) VALUES (?, ?, ?)",
            (version, mig_path.name, datetime.now().isoformat())
        )
        applied.append((version, mig_path.name))

    if backfilled or applied:
        conn.commit()

    return conn


@contextmanager
def get_conn(db_path: str | Path = ":memory:"):
    """上下文管理器：自动 commit/rollback，用完关闭。"""
    conn = init_db(db_path)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
