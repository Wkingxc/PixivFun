import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useFollowingStore } from '../app/stores/following.ts'

test('快速翻页和返回缓存页时，旧请求不能覆盖新页面', async (t) => {
  const runtime = globalThis as unknown as Record<string, unknown>
  const previousClient = runtime.usePixivClient
  t.after(() => {
    runtime.usePixivClient = previousClient
  })
  const responses = new Map<number, (data: unknown) => void>()
  runtime.usePixivClient = () => ({
    getFollowLatest: ({ p }: { p: number }) =>
      new Promise((resolve) => responses.set(p, resolve)),
  })
  setActivePinia(createPinia())
  const store = useFollowingStore()
  const response = (page: number) => ({
    thumbnails: { illust: [{ id: String(page), userId: '10' }] },
    page: { isLastPage: false },
  })
  const first = store.fetchLatest(1)
  const second = store.fetchLatest(2)
  responses.get(2)!(response(2))
  await second
  responses.get(1)!(response(1))
  await first
  assert.equal(store.latestPage, 2)
  assert.equal(store.latestIllusts[0]?.id, '2')
  const third = store.fetchLatest(3)
  await store.fetchLatest(2)
  assert.equal(store.latestLoading, false)
  responses.get(3)!(response(3))
  await third
  assert.equal(store.latestPage, 2)
  assert.equal(store.latestIllusts[0]?.id, '2')
})
