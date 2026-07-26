import assert from 'node:assert/strict'
import test from 'node:test'
import {
  bookmarkListCacheKey,
  extractBookmarkTagsFromHtml,
  getArtworkRecommendedBookmarkTags,
  mergeBookmarkTags,
  normalizeArtworkBookmarkSettings,
  normalizeBookmarkTagGroups,
  prioritizeBookmarkTags,
  splitBookmarkTagInput,
} from '../app/utils/bookmarkTags.ts'

test('收藏标签接口兼容 Web API 的公开与私密列表结构', () => {
  assert.deepEqual(
    normalizeBookmarkTagGroups({
      public: [
        { tag: '风景', cnt: 4 },
        { name: '人物', count: 2 },
      ],
      private: {
        私密参考: 3,
      },
    }),
    {
      public: [
        { name: '风景', count: 4 },
        { name: '人物', count: 2 },
      ],
      private: [{ name: '私密参考', count: 3 }],
    }
  )
})

test('作品收藏设置兼容标签对象、字符串和 restrict 字段', () => {
  assert.deepEqual(
    normalizeArtworkBookmarkSettings({
      bookmarkTags: ['角色', { tag: '服装' }, { name: '参考' }],
      restrict: 1,
    }),
    {
      tags: ['角色', '服装', '参考'],
      private: true,
    }
  )

  assert.deepEqual(normalizeArtworkBookmarkSettings({}, true), {
    tags: [],
    private: true,
  })
})

test('自定义收藏标签输入会拆分、去空白并去重', () => {
  assert.deepEqual(splitBookmarkTagInput('角色，服装  参考\n角色, 光影'), [
    '角色',
    '服装',
    '参考',
    '光影',
  ])
})

test('收藏分页缓存按标签和页码隔离', () => {
  assert.equal(bookmarkListCacheKey('风景', 2), '风景::2')
  assert.equal(bookmarkListCacheKey('', 1), '::1')
})

test('从 Pixiv 收藏编辑页读取当前作品的标签', () => {
  assert.deepEqual(
    extractBookmarkTagsFromHtml(
      '<form><input type="hidden" name="tag" value="角色 服装&amp;设计 光影"></form>'
    ),
    ['角色', '服装&设计', '光影']
  )
})

test('收藏编辑器优先展示已有标签并将作品推荐标签单独去重', () => {
  const userTags = [
    { name: '常用', count: 8 },
    { name: '已设置', count: 1 },
    { name: '次常用', count: 3 },
  ]
  assert.deepEqual(prioritizeBookmarkTags(userTags, ['已设置']), [
    { name: '已设置', count: 1 },
    { name: '常用', count: 8 },
    { name: '次常用', count: 3 },
  ])
  assert.deepEqual(
    getArtworkRecommendedBookmarkTags(
      ['已设置', '作品推荐', '作品推荐', '另一个推荐'],
      userTags
    ),
    [
      { name: '作品推荐', count: 0 },
      { name: '另一个推荐', count: 0 },
    ]
  )
})

test('批量添加收藏标签会去重并遵守单作品标签上限', () => {
  assert.deepEqual(mergeBookmarkTags(['已有', '重复'], ['重复', '新增'], 3), [
    '已有',
    '重复',
    '新增',
  ])
})
