-- 016: resource —— 报告与采集资源的索引表
--
-- 背景：本系统的核心功能是「存储报告与采集来的资源」，不是展示后台数据。
--   但落库现状是：48 个资源文件散在 reports/ 与 exports/ 四个目录，
--   intel_report 只有 2 行且 report_file 两条都是空字符串。
--   也就是说核心资产完全没有索引，只能靠文件系统和人脑找。
--
-- 设计要点：
--   1. 文件本身留在磁盘（reports/ 与 exports/），本表只存相对路径。
--      理由：docx/xlsx 要用 Office 打开，从 BLOB 取反而绕；
--      且采集脚本本来就在往 reports/ 写，不用改采集侧。
--   2. 四个归属字段（opp_id / company_id / brand_id / report_id）**全部可空**。
--      一份行业调研报告不挂任何实体，只挂 industry_l1；
--      一份企查查原始 json 挂 company；现场调研资料挂 brand。
--   3. 不设 is_latest 列。同一对象的多版本靠 collected_at 倒序取最新
--      （实测杭州川方至医疗器械一家跑过 6 轮，产出 10 个文件）。
--   4. sha256 用于识别字节级重复，file_path 唯一防重复登记。

CREATE TABLE IF NOT EXISTS resource (
    resource_id  INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT    NOT NULL
                     CHECK (kind IN ('report', 'raw', 'export', 'roster', 'note')),
    title        TEXT    NOT NULL,
    file_path    TEXT    NOT NULL UNIQUE,      -- 相对仓库根，如 reports/customer/xxx.docx
    mime         TEXT,
    size_bytes   INTEGER,
    sha256       TEXT,

    -- 归属：全部可空，一份资源可以只挂其中一个，也可以都不挂
    opp_id       INTEGER REFERENCES opportunity(opp_id)           ON DELETE SET NULL,
    company_id   INTEGER REFERENCES company(company_id)           ON DELETE SET NULL,
    brand_id     TEXT    REFERENCES exhibition_brand(brand_id)    ON DELETE SET NULL,
    report_id    INTEGER REFERENCES intel_report(id)              ON DELETE SET NULL,
    industry_l1  TEXT,                          -- 行业调研报告只挂行业，不挂实体

    source       TEXT,                          -- qcc|jufair|cnexpo|expofinder|manual
    collected_at TEXT,                          -- 采集/生成时间，多版本靠它排序
    created_by   TEXT    NOT NULL,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_resource_company  ON resource(company_id) WHERE company_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resource_opp      ON resource(opp_id)     WHERE opp_id     IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resource_brand    ON resource(brand_id)   WHERE brand_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_resource_kind     ON resource(kind, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_resource_sha      ON resource(sha256)     WHERE sha256     IS NOT NULL;
