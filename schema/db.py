"""
schema/db.py — SQLite 连接与初始化工具

使用方式：
    from schema.db import init_db, get_conn
    conn = init_db("mwlab.db")
    with get_conn("mwlab.db") as conn:
        ...
"""
import sqlite3
from contextlib import contextmanager
from pathlib import Path

_SCHEMA_DIR = Path(__file__).parent
_INIT_SQL    = _SCHEMA_DIR / "init_db.sql"
_MIGRATION_001 = _SCHEMA_DIR / "migrations" / "001_initial.sql"


def init_db(db_path: str | Path = ":memory:") -> sqlite3.Connection:
    """
    创建或打开数据库，确保 schema 和迁移已应用。
    返回已启用外键约束的连接（WAL 模式）。
    """
    conn = sqlite3.connect(str(db_path), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    # 应用主 schema
    sql = _INIT_SQL.read_text(encoding="utf-8")
    conn.executescript(sql)

    # 应用迁移001（schema_version 表）
    migration_sql = _MIGRATION_001.read_text(encoding="utf-8")
    conn.executescript(migration_sql)

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
