-- 009: exhibition_brand.industry_raw — 承接爬虫原始行业串
--
-- 背景（AUDIT-2026-07-27 P0-1）：
--   merge_engine.upsert_brand 曾把 jufair 原始 industry（形如 "车展会, 北京车展"）
--   直接写入 industry_l1，且 ON CONFLICT 会覆盖已治理值，导致 8 类分类体系
--   被稀释为 125 个唯一值。
--
-- 整改：industry_l1 自此只允许分类脚本 / 人工打标写入；
--       爬虫原始值一律进 industry_raw，供分类脚本作为输入信号。

ALTER TABLE exhibition_brand ADD COLUMN industry_raw TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_brand_industry_raw
    ON exhibition_brand(industry_raw);
