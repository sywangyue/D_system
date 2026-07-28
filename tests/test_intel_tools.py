"""
tests/test_intel_tools.py — intel 工具链冒烟测试

使用临时 SQLite 数据库（经 init_db 全量迁移），不依赖生产数据。
"""
import sys, os, json, sqlite3, tempfile, subprocess
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from pathlib import Path


class TestIntelProspects(unittest.TestCase):
    """insert_prospects 幂等回归。"""

    def setUp(self):
        self.db = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        self.db.close()
        # 用 schema.db.init_db 创建完整 schema
        from schema.db import init_db
        conn = init_db(self.db.name)
        conn.execute("INSERT OR IGNORE INTO exhibition_brand (brand_id, name_cn) VALUES ('EXPO-TEST', '测试展会')")
        conn.commit()
        conn.close()

    def tearDown(self):
        try: os.unlink(self.db.name)
        except OSError: pass

    def test_insert_prospects_idempotent(self):
        """同 JSON 文件插两次，第二次 0 新增。"""
        prospects = [
            {'company_name': '幂等公司甲', 'brand_id': 'EXPO-TEST', 'source_type': 'manual'},
        ]
        json_path = self.db.name + '.json'
        with open(json_path, 'w') as f:
            json.dump(prospects, f, ensure_ascii=False)

        result1 = subprocess.run(
            [sys.executable, 'tools/intel/insert_prospects.py',
             '--json', json_path, '--db', self.db.name],
            capture_output=True, text=True,
            cwd=Path(__file__).parent.parent,
        )
        self.assertIn('已写入 1', result1.stdout, f'首次插入失败: {result1.stderr}')

        result2 = subprocess.run(
            [sys.executable, 'tools/intel/insert_prospects.py',
             '--json', json_path, '--db', self.db.name],
            capture_output=True, text=True,
            cwd=Path(__file__).parent.parent,
        )
        self.assertIn('已写入 0', result2.stdout, f'二次插入不幂等: {result2.stdout}')
        self.assertIn('跳过 1', result2.stdout)

        os.unlink(json_path)

    def test_insert_with_report_id(self):
        """--report-id 参数正确填充 intel_report_id。"""
        # 先创建 intel_report（FK 约束需要）
        conn = sqlite3.connect(self.db.name)
        conn.execute(
            "INSERT INTO intel_report (report_type, report_md) VALUES (?, ?)",
            ('batch_prospect', 'test')
        )
        conn.commit()
        report_id = conn.execute("SELECT MAX(id) FROM intel_report").fetchone()[0]
        conn.close()

        prospects = [
            {'company_name': '报告关联公司', 'brand_id': 'EXPO-TEST', 'source_type': 'manual'},
        ]
        json_path = self.db.name + '.json'
        with open(json_path, 'w') as f:
            json.dump(prospects, f, ensure_ascii=False)

        subprocess.run(
            [sys.executable, 'tools/intel/insert_prospects.py',
             '--json', json_path, '--report-id', str(report_id), '--db', self.db.name],
            capture_output=True, text=True,
            cwd=Path(__file__).parent.parent,
        )
        conn = sqlite3.connect(self.db.name)
        row = conn.execute(
            "SELECT intel_report_id FROM customer_prospect WHERE company_name='报告关联公司'"
        ).fetchone()
        self.assertIsNotNone(row)
        self.assertEqual(row[0], report_id)
        conn.close()
        os.unlink(json_path)


