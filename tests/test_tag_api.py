"""
tests/test_tag_api.py — 人工打标 API 测试

运行：
    cd /Volumes/databoard/AI Project/D_dashboard
    python3 -m unittest tests/test_tag_api.py -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

import tag_api
from tag_api import app, get_db
from schema.db import init_db


# ─── 共享 DB：所有测试复用同一个临时数据库 ───────────────────────────────────
_TMP_DB = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
_TMP_DB.close()
TEST_DB_PATH = _TMP_DB.name

def _setup_test_db():
    conn = init_db(TEST_DB_PATH)
    conn.execute("DELETE FROM manual_tag_history")
    conn.execute("DELETE FROM exhibition_brand")
    conn.execute(
        "INSERT INTO exhibition_brand (brand_id, name_cn, competition_relation) "
        "VALUES (?,?,?)",
        ("EXPO-0001", "上海机床展", "")
    )
    conn.execute(
        "INSERT INTO exhibition_brand (brand_id, name_cn) VALUES (?,?)",
        ("EXPO-0002", "北京汽车展")
    )
    conn.commit()
    conn.close()

_setup_test_db()


def _override_get_db():
    """FastAPI dependency override — 始终连接测试库。"""
    conn = sqlite3.connect(TEST_DB_PATH, detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
    finally:
        conn.close()


app.dependency_overrides[get_db] = _override_get_db
client = TestClient(app, raise_server_exceptions=True)


class TestTagAPI(unittest.TestCase):

    def setUp(self):
        _setup_test_db()

    @classmethod
    def tearDownClass(cls):
        app.dependency_overrides.clear()
        try:
            os.unlink(TEST_DB_PATH)
        except OSError:
            pass

    # ─── 健康检查 ──────────────────────────────────────────────────────────────
    def test_health_endpoint(self):
        resp = client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["status"], "ok")

    # ─── GET /api/brands/{brand_id} ────────────────────────────────────────────
    def test_get_brand_exists(self):
        resp = client.get("/api/brands/EXPO-0001")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["name_cn"], "上海机床展")

    def test_get_brand_not_found(self):
        resp = client.get("/api/brands/EXPO-9999")
        self.assertEqual(resp.status_code, 404)

    # ─── PATCH /api/brands/{brand_id}/tags ─────────────────────────────────────
    def test_patch_valid_tag(self):
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name":  "competition_relation",
            "new_value":   "是",
            "changed_by":  "admin@mwlab.com",
            "reason":      "首次打标"
        })
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["new_value"], "是")
        self.assertEqual(data["old_value"], "")
        self.assertEqual(data["changed_by"], "admin@mwlab.com")

    def test_patch_updates_brand_table(self):
        client.patch("/api/brands/EXPO-0002/tags", json={
            "field_name": "scale_score",
            "new_value":  8,
            "changed_by": "bd@mwlab.com",
        })
        resp = client.get("/api/brands/EXPO-0002")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["scale_score"], 8)

    def test_patch_invalid_field_name(self):
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "nonexistent_field",
            "new_value":  "x",
            "changed_by": "admin@mwlab.com",
        })
        self.assertEqual(resp.status_code, 422)

    def test_patch_invalid_enum_value(self):
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "competition_relation",
            "new_value":  "未知",
            "changed_by": "admin@mwlab.com",
        })
        self.assertEqual(resp.status_code, 422)

    def test_patch_scale_score_out_of_range(self):
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "scale_score",
            "new_value":  11,
            "changed_by": "admin@mwlab.com",
        })
        self.assertEqual(resp.status_code, 422)

    def test_patch_brand_not_found(self):
        resp = client.patch("/api/brands/EXPO-9999/tags", json={
            "field_name": "notes",
            "new_value":  "test",
            "changed_by": "admin@mwlab.com",
        })
        self.assertEqual(resp.status_code, 404)

    def test_patch_invalid_email(self):
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "notes",
            "new_value":  "test",
            "changed_by": "not_an_email",
        })
        self.assertEqual(resp.status_code, 422)

    def test_patch_null_new_value_rejected(self):
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "notes",
            "new_value":  None,
            "changed_by": "admin@mwlab.com",
        })
        self.assertEqual(resp.status_code, 422)

    # ─── GET /api/brands/{brand_id}/tag-history ────────────────────────────────
    def test_tag_history_recorded(self):
        client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "mds_related",
            "new_value":  "MFC",
            "changed_by": "admin@mwlab.com",
            "reason":     "关联MFC"
        })
        resp = client.get("/api/brands/EXPO-0001/tag-history")
        self.assertEqual(resp.status_code, 200)
        history = resp.json()
        fields = [h["field_name"] for h in history]
        self.assertIn("mds_related", fields)

    def test_tag_history_filter_by_field(self):
        client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "mds_related",
            "new_value":  "MFC",
            "changed_by": "admin@mwlab.com",
        })
        resp = client.get("/api/brands/EXPO-0001/tag-history?field_name=mds_related")
        self.assertEqual(resp.status_code, 200)
        for item in resp.json():
            self.assertEqual(item["field_name"], "mds_related")

    def test_tag_history_brand_not_found(self):
        resp = client.get("/api/brands/EXPO-9999/tag-history")
        self.assertEqual(resp.status_code, 404)

    def test_tag_history_empty_initial(self):
        resp = client.get("/api/brands/EXPO-0001/tag-history?field_name=notes")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json(), [])

    # ─── 连续打标历史追踪 ──────────────────────────────────────────────────────
    def test_multiple_patches_create_history_chain(self):
        for val in ("是", "否", "是"):
            client.patch("/api/brands/EXPO-0001/tags", json={
                "field_name": "competition_relation",
                "new_value":  val,
                "changed_by": "admin@mwlab.com",
            })
        resp = client.get(
            "/api/brands/EXPO-0001/tag-history?field_name=competition_relation"
        )
        self.assertGreaterEqual(len(resp.json()), 3)

    def test_strategic_relevance_valid_range(self):
        for v in [1, 3, 5]:
            resp = client.patch("/api/brands/EXPO-0001/tags", json={
                "field_name": "strategic_relevance",
                "new_value":  v,
                "changed_by": "admin@mwlab.com",
            })
            self.assertEqual(resp.status_code, 200, f"值 {v} 应被接受")

    def test_is_international_valid(self):
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "is_international",
            "new_value":  1,
            "changed_by": "admin@mwlab.com",
        })
        self.assertEqual(resp.status_code, 200)

    def test_is_international_invalid(self):
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "is_international",
            "new_value":  2,
            "changed_by": "admin@mwlab.com",
        })
        self.assertEqual(resp.status_code, 422)

    def test_old_value_captured_correctly(self):
        client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "notes",
            "new_value":  "第一次备注",
            "changed_by": "admin@mwlab.com",
        })
        resp = client.patch("/api/brands/EXPO-0001/tags", json={
            "field_name": "notes",
            "new_value":  "第二次备注",
            "changed_by": "admin@mwlab.com",
        })
        data = resp.json()
        self.assertEqual(data["old_value"], "第一次备注")
        self.assertEqual(data["new_value"], "第二次备注")


if __name__ == "__main__":
    unittest.main(verbosity=2)
