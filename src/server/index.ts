// FROZEN CONTRACT — do not edit. Boot: dirs -> db -> migrate -> listen.
import fs from 'node:fs'
import { config } from './config'
import { openDb } from './db/client'
import { migrate } from './db/migrate'
import { createApp } from './app'
import { sweepExpiredSessions } from './auth/session'

fs.mkdirSync(config.uploadsDir, { recursive: true })

const db = openDb(config.dbPath)
migrate(db)

const app = createApp(db)

app.listen(config.port, () => {
  console.log(`Chalk listening on http://localhost:${config.port}`)
})

setInterval(() => {
  try {
    sweepExpiredSessions(db)
  } catch (err) {
    console.error('session sweep failed', err)
  }
}, 3600_000).unref()