class TestIntelDbQuery(unittest.TestCase):
    """db_query 多命中 / l1l2 冒烟。"""

    def setUp(self):
        from schema.db import init_db
        self.conn = init_db(':memory:')
        self.conn.execute(
            "INSERT INTO exhibition_brand (brand_id, name_cn, name_en, organizer, industry_l1, industry_l2, "
            "scale_score, is_ufi_certified, is_international, competition_relation, mds_related, city, frequency) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ('EXPO-A01','中国国际机床展','CIMT','北京展览','机械和设备','机床',9,0,0,'否','','北京','每年一届')
        )
        self.conn.execute(
            "INSERT INTO exhibition_brand (brand_id, name_cn, name_en, organizer, industry_l1, industry_l2, "
            "scale_score, is_ufi_certified, is_international, city, frequency) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ('EXPO-A02','上海机床展','','上海展览','机械和设备','机床',7,0,0,'上海','每年一届')
        )
        self.conn.execute(
            "INSERT INTO exhibition_brand (brand_id, name_cn, name_en, organizer, industry_l1, industry_l2, "
            "scale_score, is_ufi_certified, is_international, city, frequency) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            ('EXPO-A03','数控设备展','','深圳会展','机械和设备','数控',5,0,0,'深圳','每年一届')
        )
        self.conn.commit()

    def test_brand_research_multi_hit(self):
        """模糊搜索命中多条时，输出含"另有 N 条匹配"。"""
        from tools.intel.db_query import brand_research
        # 先替换 DB_PATH 为内存库
        import tools.intel.db_query as dq
        original = dq.DB_PATH
        # 内存库无法通过文件路径连接，用 monkey-patch _connect
        original_connect = dq._connect
        dq._connect = lambda: self.conn
        try:
            output = brand_research("机床")
            self.assertIn("另有 1 条匹配", output,
                          f"多命中提示缺失: {output[:200]}")
        finally:
            dq._connect = original_connect
            dq.DB_PATH = original

    def test_industry_research_l1_l2(self):
        """industry-research 传 L1/L2 不报"暂无数据"。"""
        from tools.intel.db_query import industry_research
        import tools.intel.db_query as dq
        original_connect = dq._connect
        dq._connect = lambda: self.conn
        try:
            output = industry_research("机械和设备", "数控")
            self.assertNotIn("暂无数据", output)
            self.assertIn("数控设备", output)
        finally:
            dq._connect = original_connect


class TestIntelExport(unittest.TestCase):
    """report_writer + export_prospects 冒烟。"""

    def setUp(self):
        self.db = tempfile.NamedTemporaryFile(suffix='.db', delete=False)
        self.db.close()
        from schema.db import init_db
        conn = init_db(self.db.name)
        conn.execute("INSERT OR IGNORE INTO exhibition_brand (brand_id, name_cn) VALUES ('EXPO-EXPORT', '导出测试')")
        conn.commit()
        conn.close()

    def tearDown(self):
        try: os.unlink(self.db.name)
        except OSError: pass

    def test_export_by_report_id_consistent(self):
        """建报告→插线索→按 report_id 导出 csv 行数一致。"""
        root = Path(__file__).parent.parent

        # 1. 创建报告
        report_md = "# 冒烟测试报告\n\n**日期**: 2026-06-12"
        report_path = self.db.name + '_report.md'
        with open(report_path, 'w') as f:
            f.write(report_md)

        r = subprocess.run(
            [sys.executable, 'tools/intel/report_writer.py',
             '--type', 'batch_prospect', '--brand-id', 'EXPO-EXPORT',
             '--content-file', report_path, '--db', self.db.name,
             # 报告 .md 必须写临时目录，否则污染仓库 reports/customer/（AUDIT P1-15）
             '--out-dir', tempfile.mkdtemp(prefix='mwlab_test_reports_')],
            capture_output=True, text=True,
            cwd=root,
        )
        self.assertEqual(r.returncode, 0, f'report_writer 失败: {r.stderr}')
        report_id = int(r.stdout.split('=')[1].strip())

        # 2. 插入线索
        prospects = [{'company_name':'导出公司甲','brand_id':'EXPO-EXPORT','source_type':'manual'}]
        json_path = self.db.name + '_pros.json'
        with open(json_path, 'w') as f:
            json.dump(prospects, f, ensure_ascii=False)

        subprocess.run(
            [sys.executable, 'tools/intel/insert_prospects.py',
             '--json', json_path, '--report-id', str(report_id), '--db', self.db.name],
            capture_output=True, text=True, cwd=root,
        )

        # 3. 导出为 csv
        csv_path = self.db.name + '_export.csv'
        r3 = subprocess.run(
            [sys.executable, 'tools/intel/export_prospects.py',
             '--report-id', str(report_id), '--format', 'csv', '--out', csv_path,
             '--db', self.db.name],
            capture_output=True, text=True, cwd=root,
        )

        self.assertEqual(r3.returncode, 0, f'export 失败: {r3.stderr}')
        import csv
        with open(csv_path) as f:
            reader = csv.reader(f)
            rows = list(reader)
        self.assertEqual(len(rows), 2, f'预期 1 行数据+1 行标题，实际 {len(rows)}')  # 1 数据 + 1 标题

        for f in [report_path, json_path, csv_path]:
            try: os.unlink(f)
            except OSError: pass


