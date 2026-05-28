-- Migration 004: exhibition_timeline + exhibition_relation

CREATE TABLE IF NOT EXISTS exhibition_timeline (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  brand_id    TEXT    NOT NULL REFERENCES exhibition_brand(brand_id) ON DELETE CASCADE,
  event_date  TEXT    NOT NULL,
  event_type  TEXT    NOT NULL CHECK(event_type IN (
                '战略合作','收购意向','资本进入','高管变动',
                '展会改名','主办方变更','合作谈判','实地考察','其他')),
  title       TEXT    NOT NULL,
  description TEXT,
  counterpart TEXT,
  outcome     TEXT,
  source_url  TEXT,
  created_by  TEXT    NOT NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exhibition_relation (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  from_brand_id TEXT NOT NULL REFERENCES exhibition_brand(brand_id),
  to_brand_id   TEXT NOT NULL REFERENCES exhibition_brand(brand_id),
  relation_type TEXT NOT NULL CHECK(relation_type IN (
                  '竞争','合作','母子','收购目标','参考标杆','同主办方')),
  notes         TEXT,
  created_by    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_brand_id, to_brand_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_timeline_brand ON exhibition_timeline(brand_id, event_date);
CREATE INDEX IF NOT EXISTS idx_relation_from  ON exhibition_relation(from_brand_id);
CREATE INDEX IF NOT EXISTS idx_relation_to    ON exhibition_relation(to_brand_id);

INSERT OR IGNORE INTO schema_version(version, description, applied_at)
VALUES('004', 'exhibition_timeline + exhibition_relation', datetime('now'));
