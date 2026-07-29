-- 012: manual_tag_history.change_source + 删除两个全空且无引用的届次列
--
-- 背景（REMEDIATION-DRAFT-2026-07-29 P1-1 / P1-4）：
--
-- P1-1 manual_tag_history 名不副实。表名与 PRD 写的是「人工打标历史」，
--   实际是通用变更日志 —— 12,294 行里真人写的只有 1 行：
--     geo_extractor 3,581 · system/dedup 2,540 · auto_jufair_curl 2,531
--     manual_patch 1,881 · manual_inference/manual_final 53 · max（真人）1
--   后果：import_tags.py 写进来的人工打标会淹没在脚本改动里，
--   审计「这个字段是谁改的」无从查起。
--   加 change_source 区分 manual / script / merge，按 changed_by 回填。
--
-- P1-4 booth_price_per_sqm 与 overseas_exhibitor_pct 全库 100% NULL
--   且无任何代码引用，删除。
--   注意 edition_num **不删** —— 虽然 5,576 条是默认值 1，但另有 479 条
--   是真实届次序号（第 26 届 / 第 24 届 等），删了会丢数据。

ALTER TABLE manual_tag_history ADD COLUMN change_source TEXT NOT NULL DEFAULT 'script'
    CHECK (change_source IN ('manual', 'script', 'merge'));

UPDATE manual_tag_history SET change_source = 'merge'
 WHERE changed_by = 'system/dedup' OR field_name = 'merged_into';

-- 真人：changed_by 是用户名/邮箱而非脚本标识
UPDATE manual_tag_history SET change_source = 'manual'
 WHERE changed_by IN (SELECT email FROM user) OR changed_by LIKE '%@%'
    OR changed_by = 'max';

ALTER TABLE exhibition_edition DROP COLUMN booth_price_per_sqm;
ALTER TABLE exhibition_edition DROP COLUMN overseas_exhibitor_pct;
