-- 010: exhibition_brand.first_year — 补齐生产库缺失列
--
-- 背景（AUDIT 追加发现）：
--   first_year 自始就定义在 schema/init_db.sql 的 CREATE TABLE 里，
--   但生产库建库时间早于该定义，而 init_db.sql 用的是 CREATE TABLE IF NOT EXISTS，
--   对已存在的表不会补列 —— 于是定义与实体长期不一致，且无人察觉。
--
-- 实际影响（均为 "no such column: first_year" 直接崩溃）：
--   - scripts/dedup.py:63          去重工具完全不可用（dry-run 亦然）
--   - tools/export_for_tagging.py  Phase 3b 打标导出不可用
--   - tools/import_tags.py         Phase 3b 打标写回不可用
--
--   打标工具链坏死，正是 competition_relation / strategic_relevance /
--   ma_potential 三个人工字段至今 0 条已填的直接原因。

ALTER TABLE exhibition_brand ADD COLUMN first_year INTEGER;
