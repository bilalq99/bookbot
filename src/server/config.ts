// FROZEN CONTRACT — do not edit. The ONLY file that reads process.env.
import path from 'node:path'

export interface Config {
  port: number
  dbPath: string
  uploadsDir: string
  /** Origins allowed to call the API cross-origin (the Capacitor iOS shell). */
  corsOrigins: Set<string>
}

export const config: Config = {
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || path.join('data', 'chalk.db'),
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
  corsOrigins: new Set(
    (process.env.CORS_ORIGINS || 'capacitor://localhost,ionic://localhost')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  ),
}
