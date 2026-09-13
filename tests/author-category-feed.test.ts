import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  createAuthorCategoryFeed,
  AUTHOR_CATEGORY_PAGE_SIZE,
} from '../app/utils/authorCategoryFeed.ts'

function fixture() {
  const works = Array.from({ length: 75 }, (_, index) => ({
    id: String(1000 - index),
    userId: index % 2 ? '20' : '10',
    createDate: new Date(
      Date.UTC(2026, 5, 30) - index * 86400000
    ).toISOString(),
    category: index % 3 ? 'illust' : 'manga',
  }))
  const requests: Array<{ authorId: string; ids: string[]; category: string }> =
    []
  const profiles: string[] = []
  let fail = false
  const client = {
    async getUserProfileAll(authorId: string) {
      profiles.push(authorId)
      if (fail) throw new Error('offline')
      const own = works.filter((work) => work.userId === authorId)
      return {
        illusts: Object.fromEntries(
          own
            .filter((work) => work.category === 'illust')
            .map((work) => [work.id, null])
        ),
        manga: Object.fromEntries(
          own
            .filter((work) => work.category === 'manga')
            .map((work) => [work.id, null])
        ),
      }
    },
    async getUserIllusts(authorId: string, ids: string[], category: string) {
      requests.push({ authorId, ids, category })
      if (fail) throw new Error('offline')
      return Object.fromEntries(
        works
          .filter(
            (work) =>
              ids.includes(work.id) &&
              work.userId === authorId &&
              work.category === category
          )
          .map((work) => [work.id, work])
      )
    },
  }
  return {
    works,
    requests,
    profiles,
    client,
    setFail: (value: boolean) => {
      fail = value
    },
  }
}

test('低频作者六月作品直接出现在分类首页，包含漫画和动图所用的插画目录', async () => {
  const f = fixture()
  const feed = createAuthorCategoryFeed(f.client)
  const result = await feed.load(['10', '10'])
  assert.equal(result.works[0]?.createDate, '2026-06-30T00:00:00.000Z')
  assert.equal(result.works.length, 38)
  assert.equal(result.total, 38)
  assert.ok(result.works.every((work) => work.userId === '10'))
  assert.ok(result.works.some((work) => work.category === 'manga'))
  assert.deepEqual(f.profiles, ['10'])
})

test('多作者先合并完整目录再独立分页，第二页不重不漏，切换分类不会复用错误的结果', async () => {
  const f = fixture()
  const feed = createAuthorCategoryFeed(f.client)
  const first = await feed.load(['10', '20'])
  assert.equal(first.works.length, AUTHOR_CATEGORY_PAGE_SIZE)
  assert.equal(first.total, 75)
  assert.equal(f.requests.flatMap((request) => request.ids).length, 60)
  assert.ok(f.requests.every((request) => request.ids.length <= 48))
  const second = await feed.load(['20', '10'], 2)
  assert.deepEqual(
    [...first.works, ...second.works].map((work) => work.id),
    f.works.map((work) => work.id)
  )
  const category = await feed.load(['20'], 2)
  assert.equal(category.page, 1)
  assert.equal(category.total, 37)
  assert.ok(category.works.every((work) => work.userId === '20'))
  const requests = f.requests.length
  await feed.load(['10', '20'], 1)
  assert.equal(f.requests.length, requests)
})

test('空分类不请求接口，删除或不可访问的作品会被跳过并补齐分页', async () => {
  const f = fixture()
  const feed = createAuthorCategoryFeed({
    ...f.client,
    async getUserIllusts(authorId: string, ids: string[], category: string) {
      const works = await f.client.getUserIllusts(authorId, ids, category)
      delete works['1000']
      return works
    },
  })
  assert.deepEqual(await feed.load([], 99), {
    works: [],
    total: 0,
    page: 1,
    failedAuthorIds: [],
  })
  assert.equal(f.profiles.length, 0)
  const result = await feed.load(['10', '20'])
  assert.equal(result.total, 74)
  assert.equal(result.works.length, 60)
  assert.equal(result.works[0]?.id, '999')
})

