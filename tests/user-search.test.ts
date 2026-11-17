import assert from 'node:assert/strict'
import { test } from 'node:test'
import * as userSearch from '../app/utils/userSearch.ts'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
import { RequestCache, cacheKey, CACHE_TTL } from '../app/api/request-cache.ts'

const {
  normalizeUserSearchResult,
  getUserSearchPage,
  normalizeUserSearchMode,
} = userSearch

test('归一化 touch 风格(snake_case)的用户搜索结果', () => {
  const result = normalizeUserSearchResult({
    users: [
      {
        user_id: 123,
        user_name: 'ふりおり',
        profile_img: { main: 'https://i.pximg.net/avatar.jpg' },
        user_comment: 'hello',
        followed: true,
        illusts: [
          {
            id: '111',
            title: '作品一',
            url: 'https://i.pximg.net/1.jpg',
            x_restrict: 1,
          },
          null,
        ],
      },
    ],
    total: 42,
  })
  assert.deepEqual(result, {
    users: [
      {
        userId: '123',
        userName: 'ふりおり',
        profileImageUrl: 'https://i.pximg.net/avatar.jpg',
        comment: 'hello',
        isFollowed: true,
        works: [
          {
            id: '111',
            title: '作品一',
            url: 'https://i.pximg.net/1.jpg',
            xRestrict: 1,
          },
        ],
      },
    ],
    total: 42,
  })
})

test('归一化 camelCase 风格并在缺 total 时回退为条数', () => {
  const result = normalizeUserSearchResult({
    users: [
      {
        userId: '9',
        userName: 'A',
        profileImageUrl: 'https://i.pximg.net/a.jpg',
        illusts: [
          { id: 5, url: 'https://i.pximg.net/5.jpg', title: 't' },
          { id: 6, url: 'https://i.pximg.net/6.jpg', title: 't' },
          { id: 7, url: 'https://i.pximg.net/7.jpg', title: 't' },
          { id: 8, url: 'https://i.pximg.net/8.jpg', title: 't' },
        ],
      },
      { noId: true },
    ],
  })
  assert.equal(result.users.length, 1)
  assert.equal(result.users[0]!.works.length, 3)
  assert.equal(result.total, 1)
})

test('未知形状安全降级为空结果', () => {
  assert.deepEqual(normalizeUserSearchResult(null), { users: [], total: 0 })
  assert.deepEqual(normalizeUserSearchResult({}), { users: [], total: 0 })
  assert.deepEqual(normalizeUserSearchResult({ users: 'x' }), {
    users: [],
    total: 0,
  })
})

test('桌面搜索读取 page.total，保留完整分页总数和大头像', () => {
  const result = normalizeUserSearchResult({
    page: { total: 586, userIds: [27019365] },
    users: [
      {
        userId: '27019365',
        name: 'RD',
        image: '/small.jpg',
        imageBig: '/big.jpg',
      },
    ],
  })
  assert.equal(result.total, 586)
  assert.equal(result.users[0].userId, '27019365')
  assert.equal(result.users[0].userName, 'RD')
  assert.equal(result.users[0].profileImageUrl, '/big.jpg')
})

test('关系型搜索兼容嵌套分页、旧结构和字符串总数', () => {
  assert.deepEqual(
    getUserSearchPage({
      page: { userIds: [27019365, null, {}], total: '586' },
    }),
    { userIds: ['27019365'], total: 586 }
  )
  assert.deepEqual(getUserSearchPage({ userIds: ['42'], total: 20 }), {
    userIds: ['42'],
    total: 20,
  })
  assert.deepEqual(getUserSearchPage({ page: { total: -1 } }), {
    userIds: [],
    total: undefined,
  })
  assert.equal(normalizeUserSearchMode('s_usr_full'), 's_usr_full')
  assert.equal(normalizeUserSearchMode('s_tag'), 's_usr')
})

function createSearchApi(
  get: (url: string, options?: any) => Promise<unknown>
) {
  const source = readFileSync(
    new URL('../app/api/search.ts', import.meta.url),
    'utf8'
  )
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const exports: any = {}
  class Base {
    http = { get }
    unwrap(data: any) {
      return data.body
    }
  }
  new Function('require', 'exports', outputText)((name: string) => {
    if (name === './base') return { PixivApiBase: Base }
    if (name === './request-cache')
      return { requestCache: new RequestCache(), cacheKey, CACHE_TTL }
    if (name === '~/utils/userSearch') return userSearch
    if (name === '~/utils/searchSuggestions' || name === '~/utils/tagInfo')
      return {}
    throw new Error(`Unexpected import: ${name}`)
  }, exports)
  return new exports.SearchApi()
}

test('搜索 API 发送完全匹配参数，按匹配模式和页码隔离缓存', async () => {
  const requests: any[] = []
  const api = createSearchApi(async (_url, options) => {
    requests.push(options.params)
    return {
      data: {
        body: {
          page: { total: 586 },
          users: [{ userId: '27019365', name: 'RD' }],
        },
      },
    }
  })
  await api.searchUsers('RD', { p: 1 })
  const exact = await api.searchUsers('RD', { p: 1, s_mode: 's_usr_full' })
  await api.searchUsers('RD', { p: 2, s_mode: 's_usr_full' })
  await api.searchUsers('RD', { p: 1, s_mode: 's_usr_full' })
  assert.equal(exact.total, 586)
  assert.equal(exact.users[0].userId, '27019365')
  assert.deepEqual(
    requests.map((params) => [params.nick, params.s_mode, params.p]),
    [
      ['RD', 's_usr', 1],
      ['RD', 's_usr_full', 1],
      ['RD', 's_usr_full', 2],
    ]
  )
})

test('缺少内嵌用户时从 page.userIds 加载资料，单个失败不破坏分页', async () => {
  const requests: string[] = []
  const api = createSearchApi(async (url) => {
    requests.push(url)
    if (url === '/ajax/search/users')
      return {
        data: { body: { page: { userIds: [27019365, 42], total: 586 } } },
      }
    if (url.includes('/42?')) throw new Error('Unavailable user')
    return { data: { body: { userId: '27019365', name: 'RD' } } }
  })
  const result = await api.searchUsers('RD')
  assert.equal(result.total, 586)
  assert.equal(result.users.length, 1)
  assert.equal(result.users[0].userId, '27019365')
  assert.equal(requests.length, 3)
})

test('用户搜索匹配筛选和固定分页模板可编译', () => {
  const filename = 'app/pages/search.vue'
  const { descriptor } = parse(
    readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8')
  )
  const script = compileScript(descriptor, { id: 'user-search-test' })
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename,
    id: 'user-search-test',
    preprocessLang: 'pug',
    preprocessOptions: { doctype: 'html' },
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
})
