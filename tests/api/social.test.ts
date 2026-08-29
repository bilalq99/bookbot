import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { exerciseId, makeApp, publishSimple, registerAgent, type Agent, type TestWorld } from './helpers'

describe('feed, follows, likes, comments, notifications', () => {
  let world: TestWorld
  let a: Agent // author
  let b: Agent // viewer
  let bench: number
  let workoutId: number

  beforeEach(async () => {
    world = makeApp()
    a = await registerAgent(world.app, 'author')
    b = await registerAgent(world.app, 'viewer')
    bench = await exerciseId(a, 'bench-press')
    workoutId = (await publishSimple(a, bench, [{ weightKg: 100, reps: 5 }], 'Push Day')).workout.id
  })

  it('follow gates the following feed; everyone scope shows all; counters update', async () => {
    let feed = await b.get('/api/feed?scope=following')
    expect(feed.body.items).toHaveLength(0)
    feed = await b.get('/api/feed?scope=everyone')
    expect(feed.body.items).toHaveLength(1)

    await b.post('/api/users/author/follow').expect(204)
    await b.post('/api/users/author/follow').expect(204) // idempotent
    const profile = await b.get('/api/users/author')
    expect(profile.body.user.followerCount).toBe(1)
    expect(profile.body.viewerFollows).toBe(true)

    feed = await b.get('/api/feed?scope=following')
    expect(feed.body.items).toHaveLength(1)
    expect(feed.body.items[0].author.username).toBe('author')
    expect(feed.body.items[0].viewerLiked).toBe(false)

    await b.delete('/api/users/author/follow').expect(204)
    feed = await b.get('/api/feed?scope=following')
    expect(feed.body.items).toHaveLength(0)
  })

  it('self-follow is rejected', async () => {
    const res = await a.post('/api/users/author/follow')
    expect(res.status).toBe(400)
  })

  it('feed cursor pagination pages without overlap, newest first', async () => {
    for (let i = 0; i < 5; i++) {
      await publishSimple(a, bench, [{ weightKg: 60 + i, reps: 5 }], `S${i}`)
    }
    const page1 = await b.get('/api/feed?scope=everyone&limit=3')
    expect(page1.body.items).toHaveLength(3)
    expect(page1.body.nextCursor).not.toBeNull()
    const page2 = await b.get(`/api/feed?scope=everyone&limit=3&cursor=${page1.body.nextCursor}`)
    const ids1 = page1.body.items.map((w: { id: number }) => w.id)
    const ids2 = page2.body.items.map((w: { id: number }) => w.id)
    expect(ids1.filter((id: number) => ids2.includes(id))).toHaveLength(0)
    const all = [...ids1, ...ids2]
    expect([...all].sort((x, y) => y - x)).toEqual(all) // strictly descending
  })

  it('like toggles idempotently, keeps counts, and manages the notification', async () => {
    await b.post(`/api/workouts/${workoutId}/like`).expect(204)
    await b.post(`/api/workouts/${workoutId}/like`).expect(204) // no double count
    let detail = await b.get(`/api/workouts/${workoutId}`)
    expect(detail.body.workout.likeCount).toBe(1)
    expect(detail.body.workout.viewerLiked).toBe(true)

    let notifs = await a.get('/api/notifications')
    expect(notifs.body.items.filter((n: { type: string }) => n.type === 'like')).toHaveLength(1)
    expect(notifs.body.unreadCount).toBe(1)

    await b.delete(`/api/workouts/${workoutId}/like`).expect(204)
    detail = await b.get(`/api/workouts/${workoutId}`)
    expect(detail.body.workout.likeCount).toBe(0)
    notifs = await a.get('/api/notifications')
    expect(notifs.body.items.filter((n: { type: string }) => n.type === 'like')).toHaveLength(0)
  })

  it('comments create/list/delete with counts; owner may delete others’ comments', async () => {
    const c1 = await b.post(`/api/workouts/${workoutId}/comments`).send({ body: 'chalk up 🤜' })
    expect(c1.status).toBe(201)
    await b.post(`/api/workouts/${workoutId}/comments`).send({ body: 'strong.' })

    const list = await a.get(`/api/workouts/${workoutId}/comments`)
    expect(list.body.comments.map((c: { body: string }) => c.body)).toEqual(['chalk up 🤜', 'strong.'])

    // a third user may not delete b's comment
    const c = await registerAgent(world.app, 'stranger')
    await c.delete(`/api/comments/${c1.body.comment.id}`).expect(403)
    // the workout owner may
    await a.delete(`/api/comments/${c1.body.comment.id}`).expect(204)
    const detail = await a.get(`/api/workouts/${workoutId}`)
    expect(detail.body.workout.commentCount).toBe(1)
  })

  it('empty comments are rejected', async () => {
    await b.post(`/api/workouts/${workoutId}/comments`).send({ body: '   ' }).expect(400)
  })

  it('PR publishes fan out to followers and read-all clears the inbox', async () => {
    await b.post('/api/users/author/follow')
    await publishSimple(a, bench, [{ weightKg: 120, reps: 1 }], 'PR Day')
    const notifs = await b.get('/api/notifications')
    const pr = notifs.body.items.find((n: { type: string }) => n.type === 'pr')
    expect(pr).toBeDefined()
    expect(pr.actor.username).toBe('author')
    expect(pr.prSummary[0].exerciseName).toBe('Bench Press')

    await b.post('/api/notifications/read-all').expect(204)
    const after = await b.get('/api/notifications')
    expect(after.body.unreadCount).toBe(0)
  })

  it('likes and comments on drafts 404', async () => {
    const draft = await a.post('/api/workouts').send({ title: 'wip' })
    await b.post(`/api/workouts/${draft.body.workout.id}/like`).expect(404)
    await b.post(`/api/workouts/${draft.body.workout.id}/comments`).send({ body: 'hi' }).expect(404)
  })

  it('account deletion requires the password, cascades content, and fixes counters', async () => {
    await b.post('/api/users/author/follow')
    await b.post(`/api/workouts/${workoutId}/like`)
    await b.post(`/api/workouts/${workoutId}/comments`).send({ body: 'nice' })

    await b.delete('/api/users/me').send({ password: 'wrong-password' }).expect(401)
    await b.delete('/api/users/me').send({ password: 'password1' }).expect(204)

    // The account is gone and can no longer log in.
    await b.get('/api/auth/me').expect(401)
    const login = await request(world.app)
      .post('/api/auth/login')
      .send({ username: 'viewer', password: 'password1' })
    expect(login.status).toBe(401)

    // The author's counters and workout stats no longer reflect the deleted user.
    const profile = await a.get('/api/users/author')
    expect(profile.body.user.followerCount).toBe(0)
    const detail = await a.get(`/api/workouts/${workoutId}`)
    expect(detail.body.workout.likeCount).toBe(0)
    expect(detail.body.workout.commentCount).toBe(0)
  })

  it('user search ranks username prefix first; suggested excludes followed', async () => {
    const search = await b.get('/api/users/search?q=auth')
    expect(search.body.users[0].username).toBe('author')
    let suggested = await b.get('/api/users/suggested')
    expect(suggested.body.users.map((u: { username: string }) => u.username)).toContain('author')
    await b.post('/api/users/author/follow')
    suggested = await b.get('/api/users/suggested')
    expect(suggested.body.users.map((u: { username: string }) => u.username)).not.toContain('author')
  })
})
