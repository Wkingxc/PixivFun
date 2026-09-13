import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthorCategoriesStore } from '../app/stores/author-categories.ts'

test('分类 store 合并并发读取、按顺序保存，失败后保留原状态且可重试', async (t) => {
  const runtime = globalThis as unknown as Record<string, unknown>
  const previousFetch = runtime.$fetch
  t.after(() => {
    runtime.$fetch = previousFetch
  })
  setActivePinia(createPinia())
  let reads = 0
  let releaseRead!: (value: unknown) => void
  const read = new Promise((resolve) => {
    releaseRead = resolve
  })
  let writes = 0
  let fail = false
  let releaseWrite!: (value: unknown) => void
  const write = new Promise((resolve) => {
    releaseWrite = resolve
  })
  runtime.$fetch = async (_url: string, options?: { method?: string }) => {
    if (!options?.method) {
      reads++
      return read
    }
    writes++
    if (fail) throw new Error('offline')
    if (writes === 1) return write
    return { categories: [{ id: 'a', name: '新名称', authorIds: ['10'] }] }
  }
  const store = useAuthorCategoriesStore()
  const firstRead = store.init()
  const secondRead = store.init()
  assert.equal(reads, 1)
  releaseRead({ categories: [{ id: 'a', name: '漫画', authorIds: [] }] })
  await Promise.all([firstRead, secondRead])
  const assign = store.assign('10', ['a'])
  const rename = store.rename('a', '新名称')
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(writes, 1)
  assert.equal(store.busy, true)
  releaseWrite({ categories: [{ id: 'a', name: '漫画', authorIds: ['10'] }] })
  await Promise.all([assign, rename])
  assert.equal(writes, 2)
  assert.equal(store.forAuthor('10')[0]?.name, '新名称')
  fail = true
  await assert.rejects(store.remove('a'), /offline/)
  assert.equal(store.forAuthor('10').length, 1)
  assert.equal(store.busy, false)
  fail = false
  await store.rename('a', '新名称')
  assert.equal(store.categories.length, 1)
})

test('分类加载失败后允许重试', async (t) => {
  const runtime = globalThis as unknown as Record<string, unknown>
  const previousFetch = runtime.$fetch
  t.after(() => {
    runtime.$fetch = previousFetch
  })
  setActivePinia(createPinia())
  const store = useAuthorCategoriesStore()
  runtime.$fetch = async () => {
    throw new Error('offline')
  }
  await assert.rejects(store.init(), /offline/)
  assert.equal(store.initialized, false)
  runtime.$fetch = async () => ({ categories: [] })
  await store.init()
  assert.equal(store.initialized, true)
})
