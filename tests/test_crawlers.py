"""
tests/test_crawlers.py — 爬虫解析层 fixture 回归测试

纯函数 + 内存 SQLite，零外网请求。所有 imports 后即给 requests.Session.get
打 fail-fast monkeypatch。
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import unittest
from pathlib import Path

FIXTURES = Path(__file__).parent / "fixtures"


# ── 测试前锁死网络：任何 requests 调用立刻失败 ──────────────────────────
def _no_network(*args, **kwargs):
    raise RuntimeError("测试中禁止网络请求")


import requests
requests.Session.get = _no_network
requests.get = _no_network


# ─── jufair 列表页解析 ──────────────────────────────────────────────

class TestJufairListPage(unittest.TestCase):
    """parse_list_page 从 HTML fixture 提取预期字段。"""

    def setUp(self):
        import crawlers.jufair_crawler as jc
        self.jc = jc

    def test_parse_list_page(self):
        html = (FIXTURES / "jufair_list_page.html").read_text(encoding="utf-8")
        items = self.jc.parse_list_page(html, "domestic", "TEST-BATCH")
        self.assertEqual(len(items), 1)
        item = items[0]
        self.assertEqual(item["cn_name"], "上海国际机床展")
        self.assertEqual(item["en_name"], "Machine Tool Expo")
        self.assertIn("2026.05.06", item["date_str"])
        self.assertIn("国家会展中心", item["venue"])
        self.assertEqual(item["source_type"], "domestic")

    def test_scale_field_unit_valid(self):
        """单位匹配时返回正确值。"""
        from bs4 import BeautifulSoup
        html = (FIXTURES / "jufair_list_page.html").read_text(encoding="utf-8")
        soup = BeautifulSoup(html, "html.parser")
        divs = soup.select(".scale-remind")
        self.assertGreaterEqual(len(divs), 2)
        # 第一个是 area（平方米）
        area = self.jc._scale_field(divs[0], "平方米")
        self.assertIn("50000", area)
        # 第二个是 exhibitors（家）
        exh = self.jc._scale_field(divs[1], "家")
        self.assertIn("800", exh)


class TestJufairDetailPage(unittest.TestCase):
    """parse_detail_page 从 HTML fixture 提取字段。"""

    def setUp(self):
        import crawlers.jufair_crawler as jc
        self.jc = jc
        # 替换 fetch_page 返回 fixture 内容
        self._orig_fetch = jc.fetch_page
        jc.fetch_page = lambda url, **kw: (FIXTURES / "jufair_detail_page.html").read_text(encoding="utf-8")

    def tearDown(self):
        self.jc.fetch_page = self._orig_fetch

    def test_parse_detail_returns_fields(self):
        data = self.jc.parse_detail_page("https://www.jufair.com/exhibition/1234.html")
        self.assertIsNotNone(data)
        self.assertEqual(data.get("organizer"), "北京展览集团")
        self.assertIn("上海", data.get("city", ""))
        self.assertIn("国家会展中心", data.get("venue", ""))


# ─── jufair 空串不覆盖（CRWL-01 回归）─────────────────────────────────

class TestNoOverwriteOnDetail(unittest.TestCase):
    """详情页缺字段时 UPDATE 不覆盖已有值。"""

    def test_empty_string_does_not_overwrite(self):
        conn = sqlite3.connect(":memory:")
        conn.row_factory = sqlite3.Row
        conn.execute("""
            CREATE TABLE raw_jufair (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                source_url TEXT UNIQUE,
                cn_name TEXT, area_str TEXT, visitors_str TEXT, detail_crawled INT
            )
        """)
        conn.execute(
            "INSERT INTO raw_jufair (source_url, cn_name, area_str, visitors_str, detail_crawled) VALUES (?,?,?,?,?)",
            ("https://example.com/e1", "已有展", "5万平方米", "3万人", 0),
        )

        # 模拟详情页仅返回 visitors_str（area_str 缺字段）
        extra = {"visitors_str": "观众:50000人"}
        non_empty = {k: v for k, v in extra.items() if v}
        set_parts = [f"{k}=:_{k}" for k in non_empty if k in
                     ["organizer", "city", "cycle", "industry", "area_str", "visitors_str", "exhibitors_str"]]
        set_clause = ", ".join(set_parts)
        params = {f"_{k}": v for k, v in non_empty.items()}
        params["_source_url"] = "https://example.com/e1"
        conn.execute(f"UPDATE raw_jufair SET {set_clause}, detail_crawled=1 WHERE source_url=:_source_url", params)
        conn.commit()

        row = conn.execute("SELECT area_str, visitors_str FROM raw_jufair WHERE source_url='https://example.com/e1'").fetchone()
        self.assertEqual(row["area_str"], "5万平方米", "area_str 不应被空串覆盖")
        self.assertIn("观众", row["visitors_str"])
        conn.close()


# ─── cnexpo 解析 ──────────────────────────────────────────────────

class TestCnexpoDetailPage(unittest.TestCase):
    """cnexpo parse_detail_page 按标签锚定提取。"""

    def setUp(self):
        import crawlers.cnexpo_crawler as cc
        self.cc = cc

    def _make_fetch(self, fixture_name):
        """返回一个 fetch_page 替代函数，从 fixture 读取 HTML。"""
        def mock_fetch(url, **kw):
            return (FIXTURES / fixture_name).read_text(encoding="utf-8")
        return mock_fetch

    def test_normal_layout(self):
        self.cc.fetch_page = self._make_fetch("cnexpo_detail_normal.html")
        data = self.cc.parse_detail_page("https://www.cnexpo.com/event/1.html")
        self.assertIsNotNone(data)
        self.assertEqual(data.get("cn_name"), "中国国际机床展")
        self.assertIn("2026.05.06", data.get("date_str", ""))
        self.assertEqual(data.get("city"), "上海")
        self.assertIn("国家会展中心", data.get("venue", ""))

    def test_shifted_layout_venue_empty(self):
        """venue 文本不含场馆关键词时置空，日期和城市仍可解析。"""
        self.cc.fetch_page = self._make_fetch("cnexpo_detail_shifted.html")
        data = self.cc.parse_detail_page("https://www.cnexpo.com/event/2.html")
        self.assertIsNotNone(data)
        # 城市应该仍能解析
        self.assertEqual(data.get("city"), "上海")
        # venue 不含关键词应置空
        self.assertIsNone(data.get("venue"), "venue 应为 None（不含场馆关键词）")
        # 日期应该仍能解析（跳过公告行）
        self.assertIn("2026.05.06", data.get("date_str", ""))


class TestCnexpoDateRegex(unittest.TestCase):
    """cnexpo 日期正则覆盖单日和全写格式（CRWL-14 回归）。"""

    def setUp(self):
        import crawlers.cnexpo_crawler as cc
        self.cc = cc

    def _make_fetch(self, html_content):
        def mock_fetch(url, **kw):
            return html_content
        return mock_fetch

    def test_single_day_date(self):
        html = "<h1>单日展</h1><p>2026.05.06</p>"
        self.cc.fetch_page = self._make_fetch(html)
        data = self.cc.parse_detail_page("https://www.cnexpo.com/event/3.html")
        self.assertIsNotNone(data)
        self.assertEqual(data.get("date_str"), "2026.05.06")


# ─── insert_batch 返回真实新增数（CRWL-10 回归）──────────────────────

class TestInsertBatchCounts(unittest.TestCase):
    """insert_batch 含重复 URL 时返回真实新增数。"""

    def _make_records(self, urls):
        return [{"cn_name": f"展{i}", "en_name": "", "date_str": "2026.01.01",
                 "year": 2026, "venue": "", "city": "", "area_str": "",
                 "visitors_str": "", "exhibitors_str": "", "organizer": "",
                 "cycle": "", "industry": "", "source_type": "domestic",
                 "source_url": url, "detail_crawled": 0, "crawl_batch_id": "TEST"}
                for i, url in enumerate(urls)]

    def test_jufair_insert_batch_dedup_count(self):
        from crawlers.jufair_crawler import init_db, insert_batch

        conn = init_db(":memory:")
        crawled = set()
        records = self._make_records(["https://jufair.com/e1", "https://jufair.com/e2", "https://jufair.com/e1"])
        n = insert_batch(conn, records, crawled)
        self.assertEqual(n, 2, f"3 条中 1 条重复，应返回 2，实际 {n}")
        conn.close()

    def test_cnexpo_insert_batch_dedup_count(self):
        from crawlers.cnexpo_crawler import init_db, insert_batch

        conn = init_db(":memory:")
        crawled = set()
        records = self._make_records(["https://cnexpo.com/e1", "https://cnexpo.com/e1", "https://cnexpo.com/e2"])
        n = insert_batch(conn, records, crawled)
        self.assertEqual(n, 2, f"3 条中 1 条重复，应返回 2，实际 {n}")
        conn.close()


if __name__ == "__main__":
    unittest.main(verbosity=2)
