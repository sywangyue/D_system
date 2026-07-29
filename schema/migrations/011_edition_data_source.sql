-- 011: exhibition_edition.data_source 取值归一 + CHECK 约束
--
-- 背景（REMEDIATION-DRAFT-2026-07-29 P1-2）：
--   schema 注释写的是 jufair/cnexpo/官网/手工，但从来没有 CHECK 约束，
--   实际库里长出了 7 个取值：
--     jufair 5058 · cnexpo 2381 · jufair/cnexpo 60 · cnexpo/jufair 3
--     官网 1 · web-search 1 · official-press-release 1
--   其中 jufair/cnexpo 与 cnexpo/jufair 是同一含义的两种写法，
--   web-search / official-press-release 是 intel 工具写入的英文值。
--
-- 归一规则：双源统一写 jufair+cnexpo（顺序无关），英文来源归入「手工」。
-- SQLite 不支持 ALTER TABLE ADD CONSTRAINT，故整表重建。
-- 无其它表以外键引用 exhibition_edition，重建安全。

UPDATE exhibition_edition SET data_source = 'jufair+cnexpo'
 WHERE data_source IN ('jufair/cnexpo', 'cnexpo/jufair');
UPDATE exhibition_edition SET data_source = '手工'
 WHERE data_source IN ('web-search', 'official-press-release');

CREATE TABLE exhibition_edition_new (
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

INSERT INTO exhibition_edition_new SELECT
    edition_id, brand_id, edition_num, year, date_start, date_end, city, venue, status,
    area_sqm, exhibitors_count, visitors_count, overseas_exhibitor_pct, booth_price_per_sqm,
    heat_score, yoy_trend, anomaly_flag, data_source, recorded_at, notes
FROM exhibition_edition;

DROP TABLE exhibition_edition;
ALTER TABLE exhibition_edition_new RENAME TO exhibition_edition;

CREATE INDEX IF NOT EXISTS idx_edition_brand_year ON exhibition_edition(brand_id, year);
CREATE INDEX IF NOT EXISTS idx_edition_year       ON exhibition_edition(year);
CREATE INDEX IF NOT EXISTS idx_edition_status     ON exhibition_edition(status);
