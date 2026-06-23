-- ============================================================
-- MEDICA / REHACARE 影子代理调研数据库
-- 引擎: SQLite 3.35+
-- 核心设计原则:
--   1. 一家展商多年参展 → participations 多行，每行一届
--   2. 主排查维度：同一 booth_full 不同届出现不同 vis_hash
--   3. vis_hash 是 VIS 系统跨年唯一展商 ID（来自官网 URL）
--   4. 2025 Medica 为锚定基准年
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------
-- 1. EDITIONS  展会届次主表
--    关键字段: oid = Messe Düsseldorf VIS 系统展会对象 ID
--    已知 OID: Medica 2024 = 80396 | Medica 2025 = 85465
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS editions (
    edition_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    show_name     TEXT    NOT NULL,         -- 'Medica' | 'Rehacare'
    edition_year  INTEGER NOT NULL,         -- 2021 ~ 2025
    oid           INTEGER UNIQUE,           -- VIS 系统 Object ID（抓取关键参数）
    city          TEXT    DEFAULT 'Düsseldorf',
    date_start    DATE,                     -- e.g. 2024-11-11
    date_end      DATE,                     -- e.g. 2024-11-14
    is_anchor     INTEGER DEFAULT 0,        -- 1 = 锚定基准年（Medica 2025）
    notes         TEXT,
    scraped_at    DATETIME,

    UNIQUE(show_name, edition_year)
);

-- 预填已知届次（OID 待 Claude Code 爬取补全）
INSERT OR IGNORE INTO editions (show_name, edition_year, oid, is_anchor, date_start, date_end) VALUES
    ('Medica',    2021, NULL,  0, '2021-11-15', '2021-11-18'),
    ('Medica',    2022, NULL,  0, '2022-11-14', '2022-11-17'),
    ('Medica',    2023, NULL,  0, '2023-11-13', '2023-11-16'),
    ('Medica',    2024, 80396, 0, '2024-11-11', '2024-11-14'),
    ('Medica',    2025, 85465, 1, '2025-11-17', '2025-11-20'),
    ('Rehacare',  2022, NULL,  0, '2022-10-26', '2022-10-29'),
    ('Rehacare',  2024, NULL,  0, '2024-10-23', '2024-10-26');


-- ------------------------------------------------------------
-- 2. PARTICIPATIONS  参展记录核心表
--    ★ 每行 = 一家企业在一届展会上的一个展位
--    ★ 同一展商两届参展 → 两行（edition_id 不同）
--    ★ 同一展位两家共展（co-exhibitor）→ 两行（vis_hash 不同）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS participations (
    part_id           INTEGER PRIMARY KEY AUTOINCREMENT,

    -- 展会归属
    edition_id        INTEGER NOT NULL REFERENCES editions(edition_id),

    -- VIS 系统展商唯一标识（跨年持久，来自 URL hash）
    vis_hash          TEXT    NOT NULL,     -- e.g. 'QW73U2v2Q0aMVQqulQE3OQ'

    -- 当届展示数据（可能每年不同，如公司改名）
    raw_name          TEXT    NOT NULL,     -- 官网当届显示名
    raw_country       TEXT,                 -- 当届显示国家
    country_code      CHAR(2),             -- ISO 3166-1 alpha-2

    -- ★ 展位信息（影子代理核心排查字段）
    hall              TEXT,                 -- 展馆号, e.g. '7', '13', '16'
    booth_number      TEXT,                 -- 展位编号, e.g. 'C06', 'A12'
    booth_full        TEXT GENERATED ALWAYS AS (
                          TRIM(COALESCE(hall,'') || ' ' || COALESCE(booth_number,''))
                      ) STORED,            -- 拼接完整展位, e.g. '7 C06'

    -- 分类与类型
    product_categories TEXT,               -- 半角分号分隔的产品类目
    participation_type TEXT DEFAULT 'exhibitor', -- 'exhibitor' | 'co-exhibitor' | 'organizer'

    -- 溯源与元数据
    profile_url       TEXT,                -- e.g. /vis/v1/en/exhprofiles/{vis_hash}
    scraped_at        DATETIME DEFAULT (datetime('now')),

    -- 同一展会同一展位同一企业只能有一条记录
    UNIQUE(edition_id, booth_full, vis_hash)
);

CREATE INDEX IF NOT EXISTS idx_part_booth     ON participations(booth_full, edition_id);
CREATE INDEX IF NOT EXISTS idx_part_vis_hash  ON participations(vis_hash);
CREATE INDEX IF NOT EXISTS idx_part_edition   ON participations(edition_id);
CREATE INDEX IF NOT EXISTS idx_part_country   ON participations(country_code, edition_id);


-- ------------------------------------------------------------
-- 3. COMPANY_ENTITIES  展商主体去重表
--    以 vis_hash 为主键，保存 2025 锚定年规范名称
--    注意：一个 vis_hash 在不同年份可能有不同 raw_name
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS company_entities (
    vis_hash         TEXT    PRIMARY KEY,   -- VIS 系统持久 ID
    canonical_name   TEXT,                  -- 锚定年（2025）或最近一届的规范名
    canonical_country TEXT,
    website          TEXT,
    first_seen_year  INTEGER,
    last_seen_year   INTEGER,
    total_editions   INTEGER DEFAULT 0,
    created_at       DATETIME DEFAULT (datetime('now')),
    updated_at       DATETIME DEFAULT (datetime('now'))
);