# ─── intel 表 CHECK 约束回归 ──────────────────────────────────────────

class TestIntelConstraints(unittest.TestCase):
    """intel_report / customer_prospect 的 CHECK 约束。"""

    def setUp(self):
        from schema.db import init_db
        self.conn = init_db(':memory:')

    def tearDown(self):
        self.conn.close()

    def test_report_type_valid(self):
        """report_type 合法值通过。"""
        self.conn.execute(
            "INSERT INTO intel_report (report_type, industry_l1, report_md) VALUES (?, ?, ?)",
            ('industry_research', '机械和设备', 'test'),
        )
        self.conn.commit()
        cnt = self.conn.execute("SELECT COUNT(*) FROM intel_report").fetchone()[0]
        self.assertEqual(cnt, 1)

    def test_report_type_invalid(self):
        """report_type 非法值报错。"""
        import sqlite3
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO intel_report (report_type, report_md) VALUES (?, ?)",
                ('invalid_type', 'test'),
            )
            self.conn.commit()

    def test_source_type_valid(self):
        """source_type 合法值通过。"""
        self.conn.execute("""
            INSERT INTO exhibition_brand (brand_id, name_cn) VALUES ('EXPO-CSTR', '约束测试')
        """)
        self.conn.execute(
            "INSERT INTO customer_prospect (company_name, source_type, brand_id) VALUES (?, ?, ?)",
            ('测试公司', 'qcc_search', 'EXPO-CSTR'),
        )
        self.conn.commit()
        cnt = self.conn.execute("SELECT COUNT(*) FROM customer_prospect").fetchone()[0]
        self.assertEqual(cnt, 1)

    def test_prospect_score_boundary(self):
        """prospect_score 在 1-5 范围内。"""
        self.conn.execute("""
            INSERT INTO exhibition_brand (brand_id, name_cn) VALUES ('EXPO-CSTR2', '约束测试2')
        """)
        for score in (1, 3, 5):
            self.conn.execute(
                "INSERT INTO customer_prospect (company_name, source_type, prospect_score, brand_id) VALUES (?, ?, ?, ?)",
                (f'公司{score}', 'manual', score, 'EXPO-CSTR2'),
            )
        self.conn.commit()
        cnt = self.conn.execute("SELECT COUNT(*) FROM customer_prospect").fetchone()[0]
        self.assertEqual(cnt, 3)

    def test_prospect_score_out_of_range(self):
        """prospect_score > 5 报错。"""
        import sqlite3
        self.conn.execute("""
            INSERT INTO exhibition_brand (brand_id, name_cn) VALUES ('EXPO-CSTR3', '约束测试3')
        """)
        with self.assertRaises(sqlite3.IntegrityError):
            self.conn.execute(
                "INSERT INTO customer_prospect (company_name, source_type, prospect_score, brand_id) VALUES (?, ?, ?, ?)",
                ('坏评分', 'manual', 6, 'EXPO-CSTR3'),
            )
            self.conn.commit()


if __name__ == "__main__":
    unittest.main(verbosity=2)
