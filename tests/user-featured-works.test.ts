import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeUserFeaturedWorks,
  USER_FEATURED_WORK_LIMIT,
} from '../app/utils/userFeaturedWorks.ts'

const author = {
  userId: '7324626' as const,
  userName: '美和野らぐ',
  profileImageUrl: '/avatar.png',
}

function pickup(id: string, type = 'illust') {
  return {
    id,
    type,
    title: `work-${id}`,
    url: `/work-${id}.jpg`,
    userId: author.userId,
    userName: author.userName,
    pageCount: 1,
    xRestrict: 0,
  }
}

test('作者精选只读取 profile/all pickup 的前三项并保持作者顺序', () => {
  const works = normalizeUserFeaturedWorks(
    [pickup('30'), pickup('10'), pickup('20'), pickup('40')],
    author
  )

  assert.equal(USER_FEATURED_WORK_LIMIT, 3)
  assert.deepEqual(
    works.map((work) => work.id),
    ['30', '10', '20']
  )
  assert.ok(works.every((work) => work.profileImageUrl === '/avatar.png'))
})

test('不拿普通作品补齐不支持的精选类型', () => {
  const works = normalizeUserFeaturedWorks(
    [pickup('30'), pickup('99', 'illustSeries'), pickup('20'), pickup('40')],
    author
  )

  assert.deepEqual(
    works.map((work) => work.id),
    ['30', '20']
  )
})

test('小说精选会保留为小说卡数据', () => {
  const [work] = normalizeUserFeaturedWorks(
    [
      {
        ...pickup('55', 'novel'),
        textCount: 1200,
        readingTime: 360,
      },
    ],
    author
  )

  assert.equal(work?.type, 'novel')
  if (work?.type === 'novel') {
    assert.equal(work.textCount, 1200)
    assert.equal(work.readingTime, 360)
  }
})