test('分类请求失败不缓存为空结果，恢复网络后可以重试', async () => {
  const f = fixture()
  const feed = createAuthorCategoryFeed(f.client)
  f.setFail(true)
  await assert.rejects(feed.load(['10']), /offline/)
  f.setFail(false)
  assert.equal((await feed.load(['10'])).works.length, 38)
  f.setFail(true)
  await assert.rejects(feed.load(['20']), /offline/)
  f.setFail(false)
  assert.equal((await feed.load(['20'])).works.length, 37)
})

test('单个作者目录读取失败时保留其他作者作品并明确提示，重试会补回', async () => {
  const f = fixture()
  let unavailable = true
  const feed = createAuthorCategoryFeed({
    ...f.client,
    async getUserProfileAll(authorId: string) {
      if (authorId === '10' && unavailable)
        throw new Error('author unavailable')
      return f.client.getUserProfileAll(authorId)
    },
  })
  const partial = await feed.load(['10', '20'])
  assert.equal(partial.total, 37)
  assert.deepEqual(partial.failedAuthorIds, ['10'])
  assert.ok(partial.works.every((work) => work.userId === '20'))
  unavailable = false
  const recovered = await feed.load(['10', '20'])
  assert.equal(recovered.total, 75)
  assert.equal(recovered.works.length, 60)
  assert.deepEqual(recovered.failedAuthorIds, [])
})

test('汇总作者时最多四个并发请求，切换分类后停止继续请求旧分类', async () => {
  let active = 0
  let maximum = 0
  let started = 0
  const releases: Array<() => void> = []
  const feed = createAuthorCategoryFeed({
    async getUserProfileAll() {
      started++
      maximum = Math.max(maximum, ++active)
      await new Promise<void>((resolve) => releases.push(resolve))
      active--
      return { illusts: {}, manga: {} }
    },
    async getUserIllusts() {
      return {}
    },
  })
  const controller = new AbortController()
  const pending = feed.load(
    Array.from({ length: 12 }, (_, i) => String(i + 1)),
    1,
    controller.signal
  )
  assert.equal(maximum, 4)
  controller.abort()
  releases.forEach((release) => release())
  await assert.rejects(pending, { name: 'AbortError' })
  assert.equal(started, 4)
})

test('目录在五分钟内复用，过期重新获取后新增作品进入首页', async () => {
  const f = fixture()
  let time = 1000
  const feed = createAuthorCategoryFeed(f.client, () => time)
  await feed.load(['10'])
  f.works.unshift({
    id: '2000',
    userId: '10',
    category: 'illust',
    createDate: '2026-09-13T00:00:00.000Z',
  })
  assert.equal((await feed.load(['10'])).total, 38)
  assert.equal(f.profiles.length, 1)
  time += 5 * 60_000
  const refreshed = await feed.load(['10'])
  assert.equal(refreshed.total, 39)
  assert.equal(refreshed.works[0]?.id, '2000')
  assert.equal(f.profiles.length, 2)
})

test('快速切换到有相同作者的分类时合并正在读取的目录请求', async () => {
  let calls = 0
  let release!: () => void
  const feed = createAuthorCategoryFeed({
    async getUserProfileAll() {
      calls++
      await new Promise<void>((resolve) => {
        release = resolve
      })
      return { illusts: {}, manga: {} }
    },
    async getUserIllusts() {
      return {}
    },
  })
  const controller = new AbortController()
  const old = feed.load(['10'], 1, controller.signal)
  controller.abort()
  const current = feed.load(['10'])
  release()
  await assert.rejects(old, { name: 'AbortError' })
  assert.equal((await current).total, 0)
  assert.equal(calls, 1)
})
