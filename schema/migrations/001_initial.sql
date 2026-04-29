-- Migration 001 · Initial Schema
-- Version: 1
-- Applied: auto via schema/db.py

-- schema_version 表（迁移追踪）
CREATE TABLE IF NOT EXISTS schema_version (
    version     INTEGER PRIMARY KEY,
    description TEXT    NOT NULL,
    applied_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

INSERT OR IGNORE INTO schema_version (version, description)
VALUES (1, 'Initial schema: 6 tables + indexes');
