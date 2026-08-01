import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createProxyDispatcherPool,
  fetchWithTransientRetry,
  formatUpstreamError,
} from '../server/utils/upstream-fetch.ts'

test('相同代理复用连接池并在代理变化时平滑关闭旧实例', async () => {
  const created: string[] = []
  const closed: string[] = []
  const pool = createProxyDispatcherPool(async (url) => {
    created.push(url)
    return {
      url,
      async close() {
        closed.push(url)
      },
    }
  })

  const first = await pool.get('http://127.0.0.1:7890')
  const reused = await pool.get('http://127.0.0.1:7890')
  const replacement = await pool.get('http://127.0.0.1:7891')

  assert.equal(first, reused)
  assert.notEqual(first, replacement)
  assert.deepEqual(created, ['http://127.0.0.1:7890', 'http://127.0.0.1:7891'])
  assert.deepEqual(closed, ['http://127.0.0.1:7890'])
})

test('代理实例创建失败不会污染后续相同配置的重试', async () => {
  let attempts = 0
  const pool = createProxyDispatcherPool(async (url) => {
    attempts += 1
    if (attempts === 1) throw new Error('agent initialization failed')
    return { url, close() {} }
  })

  await assert.rejects(pool.get('http://127.0.0.1:7891'))
  const dispatcher = await pool.get('http://127.0.0.1:7891')

  assert.equal(dispatcher.url, 'http://127.0.0.1:7891')
  assert.equal(attempts, 2)
})

test('GET 瞬时失败只重试一次且每次使用独立超时信号', async () => {
  const signals: AbortSignal[] = []
  const response = await fetchWithTransientRetry(
    'GET',
    async (signal) => {
      signals.push(signal)
      if (signals.length === 1) throw new TypeError('fetch failed')
      return new Response('ok', { status: 200 })
    },
    { retries: 1, timeoutMs: 1_000 }
  )

  assert.equal(response.status, 200)
  assert.equal(signals.length, 2)
  assert.notEqual(signals[0], signals[1])
})

test('写操作、明确 HTTP 响应和调用方取消均不重试', async () => {
  let postAttempts = 0
  await assert.rejects(
    fetchWithTransientRetry(
      'POST',
      async () => {
        postAttempts += 1
        throw new TypeError('fetch failed')
      },
      { retries: 1, timeoutMs: 1_000 }
    )
  )
  assert.equal(postAttempts, 1)

  let responseAttempts = 0
  const response = await fetchWithTransientRetry(
    'GET',
    async () => {
      responseAttempts += 1
      return new Response('busy', { status: 503 })
    },
    { retries: 1, timeoutMs: 1_000 }
  )
  assert.equal(response.status, 503)
  assert.equal(responseAttempts, 1)

  const controller = new AbortController()
  controller.abort(new DOMException('route changed', 'AbortError'))
  let cancelledAttempts = 0
  await assert.rejects(
    fetchWithTransientRetry(
      'GET',
      async () => {
        cancelledAttempts += 1
        return new Response('unexpected')
      },
      { retries: 1, timeoutMs: 1_000, signal: controller.signal }
    ),
    { name: 'AbortError' }
  )
  assert.equal(cancelledAttempts, 0)
})

test('非网络程序错误不会被当作瞬时故障重试', async () => {
  let attempts = 0
  await assert.rejects(
    fetchWithTransientRetry(
      'GET',
      async () => {
        attempts += 1
        throw new Error('invalid proxy configuration')
      },
      { retries: 1, timeoutMs: 1_000 }
    ),
    /invalid proxy configuration/
  )
  assert.equal(attempts, 1)
})

test('网关错误保留底层 cause code 且不读取请求凭据', () => {
  const error = new TypeError('fetch failed', {
    cause: Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
  })
  const formatted = formatUpstreamError(error)

  assert.match(formatted, /TypeError: fetch failed/)
  assert.match(formatted, /ECONNRESET/)
  assert.match(formatted, /socket hang up/)
})
