-- Phase 5: 情报后端 · 新增表迁移
-- 执行方式: sqlite3 /path/to/mwlab.db < schema/migrations/005_intel_tables.sql
-- 依赖: exhibition_brand 表必须已存在

PRAGMA foreign_keys = ON;

-- ─── 表1: intel_report（统一调研报告存储）─────────────────────────
CREATE TABLE IF NOT EXISTS intel_report (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type     TEXT    NOT NULL
                        CHECK (report_type IN (
                            'industry_research',
                            'brand_research',
                            'batch_prospect',
                            'single_prospect'
                        )),
    -- 输入参数（根据 report_type 填写对应字段）
    brand_id        TEXT    REFERENCES exhibition_brand(brand_id) ON DELETE SET NULL,
    industry_l1     TEXT,
    industry_l2     TEXT,
    target_company  TEXT,   -- single_prospect 时的目标公司名
    params_json     TEXT    NOT NULL DEFAULT '{}',  -- 完整输入参数 JSON
    -- 输出内容
    report_md       TEXT    NOT NULL DEFAULT '',    -- Markdown 报告正文
    report_file     TEXT    NOT NULL DEFAULT '',    -- 相对项目根的文件路径
    -- 元数据
    status          TEXT    NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'archived')),
    created_by      TEXT    NOT NULL DEFAULT 'claude-code',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_intel_report_type
    ON intel_report(report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_report_brand
    ON intel_report(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intel_report_industry
    ON intel_report(industry_l1, industry_l2) WHERE industry_l1 IS NOT NULL;

-- ─── 表2: customer_prospect（批量客户挖掘结果）────────────────────
CREATE TABLE IF NOT EXISTS customer_prospect (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    -- 关联
    intel_report_id     INTEGER REFERENCES intel_report(id) ON DELETE SET NULL,
    brand_id            TEXT    REFERENCES exhibition_brand(brand_id) ON DELETE SET NULL,
    -- 数据来源
    source_type         TEXT    NOT NULL
                            CHECK (source_type IN ('qcc_search', 'manual', 'db_match')),
    -- 企查查字段（API 返回原始字段名，snake_case 映射）
    qcc_key_no          TEXT,           -- 企查查内部唯一 ID (KeyNo)
    company_name        TEXT    NOT NULL,
    credit_code         TEXT,           -- 统一社会信用代码 (CreditCode)
    oper_name           TEXT,           -- 法定代表人 (OperName)
    start_date          TEXT,           -- 成立日期 YYYY-MM-DD (StartDate)
    company_status      TEXT,           -- 企业状态 (Status)
    reg_no              TEXT,           -- 注册号 (No)
    address             TEXT,           -- 注册地址 (Address)
    -- BD 评估字段
    prospect_score      INTEGER CHECK (prospect_score IS NULL OR prospect_score BETWEEN 1 AND 5),
    contact_status      TEXT    NOT NULL DEFAULT ''
                            CHECK (contact_status IN ('未接触', '已接触', '谈判中', '合作中', '放弃', '')),
    notes               TEXT    NOT NULL DEFAULT '',
    -- 元数据
    created_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_prospect_brand
    ON customer_prospect(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_company
    ON customer_prospect(company_name);
CREATE INDEX IF NOT EXISTS idx_prospect_qcc
    ON customer_prospect(qcc_key_no) WHERE qcc_key_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_prospect_report
    ON customer_prospect(intel_report_id) WHERE intel_report_id IS NOT NULL;
