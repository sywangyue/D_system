-- 013: brand_organizer —— 主办方规范化索引表
--
-- 背景（AUDIT-2026-08-05-organizer）：
--   exhibition_brand.organizer 是一个自由文本字段，一条记录里混装
--   政府机关 + 行业协会 + 实际办展公司，用中文逗号/顿号/分号串起来：
--     "浙江省塑料行业协会、浙江省橡胶工业协会；中国塑料加工工业协会，宁波市经济和信息化委员会"
--   全库 7,283 条有值，拆出 4,652 个不同取值，其中 3,675 个只出现一次。
--   别名分裂严重：励展系 37 种写法、Informa/ITE 系 30+ 种、商务部 3 种。
--
--   后果：app/api/dashboard/route.ts 的 COUNT(DISTINCT b.organizer) 返回 4,652，
--   是个没有意义的数；任何「按主办方聚合」的查询都做不了。
--
-- 方案：不动 organizer 原始字段（保留可回溯性），另建一张一对多的规范化索引表。
--   一个品牌 → N 行，每行一个参与单位，带集团级 canonical 名与类型。
--   由 tools/build_organizer_index.py 从 tools/organizer_alias.json 重建，可反复重跑。

CREATE TABLE IF NOT EXISTS brand_organizer (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id    TEXT    NOT NULL
                    REFERENCES exhibition_brand(brand_id) ON DELETE CASCADE,
    seq         INTEGER NOT NULL,                      -- 在原始字符串中的顺序，从 0 起
    raw_token   TEXT    NOT NULL,                      -- 拆分后的原始写法
    canonical   TEXT    NOT NULL,                      -- 集团级规范名
    org_type    TEXT    NOT NULL
                    CHECK (org_type IN ('企业', '协会', '政府', '组委会', '其他')),
    confidence  TEXT    NOT NULL DEFAULT 'auto'
                    CHECK (confidence IN ('high', 'check', 'auto')),
    -- high = 别名词典命中且已确认; check = 词典命中但归并关系待人工确认; auto = 正则自动归类
    built_at    TEXT    NOT NULL DEFAULT (datetime('now', 'localtime')),
    UNIQUE (brand_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_brand_org_brand     ON brand_organizer(brand_id);
CREATE INDEX IF NOT EXISTS idx_brand_org_canonical ON brand_organizer(canonical);
CREATE INDEX IF NOT EXISTS idx_brand_org_type      ON brand_organizer(org_type);

-- 清理 8 条 organizer='test' 的脏值（且 display_ready=1，已进看板）
INSERT INTO manual_tag_history (brand_id, field_name, old_value, new_value, changed_by, reason, change_source)
SELECT brand_id, 'organizer', organizer, '', 'script/013_brand_organizer',
       '清理测试脏值 organizer=test (AUDIT-2026-08-05)', 'script'
  FROM exhibition_brand WHERE organizer = 'test';

UPDATE exhibition_brand SET organizer = '', updated_at = datetime('now', 'localtime')
 WHERE organizer = 'test';

-- schema_version 的登记行由 schema/db.py 的迁移 runner 写入，此处不重复插入。
