// FROZEN CONTRACT — do not edit. Express assembly; middleware order is load-bearing.
import express from 'express'
import cookieParser from 'cookie-parser'
import fs from 'node:fs'
import path from 'node:path'
import type { AppDb } from './db/client'
import { config } from './config'
import { errorMiddleware } from './lib/http'
import authRoutes from './routes/auth'
import usersRoutes from './routes/users'
import exercisesRoutes from './routes/exercises'
import workoutsRoutes from './routes/workouts'
import feedRoutes from './routes/feed'
import socialRoutes from './routes/social'
import notificationsRoutes from './routes/notifications'
import mediaRoutes from './routes/media'

export function createApp(db: AppDb): express.Express {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '1mb' }))
  app.use(cookieParser())

  // CSRF guard: non-GET /api requests with an Origin header must be same-origin.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD') return next()
    const origin = req.headers.origin
    if (!origin) return next()
    try {
      if (new URL(origin).host === req.headers.host) return next()
    } catch {
      /* malformed origin falls through to 403 */
    }
    res.status(403).json({ error: { code: 'forbidden', message: 'Cross-origin request rejected' } })
  })

  app.use('/api/auth', authRoutes(db))
  app.use('/api/users', usersRoutes(db))
  app.use('/api/exercises', exercisesRoutes(db))
  app.use('/api/workouts', workoutsRoutes(db))
  app.use('/api/feed', feedRoutes(db))
  app.use('/api', socialRoutes(db)) // /workouts/:id/like(s), /workouts/:id/comments, /comments/:id
  app.use('/api/notifications', notificationsRoutes(db))
  app.use('/api/media', mediaRoutes(db))

  app.use(
    '/uploads',
    express.static(path.resolve(config.uploadsDir), { maxAge: '7d', immutable: true, dotfiles: 'deny' }),
  )

  const clientDist = path.resolve(__dirname, '../client')
  app.use(express.static(clientDist))

  // Unknown /api path: JSON 404, never index.html.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'not_found', message: 'Not found' } })
  })

  // SPA fallback LAST.
  const indexHtml = path.join(clientDist, 'index.html')
  app.get('*', (_req, res) => {
    if (fs.existsSync(indexHtml)) res.sendFile(indexHtml)
    else res.status(404).send('Client not built — run: npm run build')
  })

  app.use(errorMiddleware)
  return app
}
