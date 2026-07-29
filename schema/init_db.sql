-- MWLAB-2026 · SQLite Schema v1.0
-- 执行方式：sqlite3 mwlab.db < schema/init_db.sql
-- 或通过 schema/db.py 的 init_db() 函数调用

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ─── 表A: 展会品牌（主表，变化慢）────────────────────────────────
CREATE TABLE IF NOT EXISTS exhibition_brand (
    brand_id              TEXT    PRIMARY KEY,                       -- EXPO-XXXX
    name_cn               TEXT    NOT NULL,
    name_en               TEXT    NOT NULL DEFAULT '',
    first_year            INTEGER,
    organizer             TEXT    NOT NULL DEFAULT '',
    co_organizer          TEXT    NOT NULL DEFAULT '',
    city                  TEXT    NOT NULL DEFAULT '',
    frequency             TEXT    NOT NULL DEFAULT '',               -- 年展/双年展
    industry_l1           TEXT    NOT NULL DEFAULT '',               -- 仅分类脚本/人工打标可写
    industry_l2           TEXT    NOT NULL DEFAULT '',
    industry_raw          TEXT    NOT NULL DEFAULT '',               -- 爬虫原始行业串，勿直接展示
    competition_relation  TEXT    NOT NULL DEFAULT ''
                              CHECK (competition_relation IN ('是', '否', '')),
    mds_related           TEXT    NOT NULL DEFAULT '',               -- 无/MFC/Reha China 等
    scale_score           INTEGER
                              CHECK (scale_score IS NULL OR (scale_score BETWEEN 1 AND 10)),
    is_international      INTEGER NOT NULL DEFAULT 0,                -- 0/1
    is_ufi_certified      INTEGER NOT NULL DEFAULT 0,                -- 0/1
    ma_potential          INTEGER
                              CHECK (ma_potential IS NULL OR (ma_potential BETWEEN 1 AND 5)),
    strategic_relevance   INTEGER
                              CHECK (strategic_relevance IS NULL OR (strategic_relevance BETWEEN 1 AND 5)),
    competitor_group      TEXT    NOT NULL DEFAULT '',
    website               TEXT    NOT NULL DEFAULT '',
    notes                 TEXT    NOT NULL DEFAULT '',
    display_ready         INTEGER NOT NULL DEFAULT 0,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ─── 表B: 展会届次（时序数据，每年新增）──────────────────────────
CREATE TABLE IF NOT EXISTS exhibition_edition (
    edition_id              TEXT    PRIMARY KEY,                     -- EXPO-XXXX-YYYY
    brand_id                TEXT    NOT NULL
                                REFERENCES exhibition_brand(brand_id) ON DELETE CASCADE,
    edition_num             INTEGER,
    year                    INTEGER,
    date_start              TEXT,                                    -- ISO 8601: YYYY-MM-DD
    date_end                TEXT,                                    -- ISO 8601: YYYY-MM-DD
    city                    TEXT    NOT NULL DEFAULT '',
    venue                   TEXT    NOT NULL DEFAULT '',
    status                  TEXT    NOT NULL DEFAULT ''
                                CHECK (status IN ('已举办', '即将举办', '取消', '延期', '')),
    area_sqm                INTEGER,
    exhibitors_count        INTEGER,
    visitors_count          INTEGER,
    overseas_exhibitor_pct  REAL,
    booth_price_per_sqm     INTEGER,
    heat_score              INTEGER
                                CHECK (heat_score IS NULL OR (heat_score BETWEEN 1 AND 5)),
    yoy_trend               TEXT    NOT NULL DEFAULT ''
                                CHECK (yoy_trend IN ('上升', '平稳', '下降', '')),
    anomaly_flag            INTEGER NOT NULL DEFAULT 0,
    data_source             TEXT    NOT NULL DEFAULT ''
                                CHECK (data_source IN ('jufair', 'cnexpo', 'jufair+cnexpo',
                                                       '官网', '手工', '')),
    recorded_at             TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    notes                   TEXT    NOT NULL DEFAULT ''
);

-- ─── 表C: 数据溯源 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS data_provenance (
    record_id       TEXT    PRIMARY KEY,
    brand_id        TEXT    REFERENCES exhibition_brand(brand_id) ON DELETE SET NULL,
    source_site     TEXT    NOT NULL
                        CHECK (source_site IN ('jufair', 'cnexpo', 'manual')),
    source_url      TEXT    NOT NULL,
    raw_payload     TEXT    NOT NULL DEFAULT '{}',                   -- JSON 字符串
    crawled_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    crawl_batch_id  TEXT    NOT NULL DEFAULT '',
    notes           TEXT    NOT NULL DEFAULT ''
);

-- ─── 表D: 爬取日志 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS crawl_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id        TEXT    NOT NULL UNIQUE,
    source_site     TEXT    NOT NULL,
    started_at      TEXT    NOT NULL,
    finished_at     TEXT,
    status          TEXT    NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'success', 'failed', 'partial')),
    total_fetched   INTEGER NOT NULL DEFAULT 0,
    total_inserted  INTEGER NOT NULL DEFAULT 0,
    total_skipped   INTEGER NOT NULL DEFAULT 0,
    error_message   TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ─── 表E: 用户 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user (
    user_id       INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT    NOT NULL UNIQUE,
    password_hash TEXT    NOT NULL,
    role          TEXT    NOT NULL DEFAULT 'readonly'
                      CHECK (role IN ('admin', 'manager', 'readonly')),
    display_name  TEXT    NOT NULL DEFAULT '',
    is_active     INTEGER NOT NULL DEFAULT 1,
    last_login    TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

-- ─── 表F: 人工打标历史 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_tag_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id    TEXT    NOT NULL
                    REFERENCES exhibition_brand(brand_id) ON DELETE CASCADE,
    field_name  TEXT    NOT NULL,
    old_value   TEXT    NOT NULL DEFAULT '',
    new_value   TEXT    NOT NULL,
    changed_by  TEXT    NOT NULL,                                    -- user email
    changed_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    reason      TEXT    NOT NULL DEFAULT ''
);

-- ─── 索引 ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_brand_name_cn
    ON exhibition_brand(name_cn);
CREATE INDEX IF NOT EXISTS idx_brand_industry
    ON exhibition_brand(industry_l1, industry_l2);
CREATE INDEX IF NOT EXISTS idx_brand_competition
    ON exhibition_brand(competition_relation);
CREATE INDEX IF NOT EXISTS idx_brand_mds
    ON exhibition_brand(mds_related);

CREATE INDEX IF NOT EXISTS idx_edition_brand_year
    ON exhibition_edition(brand_id, year);
CREATE INDEX IF NOT EXISTS idx_edition_year
    ON exhibition_edition(year);
CREATE INDEX IF NOT EXISTS idx_edition_status
    ON exhibition_edition(status);

CREATE INDEX IF NOT EXISTS idx_provenance_brand
    ON data_provenance(brand_id);
CREATE INDEX IF NOT EXISTS idx_provenance_source
    ON data_provenance(source_site, crawl_batch_id);
CREATE INDEX IF NOT EXISTS idx_provenance_url
    ON data_provenance(source_url);

CREATE INDEX IF NOT EXISTS idx_tag_history_brand
    ON manual_tag_history(brand_id, changed_at);
