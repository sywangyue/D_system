import Database from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'mwlab.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH, { readonly: true, fileMustExist: true })
    db.pragma('journal_mode = WAL')
    db.pragma('cache_size = -64000')
  }
  return db
}

// 写操作用：每次请求新建连接，用完关闭
export function getWritableDb(): Database.Database {
  const wdb = new Database(DB_PATH, { fileMustExist: true })
  wdb.pragma('journal_mode = WAL')
  wdb.pragma('foreign_keys = ON')
  return wdb
}
