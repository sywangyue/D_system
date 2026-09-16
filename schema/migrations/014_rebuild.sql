-- 014: 重构 —— 产品主体从「展会目录」改为「BD 工作台」
--
-- 背景（docs/REBUILD-2026-09-PLAN.md · docs/IA-2026-09.md）：
--   旧架构里 exhibition_brand 7,401 行是一等公民，而公司侧只有 customer_prospect 495 行，
--   与实际 BD 工作内容倒置。三条业务线（并购标的 / 全新品类 / 项目组支持）的共同宾语
--   都是「公司」，不是「展会」。本次把公司扶正为中心实体，展会降级为被引用的字典。
--
-- 本迁移做四件事：
--   1. 删 5 张定义了但从未写入一行的空表（含其上的 app/people 与 6 个空路由，代码侧另行清理）
--   2. customer_prospect → company，补齐英文名/类型/地理列，删掉方向反了的 intel_report_id
--   3. intel_report 补 opp_id / company_id / title，成为深度调研的落库主体
--   4. 新建 opportunity（三条业务线共用，type 区分）与 opportunity_event（时间线 + 附件）
--
-- 展会四表（exhibition_brand / exhibition_edition / brand_organizer / brand_geo_tag）
--   结构与数据一律不动，只给 exhibition_brand 补一列 company_id 指向主办方公司。
--
-- 回滚：cp data/backups/mwlab_pre-rebuild-20260916.db data/mwlab.db
--       本迁移含 DROP TABLE 与 RENAME，不提供 SQL 级回滚，只能整库还原。

-- ───────────────────────────────────────────────────────────────
-- 1. 删除空表（按外键依赖倒序：引用方先删）
-- ───────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS contact_relation;      -- 0 行，引用 person ×2
DROP TABLE IF EXISTS exhibition_contact;    -- 0 行，引用 exhibition_brand + person
DROP TABLE IF EXISTS person;                -- 0 行
DROP TABLE IF EXISTS exhibition_relation;   -- 0 行，引用 exhibition_brand ×2
DROP TABLE IF EXISTS exhibition_timeline;   -- 0 行，被 opportunity_event 取代

-- ───────────────────────────────────────────────────────────────
-- 2. customer_prospect → company
-- ───────────────────────────────────────────────────────────────
-- 先落掉旧索引：其中 idx_prospect_report 建在待删列 intel_report_id 上，
-- 不先删会报 "error in index idx_prospect_report after drop column"。
-- 其余四个索引名带 prospect 前缀，表改名后语义不符，一并重建。
DROP INDEX IF EXISTS idx_prospect_report;
DROP INDEX IF EXISTS idx_prospect_brand;
DROP INDEX IF EXISTS idx_prospect_company;
DROP INDEX IF EXISTS idx_prospect_qcc;
DROP INDEX IF EXISTS idx_prospect_brand_qcc;

ALTER TABLE customer_prospect RENAME TO company;
ALTER TABLE company RENAME COLUMN id           TO company_id;
ALTER TABLE company RENAME COLUMN company_name TO name;

-- 方向反了：原本是公司指向报告，改为报告指向公司（见第 3 节）
ALTER TABLE company DROP COLUMN intel_report_id;

ALTER TABLE company ADD COLUMN name_en TEXT;    -- 英文版供德方阅读，缺失时回退中文
ALTER TABLE company ADD COLUMN type    TEXT;    -- organizer|exhibitor|service|target|partner
ALTER TABLE company ADD COLUMN city    TEXT;
ALTER TABLE company ADD COLUMN country TEXT;

-- 重建索引（含原来那条 UNIQUE，去重逻辑依赖它，不能丢）
CREATE INDEX        IF NOT EXISTS idx_company_name   ON company(name);
CREATE INDEX        IF NOT EXISTS idx_company_credit ON company(credit_code);
CREATE INDEX        IF NOT EXISTS idx_company_type   ON company(type);
CREATE INDEX        IF NOT EXISTS idx_company_brand  ON company(brand_id)    WHERE brand_id    IS NOT NULL;
CREATE INDEX        IF NOT EXISTS idx_company_qcc    ON company(qcc_key_no)  WHERE qcc_key_no  IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_brand_qcc
    ON company(brand_id, qcc_key_no) WHERE qcc_key_no IS NOT NULL;

