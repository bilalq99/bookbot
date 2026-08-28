// FROZEN CONTRACT — do not edit.
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export type AppDb = Database.Database

/** Open (creating parent dirs as needed) and configure the SQLite database. */
export function openDb(dbPath: string): AppDb {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true })
  }
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  db.pragma('synchronous = NORMAL')
  return db
}
