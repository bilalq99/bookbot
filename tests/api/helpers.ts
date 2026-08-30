// Test helpers: an app over in-memory SQLite plus register/login agents.
import type { Express } from 'express'
import request from 'supertest'
import { openDb, type AppDb } from '../../src/server/db/client'
import { migrate } from '../../src/server/db/migrate'
import { createApp } from '../../src/server/app'

export interface TestWorld {
  db: AppDb
  app: Express
}

export function makeApp(): TestWorld {
  const db = openDb(':memory:')
  migrate(db)
  return { db, app: createApp(db) }
}

export type Agent = ReturnType<typeof request.agent>

/** Register a user and return an agent carrying its session cookie. */
export async function registerAgent(app: Express, username: string, password = 'password1'): Promise<Agent> {
  const agent = request.agent(app)
  const res = await agent.post('/api/auth/register').send({ username, password })
  if (res.status !== 201) throw new Error(`register ${username} failed: ${res.status} ${JSON.stringify(res.body)}`)
  return agent
}

/** Find a library exercise id by slug via the API. */
export async function exerciseId(agent: Agent, slug: string): Promise<number> {
  const res = await agent.get('/api/exercises?limit=200')
  const found = (res.body.exercises as { id: number; slug: string | null }[]).find((e) => e.slug === slug)
  if (!found) throw new Error(`exercise ${slug} not found`)
  return found.id
}

/** Create + publish a simple weight_reps workout; returns the publish response body. */
export async function publishSimple(
  agent: Agent,
  exId: number,
  sets: { weightKg?: number; reps?: number; setType?: string }[],
  title = 'Session',
) {
  const created = await agent.post('/api/workouts').send({ title, exercises: [{ exerciseId: exId, sets }] })
  if (created.status !== 201) throw new Error(`create failed: ${JSON.stringify(created.body)}`)
  const published = await agent.post(`/api/workouts/${created.body.workout.id}/publish`)
  if (published.status !== 200) throw new Error(`publish failed: ${JSON.stringify(published.body)}`)
  return published.body as {
    workout: { id: number; totalVolumeKg: number; totalSets: number; prCount: number }
    newPrs: { exerciseName: string; recordType: string; value: number; previousValue: number | null }[]
  }
}
