-- MWLAB-2026 · PostgreSQL DDL v1.0
-- Converted from schema/init_db.sql (SQLite → PostgreSQL)
-- Supabase migration: 20260506190000_init

-- ─── RLS Helper Function ────────────────────────────────────────────
-- Reads user role from JWT app_metadata. Requires Supabase
-- Custom Access Token Hook to inject app_metadata into JWT claims.
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'role')::TEXT,
    'readonly'
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ─── Table A: exhibition_brand (primary brand table) ─────────────────
CREATE TABLE IF NOT EXISTS exhibition_brand (
    brand_id              TEXT      PRIMARY KEY,
    name_cn               TEXT      NOT NULL,
    name_en               TEXT      NOT NULL DEFAULT '',
    first_year            INTEGER,
    organizer             TEXT      NOT NULL DEFAULT '',
    co_organizer          TEXT      NOT NULL DEFAULT '',
    city                  TEXT      NOT NULL DEFAULT '',
    frequency             TEXT      NOT NULL DEFAULT '',
    industry_l1           TEXT      NOT NULL DEFAULT '',
    industry_l2           TEXT      NOT NULL DEFAULT '',
    competition_relation  TEXT      NOT NULL DEFAULT ''
                            CHECK (competition_relation IN ('是', '否', '')),
    mds_related           TEXT      NOT NULL DEFAULT '',
    scale_score           INTEGER   CHECK (scale_score IS NULL OR scale_score BETWEEN 1 AND 10),
    is_international      INTEGER   NOT NULL DEFAULT 0,
    is_ufi_certified      INTEGER   NOT NULL DEFAULT 0,
    ma_potential          INTEGER   CHECK (ma_potential IS NULL OR ma_potential BETWEEN 1 AND 5),
    strategic_relevance   INTEGER   CHECK (strategic_relevance IS NULL OR strategic_relevance BETWEEN 1 AND 5),
    competitor_group      TEXT      NOT NULL DEFAULT '',
    website               TEXT      NOT NULL DEFAULT '',
    notes                 TEXT      NOT NULL DEFAULT '',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table B: exhibition_edition (temporal data per edition) ─────────
CREATE TABLE IF NOT EXISTS exhibition_edition (
    edition_id              TEXT      PRIMARY KEY,
    brand_id                TEXT      NOT NULL
                                REFERENCES exhibition_brand(brand_id) ON DELETE CASCADE,
    edition_num             INTEGER,
    year                    INTEGER,
    date_start              DATE,
    date_end                DATE,
    city                    TEXT      NOT NULL DEFAULT '',
    venue                   TEXT      NOT NULL DEFAULT '',
    status                  TEXT      NOT NULL DEFAULT ''
                                CHECK (status IN ('已举办', '即将举办', '取消', '延期', '')),
    area_sqm                INTEGER,
    exhibitors_count        INTEGER,
    visitors_count          INTEGER,
    overseas_exhibitor_pct  REAL,
    booth_price_per_sqm     INTEGER,
    heat_score              INTEGER
                                CHECK (heat_score IS NULL OR heat_score BETWEEN 1 AND 5),
    yoy_trend               TEXT      NOT NULL DEFAULT ''
                                CHECK (yoy_trend IN ('上升', '平稳', '下降', '')),
    anomaly_flag            INTEGER   NOT NULL DEFAULT 0,
    data_source             TEXT      NOT NULL DEFAULT '',
    recorded_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    notes                   TEXT      NOT NULL DEFAULT ''
);

-- ─── Table C: data_provenance (source tracking) ──────────────────────
CREATE TABLE IF NOT EXISTS data_provenance (
    record_id       TEXT      PRIMARY KEY,
    brand_id        TEXT      REFERENCES exhibition_brand(brand_id) ON DELETE SET NULL,
    source_site     TEXT      NOT NULL
                        CHECK (source_site IN ('jufair', 'cnexpo', 'manual')),
    source_url      TEXT      NOT NULL,
    raw_payload     TEXT      NOT NULL DEFAULT '{}',
    crawled_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    crawl_batch_id  TEXT      NOT NULL DEFAULT '',
    notes           TEXT      NOT NULL DEFAULT ''
);

-- ─── Table D: crawl_log (crawl job tracking) ─────────────────────────
CREATE TABLE IF NOT EXISTS crawl_log (
    id              BIGSERIAL PRIMARY KEY,
    batch_id        TEXT      NOT NULL UNIQUE,
    source_site     TEXT      NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL,
    finished_at     TIMESTAMPTZ,
    status          TEXT      NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'success', 'failed', 'partial')),
    total_fetched   INTEGER   NOT NULL DEFAULT 0,
    total_inserted  INTEGER   NOT NULL DEFAULT 0,
    total_skipped   INTEGER   NOT NULL DEFAULT 0,
    error_message   TEXT      NOT NULL DEFAULT '',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Table E: manual_tag_history (tag change audit) ──────────────────
CREATE TABLE IF NOT EXISTS manual_tag_history (
    id          BIGSERIAL   PRIMARY KEY,
    brand_id    TEXT        NOT NULL
                    REFERENCES exhibition_brand(brand_id) ON DELETE CASCADE,
    field_name  TEXT        NOT NULL,
    old_value   TEXT        NOT NULL DEFAULT '',
    new_value   TEXT        NOT NULL,
    changed_by  TEXT        NOT NULL,
    changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reason      TEXT        NOT NULL DEFAULT ''
);

-- ─── Indexes ─────────────────────────────────────────────────────────
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

-- ─── Row Level Security ──────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE exhibition_brand ENABLE ROW LEVEL SECURITY;
ALTER TABLE exhibition_edition ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_provenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_tag_history ENABLE ROW LEVEL SECURITY;

-- exhibition_brand: all authenticated users can read
CREATE POLICY "brand_select" ON exhibition_brand
    FOR SELECT TO authenticated USING (true);

-- exhibition_brand: admin full access, manager can update (for tagging)
CREATE POLICY "brand_admin_all" ON exhibition_brand
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

CREATE POLICY "brand_manager_update" ON exhibition_brand
    FOR UPDATE TO authenticated
    USING (get_user_role() = 'manager')
    WITH CHECK (get_user_role() = 'manager');

-- exhibition_edition: all authenticated users can read
CREATE POLICY "edition_select" ON exhibition_edition
    FOR SELECT TO authenticated USING (true);

-- exhibition_edition: admin full access
CREATE POLICY "edition_admin_all" ON exhibition_edition
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

-- data_provenance: all authenticated users can read
CREATE POLICY "provenance_select" ON data_provenance
    FOR SELECT TO authenticated USING (true);

-- data_provenance: admin full access
CREATE POLICY "provenance_admin_all" ON data_provenance
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

-- crawl_log: all authenticated users can read (system writes via service_role)
CREATE POLICY "crawl_log_select" ON crawl_log
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "crawl_log_admin_all" ON crawl_log
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');

-- manual_tag_history: all authenticated users can read
CREATE POLICY "tag_history_select" ON manual_tag_history
    FOR SELECT TO authenticated USING (true);

-- manual_tag_history: admin/manager can insert (tag changes)
CREATE POLICY "tag_history_insert" ON manual_tag_history
    FOR INSERT TO authenticated
    WITH CHECK (get_user_role() IN ('admin', 'manager'));

CREATE POLICY "tag_history_admin_all" ON manual_tag_history
    FOR ALL TO authenticated
    USING (get_user_role() = 'admin')
    WITH CHECK (get_user_role() = 'admin');
