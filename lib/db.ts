import Database from 'better-sqlite3'
import path from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(path.join(process.cwd(), 'mwlab.db'), {
      readonly: true,
      fileMustExist: true,
    })
    db.pragma('journal_mode = WAL')
    db.pragma('cache_size = -64000')
  }
  return db
}
