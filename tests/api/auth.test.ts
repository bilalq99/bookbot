import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { makeApp, registerAgent, type TestWorld } from './helpers'

describe('auth', () => {
  let world: TestWorld
  beforeEach(() => {
    world = makeApp()
  })

  it('registers, logs in, and round-trips the session cookie', async () => {
    const agent = request.agent(world.app)
    const reg = await agent.post('/api/auth/register').send({ username: 'Sarah_Squats', password: 'password1' })
    expect(reg.status).toBe(201)
    expect(reg.body.user.username).toBe('sarah_squats') // lowercased
    expect(reg.headers['set-cookie']?.[0]).toMatch(/sid=.*HttpOnly/)

    const me = await agent.get('/api/auth/me')
    expect(me.status).toBe(200)
    expect(me.body.user.username).toBe('sarah_squats')

    await agent.post('/api/auth/logout').expect(204)
    await agent.get('/api/auth/me').expect(401)

    const login = await request.agent(world.app)
      .post('/api/auth/login')
      .send({ username: 'SARAH_SQUATS', password: 'password1' })
    expect(login.status).toBe(200)
  })

  it('rejects duplicate usernames with 409 (case-insensitive)', async () => {
    await registerAgent(world.app, 'alice')
    const res = await request(world.app).post('/api/auth/register').send({ username: 'ALICE', password: 'password1' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('conflict')
  })

  it('returns invalid_credentials for wrong password and unknown user alike', async () => {
    await registerAgent(world.app, 'bob')
    const wrong = await request(world.app).post('/api/auth/login').send({ username: 'bob', password: 'nope-nope' })
    const ghost = await request(world.app).post('/api/auth/login').send({ username: 'ghost', password: 'nope-nope' })
    expect(wrong.status).toBe(401)
    expect(ghost.status).toBe(401)
    expect(wrong.body).toEqual(ghost.body)
  })

  it('requires auth on protected endpoints', async () => {
    await request(world.app).post('/api/workouts').send({ title: 'x' }).expect(401)
    await request(world.app).get('/api/feed').expect(401)
  })

  it('returns JSON 404 (not HTML) for unknown /api paths', async () => {
    const agent = await registerAgent(world.app, 'carol')
    const res = await agent.get('/api/definitely-not-a-thing')
    expect(res.status).toBe(404)
    expect(res.body.error.code).toBe('not_found')
    expect(res.headers['content-type']).toMatch(/json/)
  })
})
