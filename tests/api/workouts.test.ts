import { beforeEach, describe, expect, it } from 'vitest'
import { exerciseId, makeApp, publishSimple, registerAgent, type Agent, type TestWorld } from './helpers'

describe('workouts and PRs', () => {
  let world: TestWorld
  let a: Agent
  let bench: number
  beforeEach(async () => {
    world = makeApp()
    a = await registerAgent(world.app, 'lifter')
    bench = await exerciseId(a, 'bench-press')
  })

  it('computes totals and est_1rm on create; warmups excluded from totals', async () => {
    const res = await a.post('/api/workouts').send({
      title: 'Push',
      exercises: [
        {
          exerciseId: bench,
          sets: [
            { setType: 'warmup', weightKg: 60, reps: 10 },
            { weightKg: 100, reps: 5, rpe: 8 },
            { weightKg: 102.5, reps: 3 },
          ],
        },
      ],
    })
    expect(res.status).toBe(201)
    const w = res.body.workout
    expect(w.status).toBe('draft')
    expect(w.totalSets).toBe(2)
    expect(w.totalVolumeKg).toBeCloseTo(100 * 5 + 102.5 * 3)
    const sets = w.exercises[0].sets
    expect(sets[1].est1rmKg).toBeCloseTo(100 * (1 + 5 / 30))
    // reps=1 identity is applied at reps=1, and reps>12 gets no estimate
    const single = await a.post('/api/workouts').send({
      exercises: [{ exerciseId: bench, sets: [{ weightKg: 120, reps: 1 }, { weightKg: 40, reps: 20 }] }],
    })
    expect(single.body.workout.exercises[0].sets[0].est1rmKg).toBe(120)
    expect(single.body.workout.exercises[0].sets[1].est1rmKg).toBeNull()
  })

  it('validates sets per metric type, naming the offending indexes', async () => {
    const res = await a.post('/api/workouts').send({
      exercises: [{ exerciseId: bench, sets: [{ weightKg: 100, reps: 5 }, { reps: 5 }] }],
    })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('validation_error')
    expect(res.body.error.message).toContain('exercises[0].sets[1]')
  })

  it('publish detects PRs with strictly-greater upsert; republish never re-awards', async () => {
    const first = await publishSimple(a, bench, [{ weightKg: 100, reps: 5 }])
    expect(first.newPrs.map((p) => p.recordType).sort()).toEqual(['max_est_1rm', 'max_weight'])
    expect(first.workout.prCount).toBe(2)

    // same weight again: ties never displace records
    const tie = await publishSimple(a, bench, [{ weightKg: 100, reps: 5 }])
    expect(tie.newPrs).toEqual([])
    expect(tie.workout.prCount).toBe(0)

    const heavier = await publishSimple(a, bench, [{ weightKg: 105, reps: 3 }])
    const maxW = heavier.newPrs.find((p) => p.recordType === 'max_weight')
    expect(maxW?.value).toBe(105)
    expect(maxW?.previousValue).toBe(100)

    // republish is idempotent
    const again = await a.post(`/api/workouts/${heavier.workout.id}/publish`)
    expect(again.status).toBe(200)
    expect(again.body.newPrs).toEqual([])
  })

  it('publish rejects a workout with zero working sets', async () => {
    const created = await a.post('/api/workouts').send({
      exercises: [{ exerciseId: bench, sets: [{ setType: 'warmup', weightKg: 60, reps: 10 }] }],
    })
    const res = await a.post(`/api/workouts/${created.body.workout.id}/publish`)
    expect(res.status).toBe(400)
  })

  it('deleting the record-holding workout recomputes PRs from remaining history', async () => {
    await publishSimple(a, bench, [{ weightKg: 100, reps: 5 }])
    const big = await publishSimple(a, bench, [{ weightKg: 110, reps: 1 }])
    await a.delete(`/api/workouts/${big.workout.id}`).expect(204)
    const prs = await a.get('/api/users/lifter/prs')
    const maxW = prs.body.prs.find((p: { recordType: string }) => p.recordType === 'max_weight')
    expect(maxW.value).toBe(100)
  })

  it('drafts are invisible to other users (404, not 403)', async () => {
    const created = await a.post('/api/workouts').send({ title: 'secret' })
    const b = await registerAgent(world.app, 'peeker')
    await b.get(`/api/workouts/${created.body.workout.id}`).expect(404)
    // owner still sees it
    await a.get(`/api/workouts/${created.body.workout.id}`).expect(200)
  })

  it('bodyweight, duration, and distance metrics award their record types', async () => {
    const pullup = await exerciseId(a, 'pull-up')
    const plank = await exerciseId(a, 'plank')
    const farmers = await exerciseId(a, 'farmers-carry')
    const res = await a.post('/api/workouts').send({
      exercises: [
        { exerciseId: pullup, sets: [{ reps: 12 }, { weightKg: 20, reps: 5 }] },
        { exerciseId: plank, sets: [{ durationS: 90 }] },
        { exerciseId: farmers, sets: [{ weightKg: 80, distanceM: 30, durationS: 25 }] },
      ],
    })
    const pub = await a.post(`/api/workouts/${res.body.workout.id}/publish`)
    const types = pub.body.newPrs.map((p: { recordType: string }) => p.recordType).sort()
    expect(types).toEqual(['max_distance', 'max_duration', 'max_reps', 'max_weight'])
  })

  it('stats reports totals, streak, and 12 weekly buckets', async () => {
    await publishSimple(a, bench, [{ weightKg: 100, reps: 5 }])
    const stats = await a.get('/api/users/lifter/stats')
    expect(stats.status).toBe(200)
    expect(stats.body.workoutCount).toBe(1)
    expect(stats.body.currentStreakWeeks).toBe(1)
    expect(stats.body.weeklyVolume).toHaveLength(12)
    expect(stats.body.weeklyVolume.at(-1).volumeKg).toBeCloseTo(500)
  })
})
