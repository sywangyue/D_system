-- 017: intel_report.report_type 枚举补 company_research
--
-- 背景（docs/TASK-D-backfill-reports.md §3）：
--   任务 D 要把 reports/ 下 11 份 docx 回填进 intel_report，其中 10 份的
--   report_type 规格明确写 `company_research`。但 006 建表时的 CHECK 只有四个值：
--       industry_research / brand_research / batch_prospect / single_prospect
--   实测 INSERT 直接崩：CHECK constraint failed: report_type IN (...)
--   即「公司尽调」这个产品里最常用的一类报告，在库里根本存不进去。
--
--   这不是规格写错，是 006 的枚举落后于产品：
--     · app/overview/page.tsx:22 的 REPORT_TYPE 映射里已有 company_research: "公司尽调"
--     · docs/TASK-C-list-detail-pages.md §3.1 的中文映射表同样以 company_research 为准
--     · 库里现有 2 行的 report_type 都不在这四个值之外（industry_research / batch_prospect）
--   属于「代码已经认了、库还不认」的漏项，故拓宽而非替换：
--   四个旧值全部保留（tools/intel/report_writer.py 与既有两行仍依赖它们）。
--
-- ⚠ 本迁移含 DROP TABLE + RENAME，SQLite 无法就地改 CHECK，只能整表重建。
--   company.intel_report_id 有 494 行非空引用，resource.report_id 有 FK 指向本表，
--   因此必须：
--     1. PRAGMA foreign_keys=OFF —— 否则 DROP TABLE 会按 ON DELETE SET NULL
--        把 resource.report_id 清空（行数看不出来，是 §3 警告过的「隐性丢数据」类型）
--     2. PRAGMA legacy_alter_table=ON —— 否则 RENAME 会去重新解析并改写
--        其他表里指向 intel_report 的 REFERENCES 子句，而那一刻旧表已被 DROP，
--        解析会失败（error in table resource after rename: no such table）
--     3. 逐列显式列出搬运（不用 SELECT *）—— 014 就是在这类改动上丢过一列
--     4. 收尾跑 PRAGMA foreign_key_check
--
-- 回滚：cp data/backups/mwlab_pre-taskD-20260917.db data/mwlab.db
--       （DROP + RENAME 无 SQL 级回滚，只能整库还原）

PRAGMA foreign_keys        = OFF;
PRAGMA legacy_alter_table  = ON;

BEGIN;

CREATE TABLE intel_report_new (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    report_type     TEXT    NOT NULL
                        CHECK (report_type IN (
                            'industry_research',
                            'brand_research',
                            'batch_prospect',
                            'single_prospect',
                            'company_research'      -- 017 新增：企查查/人工企业深度尽调
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
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    opp_id          INTEGER,
    company_id      INTEGER,
    title           TEXT
);

-- 逐列搬运。列顺序与 006 + 014 之后的物理顺序一致。
INSERT INTO intel_report_new (
    id, report_type, brand_id, industry_l1, industry_l2, target_company,
    params_json, report_md, report_file, status, created_by,
    created_at, updated_at, opp_id, company_id, title
)
SELECT
    id, report_type, brand_id, industry_l1, industry_l2, target_company,
    params_json, report_md, report_file, status, created_by,
    created_at, updated_at, opp_id, company_id, title
FROM intel_report;

DROP TABLE intel_report;

ALTER TABLE intel_report_new RENAME TO intel_report;

-- 重建 5 个索引（DROP TABLE 会连带删掉，全部照 006 / 014 原样）
CREATE INDEX IF NOT EXISTS idx_intel_report_type
    ON intel_report(report_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_intel_report_brand
    ON intel_report(brand_id) WHERE brand_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_intel_report_industry
    ON intel_report(industry_l1, industry_l2) WHERE industry_l1 IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_report_opp     ON intel_report(opp_id);
CREATE INDEX IF NOT EXISTS idx_report_company ON intel_report(company_id);

COMMIT;

PRAGMA legacy_alter_table  = OFF;
PRAGMA foreign_keys        = ON;
