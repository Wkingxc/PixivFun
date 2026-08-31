import assert from 'node:assert/strict'
import test from 'node:test'
import {
  groupFollowingUpdatesByDate,
  partitionFollowingUpdates,
} from '../app/utils/followingLatest.ts'

test('关注更新按精选作者互斥分组并保持原作品顺序', () => {
  const works = [
    { id: '1', userId: '10' },
    { id: '2', userId: '20' },
    { id: '3', userId: '30' },
    { id: '4', userId: '20' },
  ]

  const groups = partitionFollowingUpdates(works, new Set(['20']))

  assert.deepEqual(
    groups.featured.map((work) => work.id),
    ['2', '4']
  )
  assert.deepEqual(
    groups.regular.map((work) => work.id),
    ['1', '3']
  )
  assert.deepEqual(
    new Set([...groups.featured, ...groups.regular].map((work) => work.id)),
    new Set(works.map((work) => work.id))
  )
})

test('关注更新按发布日期分组且日期标题不包含年份', () => {
  const groups = groupFollowingUpdatesByDate(
    [
      { id: '1', createDate: '2026-08-31T23:50:00+09:00' },
      { id: '2', createDate: '2026-08-31T08:10:00+09:00' },
      { id: '3', createDate: '2026-08-30T19:20:00+09:00' },
    ],
    new Date(2026, 7, 31, 12)
  )

  assert.deepEqual(
    groups.map((group) => ({
      dateKey: group.dateKey,
      dateLabel: group.dateLabel,
      weekdayLabel: group.weekdayLabel,
      isToday: group.isToday,
      ids: group.works.map((work) => work.id),
    })),
    [
      {
        dateKey: '2026-08-31',
        dateLabel: '8月31日',
        weekdayLabel: '周一',
        isToday: true,
        ids: ['1', '2'],
      },
      {
        dateKey: '2026-08-30',
        dateLabel: '8月30日',
        weekdayLabel: '周日',
        isToday: false,
        ids: ['3'],
      },
    ]
  )
  assert.equal(
    groups.some((group) => group.dateLabel.includes('2026')),
    false
  )
})

test('日期异常的关注更新会保留在日期未知分组', () => {
  const groups = groupFollowingUpdatesByDate([
    { id: '1', createDate: '' },
    { id: '2', createDate: 'invalid' },
  ])

  assert.equal(groups.length, 1)
  assert.equal(groups[0]?.dateLabel, '日期未知')
  assert.deepEqual(
    groups[0]?.works.map((work) => work.id),
    ['1', '2']
  )
})
