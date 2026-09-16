-- 015: 恢复 company.intel_report_id —— 修正 014 的设计错误
--
-- 014 以「方向反了」为由删掉了 customer_prospect.intel_report_id，
-- 判断依据是「报告应该指向公司，而不是公司指向报告」。这个判断是错的：
--
--   实测备份数据：495 行里 494 行 intel_report_id = 3
--   报告 3 是 report_type='batch_prospect'、target_company='博华游艇展CIBS2026'
--   一份批量线索报告 → 494 家公司，是**一对多**。
--   014 新加的 intel_report.company_id 只能存一个公司，装不下这个关系。
--
-- 两个方向是两种不同的关系，都要保留：
--   company.intel_report_id  ← 这家公司是从哪份批量报告里挖出来的（多对一）
--   intel_report.company_id  ← 这份深度尽调报告写的是哪家公司（一对一，014 新增）
--
-- 数据回填由 scripts/restore_015_backfill.py 从
-- data/backups/mwlab_pre-rebuild-20260916.db 取值，本文件只负责加列建索引。

ALTER TABLE company ADD COLUMN intel_report_id INTEGER;   -- → intel_report(id)

CREATE INDEX IF NOT EXISTS idx_company_report
    ON company(intel_report_id) WHERE intel_report_id IS NOT NULL;