-- ───────────────────────────────────────────────────────────────
-- 3. intel_report 扶正为深度调研主体
--    现有 report_type / report_md / report_file / params_json / status 全部保留。
--    target_company 是自由文本，保留可回溯性，但新数据一律写 company_id。
-- ───────────────────────────────────────────────────────────────
ALTER TABLE intel_report ADD COLUMN opp_id     INTEGER;   -- → opportunity(opp_id)
ALTER TABLE intel_report ADD COLUMN company_id INTEGER;   -- → company(company_id)
ALTER TABLE intel_report ADD COLUMN title      TEXT;      -- 原表无标题列，调研库列表没法展示

CREATE INDEX IF NOT EXISTS idx_report_opp     ON intel_report(opp_id);
CREATE INDEX IF NOT EXISTS idx_report_company ON intel_report(company_id);

-- ───────────────────────────────────────────────────────────────
-- 4. exhibition_brand 补主办方指针（展会表唯一的改动）
-- ───────────────────────────────────────────────────────────────
ALTER TABLE exhibition_brand ADD COLUMN company_id INTEGER;  -- → company(company_id)
CREATE INDEX IF NOT EXISTS idx_brand_company ON exhibition_brand(company_id);

-- ───────────────────────────────────────────────────────────────
-- 5. opportunity —— 机会台主表，100% 人工录入
--
--    type 与 deal_type 是两个维度，不可合并：
--      type      = 业务线，决定顶部 tab
--      deal_type = 交易形式，只对 type='ma' 有意义
--    合成一个字段会导致白地与项目组无法使用「参股 / 承办」等取值。
--
--    detail_json 按 type 存差异字段（见 IA §1.1）。其中的键无法 SQL 排序聚合；
--    若日后需要按对价区间跨标的排序，再 ALTER TABLE 提升为正式列（SQLite 加列无损）。
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunity (
    opp_id          INTEGER PRIMARY KEY AUTOINCREMENT,
    type            TEXT    NOT NULL
                        CHECK (type IN ('ma', 'greenfield', 'project_support')),
    title           TEXT    NOT NULL,
    title_en        TEXT,
    stage           TEXT    NOT NULL DEFAULT 'contact'
                        CHECK (stage IN ('contact', 'intent', 'dd', 'audit', 'closing')),
    deal_type       TEXT    CHECK (deal_type IS NULL OR deal_type IN
                        ('收购', '并购', '参股', '承办', '孵化')),
    company_id      INTEGER REFERENCES company(company_id) ON DELETE SET NULL,
    brand_id        TEXT    REFERENCES exhibition_brand(brand_id) ON DELETE SET NULL,
    md_brand        TEXT,                                  -- interpack / drupa / MEDICA …
    priority        INTEGER CHECK (priority IS NULL OR priority BETWEEN 1 AND 5),
    owner           TEXT,                                  -- user.email
    next_action     TEXT,
    next_action_due TEXT,                                  -- ISO date
    detail_json     TEXT    NOT NULL DEFAULT '{}',
    is_archived     INTEGER NOT NULL DEFAULT 0,
    created_by      TEXT    NOT NULL,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_opp_type_stage ON opportunity(type, stage);
CREATE INDEX IF NOT EXISTS idx_opp_owner      ON opportunity(owner);
CREATE INDEX IF NOT EXISTS idx_opp_due        ON opportunity(next_action_due);
CREATE INDEX IF NOT EXISTS idx_opp_company    ON opportunity(company_id);
CREATE INDEX IF NOT EXISTS idx_opp_brand      ON opportunity(brand_id);

-- ───────────────────────────────────────────────────────────────
-- 6. opportunity_event —— 时间线 + 附件 + 行动日历，一张表
--
--    附件不单独建表：上传文件本身就是时间线上的一个事件
--    （「顾言风 上传了尽调底稿」），合并后少一张表且时间线天然完整。
--    「我的行动日历」用 event_type='meeting' + occurred_at 承载。
--    stage_change 事件是日后计算阶段驻留天数与转化率的唯一数据来源。
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS opportunity_event (
    event_id    INTEGER PRIMARY KEY AUTOINCREMENT,
    opp_id      INTEGER NOT NULL
                    REFERENCES opportunity(opp_id) ON DELETE CASCADE,
    event_type  TEXT    NOT NULL
                    CHECK (event_type IN
                        ('note', 'stage_change', 'file', 'meeting', 'task_done')),
    content     TEXT,
    file_path   TEXT,                                  -- event_type='file' 时用
    occurred_at TEXT,                                  -- event_type='meeting' 的日程时间
    created_by  TEXT    NOT NULL,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);
CREATE INDEX IF NOT EXISTS idx_oppev_opp  ON opportunity_event(opp_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_oppev_when ON opportunity_event(occurred_at);
