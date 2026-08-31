import test from 'node:test'
import assert from 'node:assert/strict'
import type { ArtworkInfo } from '../app/types/Artworks.ts'
import {
  groupBookmarkWorksByAuthor,
  paginateBookmarkAuthorGroups,
} from '../app/utils/bookmarkAuthorGroups.ts'

function work(id: string, userId: string, userName: string): ArtworkInfo {
  return {
    id: id as `${number}`,
    title: id,
    description: '',
    createDate: '2026-08-01T00:00:00+00:00',
    updateDate: '2026-08-01T00:00:00+00:00',
    illustType: 0,
    restrict: 0,
    xRestrict: 0,
    sl: 0,
    userId: userId as `${number}`,
    userName,
    alt: '',
    width: 1,
    height: 1,
    pageCount: 1,
    isBookmarkable: true,
    bookmarkData: null,
    titleCaptionTranslation: { workTitle: null, workCaption: null },
    isUnlisted: false,
    aiType: 0,
    url: '',
    tags: [],
    profileImageUrl: `${userId}.jpg`,
    type: 'illust',
  }
}

test('groups bookmark works by author and sorts larger groups first', () => {
  const works = [
    work('5', '10', '较新作者'),
    work('4', '20', '高产作者'),
    work('3', '20', '高产作者'),
    work('2', '30', '其他作者'),
    work('1', '20', '高产作者'),
  ]

  const groups = groupBookmarkWorksByAuthor(works, 'count')

  assert.deepEqual(
    groups.map((group) => [group.authorId, group.works.length]),
    [
      ['20', 3],
      ['10', 1],
      ['30', 1],
    ]
  )
  assert.equal(groups[0]?.profileImageUrl, '20.jpg')
})

test('sorts authors by the newest bookmark position, not artwork date', () => {
  const groups = groupBookmarkWorksByAuthor(
    [
      work('100', '30', '最新作者'),
      work('999', '20', '第二作者'),
      work('998', '30', '最新作者'),
      work('997', '10', '第三作者'),
    ],
    'recent'
  )

  assert.deepEqual(
    groups.map((group) => group.authorId),
    ['30', '20', '10']
  )
  assert.deepEqual(
    groups.map((group) => group.latestBookmarkIndex),
    [0, 1, 3]
  )
})

test('paginates complete author groups without splitting their works', () => {
  const groups = ['a', 'b', 'c', 'd', 'e']
  assert.deepEqual(paginateBookmarkAuthorGroups(groups, 2, 2), ['c', 'd'])
  assert.deepEqual(paginateBookmarkAuthorGroups(groups, 0, 2), ['a', 'b'])
})
