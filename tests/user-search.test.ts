import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizeUserSearchResult } from '../app/utils/userSearch.ts'

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
