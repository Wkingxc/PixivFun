import assert from 'node:assert/strict'
import { test } from 'node:test'
import { RequestCache, cacheKey } from '../app/api/request-cache.ts'

test('相同 key 的并发请求只调用一次 fetcher', async () => {
  const cache = new RequestCache()
  let calls = 0
  const fetcher = async () => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 10))
    return 'result'
  }

  const [a, b] = await Promise.all([
    cache.fetch('k', fetcher, { ttl: 1000 }),
    cache.fetch('k', fetcher, { ttl: 1000 }),
  ])
  assert.equal(a, 'result')
  assert.equal(b, 'result')
  assert.equal(calls, 1)
})

test('TTL 内直接返回缓存,不再调用 fetcher', async () => {
  let now = 0
  const cache = new RequestCache(() => now)
  let calls = 0
  const fetcher = async () => ++calls

  assert.equal(await cache.fetch('k', fetcher, { ttl: 1000 }), 1)
  now = 500
  assert.equal(await cache.fetch('k', fetcher, { ttl: 1000 }), 1)
  assert.equal(calls, 1)
})

test('过期但在 stale 窗口内返回旧值并后台刷新', async () => {
  let now = 0
  const cache = new RequestCache(() => now)
  let calls = 0
  const fetcher = async () => ++calls

  assert.equal(await cache.fetch('k', fetcher, { ttl: 1000 }), 1)
  now = 2000 // past ttl (1000), inside stale window (1000 + 4000)
  assert.equal(await cache.fetch('k', fetcher, { ttl: 1000 }), 1)
  await new Promise((resolve) => setImmediate(resolve))
  // Background refresh has stored the fresh value for the next read.
  assert.equal(await cache.fetch('k', fetcher, { ttl: 1000 }), 2)
  assert.equal(calls, 2)
})

test('完全过期后重新请求', async () => {
  let now = 0
  const cache = new RequestCache(() => now)
  let calls = 0
  const fetcher = async () => ++calls

  assert.equal(await cache.fetch('k', fetcher, { ttl: 1000 }), 1)
  now = 10_000 // past ttl + stale window
  assert.equal(await cache.fetch('k', fetcher, { ttl: 1000 }), 2)
})

test('invalidate 按前缀删除缓存', async () => {
  const cache = new RequestCache()
  let calls = 0
  const fetcher = async () => ++calls

  await cache.fetch('artwork:1', fetcher, { ttl: 60_000 })
  await cache.fetch('artwork:2', fetcher, { ttl: 60_000 })
  await cache.fetch('user:1', fetcher, { ttl: 60_000 })
  cache.invalidate('artwork:')

  assert.equal(await cache.fetch('artwork:1', fetcher, { ttl: 60_000 }), 4)
  assert.equal(await cache.fetch('user:1', fetcher, { ttl: 60_000 }), 3)
})

test('fetcher 失败不缓存错误,下次重新请求', async () => {
  const cache = new RequestCache()
  let calls = 0
  const fetcher = async () => {
    calls++
    if (calls === 1) throw new Error('boom')
    return 'ok'
  }

  await assert.rejects(() => cache.fetch('k', fetcher, { ttl: 1000 }))
  assert.equal(await cache.fetch('k', fetcher, { ttl: 1000 }), 'ok')
})

test('带 signal 的请求不参与在途共享', async () => {
  const cache = new RequestCache()
  let calls = 0
  const fetcher = async () => {
    const id = ++calls
    await new Promise((resolve) => setTimeout(resolve, 10))
    return id
  }
  const controller = new AbortController()

  const [a, b] = await Promise.all([
    cache.fetch('k', fetcher, { ttl: 0, signal: controller.signal }),
    cache.fetch('k', fetcher, { ttl: 0, signal: controller.signal }),
  ])
  assert.equal(calls, 2)
  assert.notEqual(a, b)
})

test('ttl=0 不缓存但仍去重在途请求', async () => {
  const cache = new RequestCache()
  let calls = 0
  const fetcher = async () => {
    calls++
    await new Promise((resolve) => setTimeout(resolve, 10))
    return calls
  }

  const [a, b] = await Promise.all([
    cache.fetch('k', fetcher),
    cache.fetch('k', fetcher),
  ])
  assert.equal(a, 1)
  assert.equal(b, 1)
  assert.equal(calls, 1)
  // After completion nothing is cached.
  assert.equal(await cache.fetch('k', fetcher), 2)
})

test('cacheKey 稳定拼接参数', () => {
  assert.equal(cacheKey('search', 'k', 1, 'all', undefined), 'search:k|1|all|')
  assert.equal(cacheKey('user', 123), 'user:123')
})
