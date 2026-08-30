// Photo upload, mounted at /api/media — docs/SPEC.md §7:
//   POST / — multipart field "file", <= 5 MB, jpeg/png/webp verified by MAGIC
//   BYTES (never extension); stored as uploads/<32-hex>.<ext>, unattached row.
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { Router } from 'express'
import multer from 'multer'
import type { AppDb } from '../db/client'
import type { MediaOut } from '../../shared/types'
import { config } from '../config'
import { ApiError, asyncHandler } from '../lib/http'
import { requireAuth } from '../auth/middleware'

const MAX_BYTES = 5 * 1024 * 1024

/** Sniff the real image type from leading bytes; null when not an allowed type. */
function sniffImage(buf: Buffer): { ext: string; mime: 'image/jpeg' | 'image/png' | 'image/webp' } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' }
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', mime: 'image/png' }
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buf.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return { ext: 'webp', mime: 'image/webp' }
  }
  return null
}

export default function mediaRoutes(db: AppDb): Router {
  const router = Router()
  router.use(requireAuth(db))

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } })

  const insertMedia = db.prepare(
    `INSERT INTO media (user_id, file_path, mime_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)`,
  )

  router.post(
    '/',
    (req, res, next) => {
      upload.single('file')(req, res, (err: unknown) => {
        if (err && typeof err === 'object' && (err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
          next(new ApiError(413, 'payload_too_large', 'Photos must be 5 MB or smaller'))
          return
        }
        next(err)
      })
    },
    asyncHandler((req, res) => {
      const file = req.file
      if (!file) throw new ApiError(400, 'validation_error', 'file: a photo is required')
      const kind = sniffImage(file.buffer)
      if (!kind) throw new ApiError(400, 'validation_error', 'file: only JPEG, PNG, or WebP photos are allowed')

      const filePath = `${crypto.randomBytes(16).toString('hex')}.${kind.ext}`
      fs.mkdirSync(config.uploadsDir, { recursive: true })
      fs.writeFileSync(path.join(config.uploadsDir, filePath), file.buffer)

      const id = Number(insertMedia.run(req.user!.id, filePath, kind.mime, file.size, Date.now()).lastInsertRowid)
      const media: MediaOut = { id, url: `/uploads/${filePath}` }
      res.status(201).json({ media })
    }),
  )

  return router
}
