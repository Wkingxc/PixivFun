import assert from 'node:assert/strict'
import test from 'node:test'
import { partitionFollowingUpdates } from '../app/utils/followingLatest.ts'

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
