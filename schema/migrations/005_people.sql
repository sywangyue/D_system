-- Migration 005: person + exhibition_contact + contact_relation

CREATE TABLE IF NOT EXISTS person (
  person_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  title      TEXT,
  company    TEXT,
  linkedin   TEXT,
  email      TEXT,
  phone      TEXT,
  notes      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exhibition_contact (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  person_id    INTEGER NOT NULL REFERENCES person(person_id) ON DELETE CASCADE,
  brand_id     TEXT    NOT NULL REFERENCES exhibition_brand(brand_id),
  role         TEXT,
  contact_date TEXT,
  notes        TEXT,
  created_by   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS contact_relation (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  from_person_id INTEGER NOT NULL REFERENCES person(person_id),
  to_person_id   INTEGER NOT NULL REFERENCES person(person_id),
  relation_type  TEXT CHECK(relation_type IN ('上下级','同事','商业伙伴','竞争对手','其他')),
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(from_person_id, to_person_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_person ON exhibition_contact(person_id);
CREATE INDEX IF NOT EXISTS idx_contact_brand  ON exhibition_contact(brand_id);

INSERT OR IGNORE INTO schema_version(version, description, applied_at)
VALUES('005', 'person + exhibition_contact + contact_relation', datetime('now'));
