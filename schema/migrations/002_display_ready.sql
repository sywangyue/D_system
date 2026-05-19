-- MWLAB-2026 · Migration 002: 添加 display_ready 列
-- 标记记录是否满足展示池最低条件
-- 由 scripts/check_display_ready.py 每周维护

ALTER TABLE exhibition_brand ADD COLUMN display_ready INTEGER NOT NULL DEFAULT 0;
