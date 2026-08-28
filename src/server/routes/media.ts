// PLACEHOLDER — owned by agent S3 (server-social). Replace entirely; keep the
// default-export factory signature. Route (mounted at /api/media):
//   POST / — multipart field "file"; <= 5 MB (multer limits -> 413); jpeg/png/webp
//   verified by MAGIC BYTES (not extension); store uploads/<32-hex>.<ext> via
//   crypto.randomUUID/randomBytes; insert unattached media row; 201 { media }.
// Uploads dir comes from config.uploadsDir (ensure mkdirSync recursive at router build).
import { Router } from 'express'
import type { AppDb } from '../db/client'

export default function mediaRoutes(_db: AppDb): Router {
  const router = Router()
  return router
}
