"""
tests/test_merge_engine.py — 合并引擎单元测试 + 93条样本集成验证

运行：
    cd /Volumes/databoard/AI\ Project/D_dashboard
    python3 -m unittest tests/test_merge_engine.py -v
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import sqlite3
import tempfile
import unittest
from pathlib import Path

from merge_engine import (
    parse_numeric,
    parse_date_pair,
    normalize_city,
    normalize_row,
    merge_two_sources,
    match_brand,
    next_brand_id,
    run_merge,
)
from tests.conftest import make_test_db, build_raw_jufair_fixture, build_raw_cnexpo_fixture


# ─── parse_numeric ──────────────────────────────────────────────────────────
class TestParseNumeric(unittest.TestCase):

    def test_wan_integer(self):
        self.assertEqual(parse_numeric('10万平方米'), 100000)

    def test_wan_float(self):
        self.assertEqual(parse_numeric('10.5万平方米'), 105000)

    def test_wan_float_visitors(self):
        self.assertEqual(parse_numeric('5.0万人'), 50000)

    def test_plain_number(self):
        self.assertEqual(parse_numeric('100000平方米'), 100000)

    def test_comma_separated(self):
        self.assertEqual(parse_numeric('600,000平方米'), 600000)

    def test_fullwidth_comma(self):
        self.assertEqual(parse_numeric('300，家'), 300)

    def test_cnexpo_prefix_area(self):
        self.assertEqual(parse_numeric('面积:15000平方米'), 15000)

    def test_cnexpo_prefix_exhibitors(self):
        self.assertEqual(parse_numeric('展商:350家'), 350)

    def test_cnexpo_prefix_visitors(self):
        self.assertEqual(parse_numeric('观众:35000人'), 35000)

    def test_none_input(self):
        self.assertIsNone(parse_numeric(None))

    def test_empty_string(self):
        self.assertIsNone(parse_numeric(''))

    def test_non_numeric(self):
        self.assertIsNone(parse_numeric('暂无数据'))

    def test_exhibitors_count(self):
        self.assertEqual(parse_numeric('1000家'), 1000)

    def test_comma_exhibitors(self):
        self.assertEqual(parse_numeric('1,000家'), 1000)

    def test_large_wan(self):
        self.assertEqual(parse_numeric('27.0万平方米'), 270000)


# ─── parse_date_pair ────────────────────────────────────────────────────────
class TestParseDatePair(unittest.TestCase):

    def test_dot_range(self):
        self.assertEqual(
            parse_date_pair('2026.05.01-05.05'),
            ('2026-05-01', '2026-05-05')
        )

    def test_dot_range_with_spaces(self):
        self.assertEqual(
            parse_date_pair('2026.12.09 - 12.11'),
            ('2026-12-09', '2026-12-11')
        )

    def test_dash_single_date(self):
        self.assertEqual(
            parse_date_pair('2026-4-24'),
            ('2026-04-24', None)
        )

    def test_dot_single_date(self):
        self.assertEqual(
            parse_date_pair('2026.4.24'),
            ('2026-04-24', None)
        )

    def test_chinese_range(self):
        self.assertEqual(
            parse_date_pair('2026年05月06日~05月08日'),
            ('2026-05-06', '2026-05-08')
        )

    def test_chinese_single(self):
        start, end = parse_date_pair('2026年5月1日')
        self.assertEqual(start, '2026-05-01')
        self.assertIsNone(end)

    def test_none_input(self):
        self.assertEqual(parse_date_pair(None), (None, None))

    def test_empty_input(self):
        self.assertEqual(parse_date_pair(''), (None, None))

    def test_garbage_input(self):
        start, end = parse_date_pair('暂定')
        self.assertIsNone(start)
        self.assertIsNone(end)

    def test_single_digit_month(self):
        start, _ = parse_date_pair('2026-1-5')
        self.assertEqual(start, '2026-01-05')


# ─── normalize_city ──────────────────────────────────────────────────────────
class TestNormalizeCity(unittest.TestCase):

    def test_direct_city_duplicate(self):
        self.assertEqual(normalize_city('上海上海'), '上海')

    def test_direct_city_beijing(self):
        self.assertEqual(normalize_city('北京北京'), '北京')

    def test_province_city(self):
        self.assertEqual(normalize_city('湖北武汉'), '武汉')

    def test_province_city_guangdong(self):
        self.assertEqual(normalize_city('广东广州'), '广州')

    def test_normal_city(self):
        self.assertEqual(normalize_city('上海'), '上海')

    def test_empty(self):
        self.assertEqual(normalize_city(''), '')

    def test_none(self):
        self.assertEqual(normalize_city(None), '')


# ─── normalize_row ───────────────────────────────────────────────────────────
class TestNormalizeRow(unittest.TestCase):

    def test_missing_all_optional_fields(self):
        row = {'cn_name': '测试展', 'source_url': 'http://a.com'}
        result = normalize_row(row, 'jufair')
        self.assertEqual(result['cn_name'], '测试展')
        self.assertIsNone(result['area_sqm'])
        self.assertIsNone(result['exhibitors_count'])
        self.assertIsNone(result['visitors_count'])

    def test_strip_whitespace_cn_name(self):
        row = {'cn_name': '  上海国际机床展  ', 'source_url': 'http://a.com'}
        result = normalize_row(row, 'jufair')
        self.assertEqual(result['cn_name'], '上海国际机床展')

    def test_city_normalization_applied(self):
        row = {'cn_name': '展', 'city': '上海上海', 'source_url': 'http://a.com'}
        result = normalize_row(row, 'jufair')
        self.assertEqual(result['city'], '上海')

    def test_year_extracted_from_date(self):
        row = {'cn_name': '展', 'date_str': '2026.05.01-05.05',
               'source_url': 'http://a.com'}
        result = normalize_row(row, 'jufair')
        self.assertEqual(result['year'], 2026)

    def test_old_schema_field_names(self):
        # exhibitions 表用 date / area / visitors / exhibitors
        row = {
            'cn_name': '展', 'source_url': 'http://a.com',
            'date': '2026.03.01-03.03',
            'area': '10万平方米',
            'visitors': '15万人',
            'exhibitors': '1000家',
        }
        result = normalize_row(row, 'jufair')
        self.assertEqual(result['area_sqm'], 100000)
        self.assertEqual(result['visitors_count'], 150000)
        self.assertEqual(result['exhibitors_count'], 1000)


# ─── merge_two_sources ───────────────────────────────────────────────────────
class TestMergeTwoSources(unittest.TestCase):

    def _j(self, **kw):
        base = dict(cn_name='测试展', en_name='TEST', date_str='2026.01.01-01.03',
                    date_start='2026-01-01', date_end='2026-01-03',
                    city='上海', venue='国家会展中心',
                    area_sqm=100000, exhibitors_count=500, visitors_count=50000,
                    organizer='主办A', year=2026, frequency='1年1届',
                    industry='机械', source_type='domestic',
                    source_url='http://jufair.com/1', crawl_batch_id='B001')
        base.update(kw)
        return base

    def _c(self, **kw):
        base = dict(cn_name='测试展', en_name='TEST', date_str='2026.01.01-01.03',
                    date_start='2026-01-01', date_end='2026-01-03',
                    city='上海', venue='国家会展中心',
                    area_sqm=120000, exhibitors_count=600, visitors_count=60000,
                    organizer='主办B', year=2026, frequency='1年1届',
                    industry='机械', source_type='domestic',
                    source_url='http://cnexpo.com/1', crawl_batch_id='B001')
        base.update(kw)
        return base

    def test_numeric_takes_max(self):
        merged = merge_two_sources(self._j(), self._c())
        self.assertEqual(merged['area_sqm'], 120000)
        self.assertEqual(merged['exhibitors_count'], 600)
        self.assertEqual(merged['visitors_count'], 60000)

    def test_name_jufair_wins(self):
        j = self._j(cn_name='展览A')
        c = self._c(cn_name='展览B')
        merged = merge_two_sources(j, c)
        self.assertEqual(merged['cn_name'], '展览A')

    def test_organizer_conflict_concatenated(self):
        merged = merge_two_sources(self._j(organizer='A公司'), self._c(organizer='B公司'))
        self.assertIn('A公司', merged['organizer'])
        self.assertIn('B公司', merged['organizer'])

    def test_organizer_same_no_concat(self):
        merged = merge_two_sources(self._j(organizer='同一公司'), self._c(organizer='同一公司'))
        self.assertEqual(merged['organizer'], '同一公司')

    def test_missing_jufair_value_fallback_to_cnexpo(self):
        j = self._j(area_sqm=None)
        c = self._c(area_sqm=120000)
        merged = merge_two_sources(j, c)
        self.assertEqual(merged['area_sqm'], 120000)

    def test_both_missing_value_stays_none(self):
        j = self._j(area_sqm=None)
        c = self._c(area_sqm=None)
        merged = merge_two_sources(j, c)
        self.assertIsNone(merged['area_sqm'])

    def test_conflict_notes_recorded_when_values_differ(self):
        merged = merge_two_sources(self._j(), self._c())
        notes = merged.get('conflict_notes', '')
        self.assertIn('area_sqm', notes)


# ─── brand ID & matching ─────────────────────────────────────────────────────
class TestBrandMatching(unittest.TestCase):

    def setUp(self):
        from schema.db import init_db
        self.conn = init_db(":memory:")
        self.conn.execute(
            "INSERT INTO exhibition_brand (brand_id, name_cn) VALUES (?,?)",
            ("EXPO-0001", "上海国际机床展")
        )
        self.conn.commit()

    def tearDown(self):
        self.conn.close()

    def test_exact_match(self):
        self.assertEqual(match_brand(self.conn, '上海国际机床展'), 'EXPO-0001')

    def test_no_match(self):
        self.assertIsNone(match_brand(self.conn, '完全无关的展览'))

    def test_fuzzy_match(self):
        bid = match_brand(self.conn, '上海国际机床展览会')  # 相似度约0.9
        self.assertEqual(bid, 'EXPO-0001')

    def test_empty_name_returns_none(self):
        self.assertIsNone(match_brand(self.conn, ''))

    def test_next_brand_id_initial(self):
        from schema.db import init_db
        fresh = init_db(":memory:")
        self.assertEqual(next_brand_id(fresh), 'EXPO-0001')
        fresh.close()

    def test_next_brand_id_sequential(self):
        self.assertEqual(next_brand_id(self.conn), 'EXPO-0002')


# ─── 93条样本集成测试 ─────────────────────────────────────────────────────────
class Test93SampleIntegration(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        """构建源库（93条），运行合并，保存统计。"""
        import tempfile
        cls.tmp_jufair  = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        cls.tmp_cnexpo  = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        cls.tmp_target  = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        cls.tmp_jufair.close()
        cls.tmp_cnexpo.close()
        cls.tmp_target.close()

        # 构建 jufair 源库
        j_conn = sqlite3.connect(cls.tmp_jufair.name)
        build_raw_jufair_fixture(j_conn)
        j_conn.commit()

        # 构建 cnexpo 源库（复用 j_conn 读取 raw_jufair 前20条做镜像）
        c_conn = sqlite3.connect(cls.tmp_cnexpo.name)
        build_raw_cnexpo_fixture(c_conn, jufair_conn=j_conn)
        c_conn.commit()
        c_conn.close()
        j_conn.close()

        cls.stats = run_merge(
            jufair_db  = Path(cls.tmp_jufair.name),
            cnexpo_db  = Path(cls.tmp_cnexpo.name),
            target_db  = Path(cls.tmp_target.name),
            batch_id   = 'ALL',
            dry_run    = False,
        )

        target = sqlite3.connect(cls.tmp_target.name)
        target.row_factory = sqlite3.Row
        cls.brand_count   = target.execute("SELECT COUNT(*) FROM exhibition_brand").fetchone()[0]
        cls.edition_count = target.execute("SELECT COUNT(*) FROM exhibition_edition").fetchone()[0]
        cls.prov_count    = target.execute("SELECT COUNT(*) FROM data_provenance").fetchone()[0]
        cls.null_cn_count = target.execute(
            "SELECT COUNT(*) FROM exhibition_brand WHERE name_cn IS NULL OR name_cn=''"
        ).fetchone()[0]
        cls.null_area_editions = target.execute(
            "SELECT COUNT(*) FROM exhibition_edition WHERE area_sqm IS NOT NULL"
        ).fetchone()[0]
        target.close()

    @classmethod
    def tearDownClass(cls):
        import os
        for f in [cls.tmp_jufair.name, cls.tmp_cnexpo.name, cls.tmp_target.name]:
            try:
                os.unlink(f)
            except OSError:
                pass

    def test_no_records_skipped_silently(self):
        self.assertEqual(self.stats['skipped'], 0, "有记录被静默跳过")

    def test_brands_created(self):
        self.assertGreater(self.stats['brands_created'], 0, "没有创建任何品牌")

    def test_all_brands_have_name_cn(self):
        self.assertEqual(self.null_cn_count, 0, "有品牌的 name_cn 为空")

    def test_editions_created(self):
        self.assertGreater(self.edition_count, 0, "没有创建任何届次记录")

    def test_provenance_written(self):
        self.assertGreater(self.prov_count, 0, "没有写入任何溯源记录")

    def test_editions_ge_brands(self):
        self.assertGreaterEqual(
            self.edition_count, self.brand_count,
            "届次数不应少于品牌数"
        )

    def test_at_least_50_brands_from_93_sample(self):
        # 88 jufair + 5 dirty + cnexpo overlap → 期望品牌数 > 50
        self.assertGreater(self.brand_count, 50, f"品牌数偏少: {self.brand_count}")

    def test_area_parsed_for_valid_records(self):
        self.assertGreater(self.null_area_editions, 0, "没有任何 area_sqm 被成功解析")

    def test_print_summary(self):
        print(f"\n=== 93条样本验证报告 ===")
        print(f"  brands_created  : {self.stats['brands_created']}")
        print(f"  brands_matched  : {self.stats['brands_matched']}")
        print(f"  editions_upserted: {self.stats['editions_upserted']}")
        print(f"  provenance_written: {self.stats['provenance_written']}")
        print(f"  skipped         : {self.stats['skipped']}")
        print(f"  → exhibition_brand  : {self.brand_count} 行")
        print(f"  → exhibition_edition: {self.edition_count} 行")
        print(f"  → data_provenance   : {self.prov_count} 行")


if __name__ == "__main__":
    unittest.main(verbosity=2)
