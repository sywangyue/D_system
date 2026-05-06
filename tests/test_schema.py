"""
tests/test_schema.py — Schema 完整性测试

运行（在仓库根目录）：

    python -m pytest tests/test_schema.py -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import unittest
from schema.db import init_db


def get_table_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {r[1] for r in rows}


def get_all_tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {r[0] for r in rows}


class TestSchemaCreation(unittest.TestCase):
    def setUp(self):
        self.conn = init_db(":memory:")

    def tearDown(self):
        self.conn.close()

    def test_all_six_tables_exist(self):
        tables = get_all_tables(self.conn)
        required = {
            "exhibition_brand", "exhibition_edition", "data_provenance",
            "crawl_log", "user", "manual_tag_history"
        }
        self.assertTrue(required.issubset(tables), f"缺少表: {required - tables}")

    def test_schema_version_table_exists(self):
        tables = get_all_tables(self.conn)
        self.assertIn("schema_version", tables)

    def test_brand_table_columns(self):
        cols = get_table_columns(self.conn, "exhibition_brand")
        required = {
            "brand_id", "name_cn", "name_en", "first_year", "organizer",
            "co_organizer", "city", "frequency", "industry_l1", "industry_l2",
            "competition_relation", "mds_related", "scale_score", "is_international",
            "is_ufi_certified", "ma_potential", "strategic_relevance",
            "competitor_group", "website", "notes", "created_at", "updated_at"
        }
        self.assertEqual(required, required & cols, f"brand 表缺少字段: {required - cols}")

    def test_edition_table_columns(self):
        cols = get_table_columns(self.conn, "exhibition_edition")
        required = {
            "edition_id", "brand_id", "edition_num", "year", "date_start", "date_end",
            "city", "venue", "status", "area_sqm", "exhibitors_count", "visitors_count",
            "overseas_exhibitor_pct", "booth_price_per_sqm", "heat_score", "yoy_trend",
            "anomaly_flag", "data_source", "recorded_at", "notes"
        }
        self.assertEqual(required, required & cols, f"edition 表缺少字段: {required - cols}")

    def test_provenance_columns(self):
        cols = get_table_columns(self.conn, "data_provenance")
        required = {
            "record_id", "brand_id", "source_site", "source_url",
            "raw_payload", "crawled_at", "crawl_batch_id", "notes"
        }
        self.assertEqual(required, required & cols)

    def test_indexes_created(self):
        rows = self.conn.execute(
            "SELECT name FROM sqlite_master WHERE type='index'"
        ).fetchall()
        index_names = {r[0] for r in rows}
        expected = {
            "idx_brand_name_cn", "idx_brand_industry", "idx_brand_competition",
            "idx_edition_brand_year", "idx_provenance_brand", "idx_tag_history_brand"
        }
        self.assertTrue(expected.issubset(index_names), f"缺少索引: {expected - index_names}")


class TestSchemaConstraints(unittest.TestCase):
    def setUp(self):
        self.conn = init_db(":memory:")

    def tearDown(self):
        self.conn.close()

    def test_brand_not_null_name_cn(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO exhibition_brand (brand_id, name_cn) VALUES (?,?)",
                ("EXPO-0001", None)
            )

    def test_brand_competition_relation_check(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO exhibition_brand (brand_id, name_cn, competition_relation) VALUES (?,?,?)",
                ("EXPO-0001", "测试展", "未知")
            )

    def test_brand_scale_score_range(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO exhibition_brand (brand_id, name_cn, scale_score) VALUES (?,?,?)",
                ("EXPO-0001", "测试展", 11)
            )

    def test_edition_foreign_key(self):
        self.conn.execute("PRAGMA foreign_keys = ON")
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO exhibition_edition (edition_id, brand_id, year) VALUES (?,?,?)",
                ("EXPO-9999-2026", "EXPO-9999", 2026)
            )
            self.conn.commit()

    def test_user_role_check(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO user (email, password_hash, role) VALUES (?,?,?)",
                ("test@test.com", "hash", "superuser")
            )

    def test_crawl_log_status_check(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO crawl_log (batch_id, source_site, started_at, status) VALUES (?,?,?,?)",
                ("B001", "jufair", "2026-01-01", "pending")
            )

    def test_source_site_check_constraint(self):
        self.conn.execute(
            "INSERT INTO exhibition_brand (brand_id, name_cn) VALUES (?,?)",
            ("EXPO-0001", "测试展")
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO data_provenance (record_id, brand_id, source_site, source_url) "
                "VALUES (?,?,?,?)",
                ("R001", "EXPO-0001", "unknown_source", "http://example.com")
            )


class TestSchemaInsertRetrieve(unittest.TestCase):
    def setUp(self):
        self.conn = init_db(":memory:")

    def tearDown(self):
        self.conn.close()

    def test_insert_brand_and_retrieve(self):
        self.conn.execute(
            "INSERT INTO exhibition_brand (brand_id, name_cn, name_en, competition_relation) "
            "VALUES (?,?,?,?)",
            ("EXPO-0001", "上海机床展", "CIMT", "是")
        )
        self.conn.commit()
        row = self.conn.execute(
            "SELECT * FROM exhibition_brand WHERE brand_id=?", ("EXPO-0001",)
        ).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row["name_cn"], "上海机床展")
        self.assertEqual(row["competition_relation"], "是")

    def test_insert_edition_linked_to_brand(self):
        self.conn.execute(
            "INSERT INTO exhibition_brand (brand_id, name_cn) VALUES (?,?)",
            ("EXPO-0001", "机床展")
        )
        self.conn.execute(
            "INSERT INTO exhibition_edition "
            "(edition_id, brand_id, year, area_sqm, exhibitors_count, visitors_count) "
            "VALUES (?,?,?,?,?,?)",
            ("EXPO-0001-2026", "EXPO-0001", 2026, 100000, 500, 50000)
        )
        self.conn.commit()
        row = self.conn.execute(
            "SELECT * FROM exhibition_edition WHERE edition_id=?", ("EXPO-0001-2026",)
        ).fetchone()
        self.assertEqual(row["area_sqm"], 100000)
        self.assertEqual(row["exhibitors_count"], 500)

    def test_manual_tag_history_records_change(self):
        self.conn.execute(
            "INSERT INTO exhibition_brand (brand_id, name_cn) VALUES (?,?)",
            ("EXPO-0001", "机床展")
        )
        self.conn.execute(
            "INSERT INTO manual_tag_history "
            "(brand_id, field_name, old_value, new_value, changed_by) "
            "VALUES (?,?,?,?,?)",
            ("EXPO-0001", "competition_relation", "", "是", "admin@mwlab.com")
        )
        self.conn.commit()
        row = self.conn.execute(
            "SELECT * FROM manual_tag_history WHERE brand_id=?", ("EXPO-0001",)
        ).fetchone()
        self.assertEqual(row["new_value"], "是")
        self.assertEqual(row["changed_by"], "admin@mwlab.com")

    def test_schema_version_populated(self):
        row = self.conn.execute(
            "SELECT version FROM schema_version WHERE version=1"
        ).fetchone()
        self.assertIsNotNone(row)


if __name__ == "__main__":
    unittest.main(verbosity=2)
