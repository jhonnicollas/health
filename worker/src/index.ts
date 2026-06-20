import { Hono } from 'hono'

export interface Env {
  DB: D1Database
  LOGS: R2Bucket
}

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
  return c.json({
    success: true,
    message: 'HL Health Companion API is running'
  })
})

export default app