-- ------------------------------------------------------------
-- 4. SEED_AGENTS  影子代理种子名单（人工录入）
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS seed_agents (
    seed_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    company_name     TEXT    NOT NULL,
    vis_hash         TEXT,                  -- 如果已从 VIS 系统匹配到
    country_code     CHAR(2),
    known_booths     TEXT,                  -- JSON 数组，e.g. '["7 C06","13 A12"]'
    flagged_year     INTEGER,
    flagged_reason   TEXT,
    flagged_by       TEXT,
    confidence       TEXT CHECK(confidence IN ('HIGH','MED','LOW')) DEFAULT 'MED',
    created_at       DATETIME DEFAULT (datetime('now'))
);


-- ------------------------------------------------------------
-- 5. ANOMALY_FLAGS  检测到的异常记录
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anomaly_flags (
    flag_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    flag_type        TEXT NOT NULL,
        -- 'booth_rotation'    : 同展位不同届出现不同企业（核心信号）
        -- 'name_change'       : 同 vis_hash 不同届 raw_name 变化
        -- 'seed_match'        : 命中种子名单
        -- 'cn_in_intl_hall'  : 国家CN出现在国际馆
        -- 'batch_booths'      : 单企业同届连续展位≥3
    show_name        TEXT,
    booth_full       TEXT,
    edition_year_a   INTEGER,
    vis_hash_a       TEXT,
    company_name_a   TEXT,
    edition_year_b   INTEGER,
    vis_hash_b       TEXT,
    company_name_b   TEXT,
    confidence_score INTEGER,               -- 0-100
    evidence_detail  TEXT,                  -- JSON
    reviewed         INTEGER DEFAULT 0,
    created_at       DATETIME DEFAULT (datetime('now'))
);


-- ============================================================
-- VIEWS  分析视图
-- ============================================================

-- V1: 展位历史视图  ★ 影子代理核心查询基础
CREATE VIEW IF NOT EXISTS v_booth_history AS
SELECT
    p.booth_full,
    p.hall,
    p.booth_number,
    e.show_name,
    e.edition_year,
    e.is_anchor,
    p.vis_hash,
    p.raw_name,
    p.raw_country,
    p.country_code,
    p.participation_type,
    p.product_categories,
    p.profile_url,
    COUNT(DISTINCT p.vis_hash)
        OVER (PARTITION BY p.booth_full, e.show_name)     AS unique_companies_at_booth,
    COUNT(DISTINCT e.edition_year)
        OVER (PARTITION BY p.vis_hash, e.show_name)       AS editions_this_company,
    GROUP_CONCAT(e.edition_year, ',')
        OVER (PARTITION BY p.vis_hash, e.show_name
              ORDER BY e.edition_year)                      AS years_participated
FROM participations p
JOIN editions e ON p.edition_id = e.edition_id;


-- V2: 展位轮换异常视图（直接输出可疑展位）
CREATE VIEW IF NOT EXISTS v_booth_rotation_alert AS
SELECT
    show_name,
    booth_full,
    unique_companies_at_booth,
    GROUP_CONCAT(edition_year || ':' || raw_name || '(' || COALESCE(country_code,'?') || ')',
                 ' → ') AS tenant_history
FROM v_booth_history
WHERE unique_companies_at_booth > 1
GROUP BY show_name, booth_full
ORDER BY unique_companies_at_booth DESC, booth_full;


-- V3: 同名 hash 改名记录
CREATE VIEW IF NOT EXISTS v_name_changes AS
SELECT
    p.vis_hash,
    e.show_name,
    GROUP_CONCAT(e.edition_year || ':' || p.raw_name, ' | ')  AS name_history,
    COUNT(DISTINCT p.raw_name)                                 AS distinct_names
FROM participations p
JOIN editions e ON p.edition_id = e.edition_id
GROUP BY p.vis_hash, e.show_name
HAVING COUNT(DISTINCT p.raw_name) > 1;


-- V4: 中国企业出现在 Medica 国际馆（非中国馆）的记录
--     Medica 中国馆为 Hall 5 和 Hall 6（需按实际情况调整）
CREATE VIEW IF NOT EXISTS v_cn_in_intl_hall AS
SELECT
    e.edition_year,
    p.raw_name,
    p.country_code,
    p.hall,
    p.booth_full,
    p.vis_hash
FROM participations p
JOIN editions e ON p.edition_id = e.edition_id
WHERE p.country_code = 'CN'
  AND e.show_name = 'Medica'
  AND p.hall NOT IN ('5', '6');   -- 非中国馆的中国展商


-- ============================================================
-- KEY QUERIES（注释形式保存，供 Claude Code 直接调用）
-- ============================================================

-- Q1: 展位轮换报告（最核心的影子代理证据）
-- SELECT * FROM v_booth_rotation_alert LIMIT 100;

-- Q2: 某个具体展位的完整历史
-- SELECT * FROM v_booth_history WHERE booth_full = '7 C06' AND show_name = 'Medica';

-- Q3: 与种子名单交叉命中
-- SELECT sa.company_name, sa.confidence, p.*, e.edition_year
-- FROM seed_agents sa
-- JOIN participations p ON (p.vis_hash = sa.vis_hash OR p.raw_name LIKE '%' || sa.company_name || '%')
-- JOIN editions e ON p.edition_id = e.edition_id;

-- Q4: 单届次连续批量展位（≥3个相邻）需 Python 后处理

-- Q5: 所有届次参展总览（按展商）
-- SELECT vis_hash, canonical_name, total_editions, first_seen_year, last_seen_year
-- FROM company_entities WHERE total_editions >= 2 ORDER BY total_editions DESC;
