// FROZEN CONTRACT — do not edit. Error envelope, async wrapper, cursor helpers.
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { ZodError, type ZodType } from 'zod'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}

export const notFound = () => new ApiError(404, 'not_found', 'Not found')

/** Express 4 does not catch async errors — wrap every async handler. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

/** Parse + validate a request body; throws ApiError(400) with a readable message. */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const issue = result.error.issues[0]
    const path = issue.path.length ? `${issue.path.join('.')}: ` : ''
    throw new ApiError(400, 'validation_error', `${path}${issue.message}`)
  }
  return result.data
}

/** Route param like :id — integer or 404 (never leak existence via 400). */
export function parseId(param: string | undefined): number {
  const n = Number(param)
  if (!Number.isInteger(n) || n <= 0) throw notFound()
  return n
}

export interface Cursor {
  ts: number
  id: number
}

/** Keyset cursor "<ts>.<id>". Invalid cursors are treated as absent. */
export function parseCursor(raw: unknown): Cursor | null {
  if (typeof raw !== 'string' || raw === '') return null
  const m = /^(\d+)\.(\d+)$/.exec(raw)
  if (!m) return null
  return { ts: Number(m[1]), id: Number(m[2]) }
}

export function makeCursor(ts: number, id: number): string {
  return `${ts}.${id}`
}

export function parseLimit(raw: unknown, def: number, max: number): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return def
  return Math.min(n, max)
}

/** Final error middleware: ApiError -> its envelope; zod -> 400; else 500. */
export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } })
    return
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: { code: 'validation_error', message: err.issues[0]?.message ?? 'Invalid input' } })
    return
  }
  if (err && typeof err === 'object' && (err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json({ error: { code: 'payload_too_large', message: 'Payload too large' } })
    return
  }
  console.error(err)
  res.status(500).json({ error: { code: 'internal', message: 'Internal server error' } })
}
