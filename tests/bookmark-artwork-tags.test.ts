import assert from 'node:assert/strict'
import test from 'node:test'
import {
  collectArtworkTagStats,
  filterWorksByArtworkTags,
  paginateWorks,
  pinSelectedArtworkTags,
  searchArtworkTagStats,
} from '../app/utils/bookmarkArtworkTags.ts'
import type { ArtworkInfo } from '../app/types/index.ts'

function work(id: string, tags: unknown): ArtworkInfo {
  return { id, tags } as unknown as ArtworkInfo
}

test('作品标签统计按出现次数排序，并在单个作品内去重', () => {
  assert.deepEqual(
    collectArtworkTagStats([
      work('1', ['原神', '原神', '风景']),
      work('2', ['原神', ' 风景 ']),
      work('3', ['东方']),
    ]),
    // Same count falls back to locale order (feng < yuan in pinyin).
    [
      { name: '风景', count: 2 },
      { name: '原神', count: 2 },
      { name: '东方', count: 1 },
    ]
  )
})

test('作品标签统计忽略空标签和异常数据', () => {
  assert.deepEqual(
    collectArtworkTagStats([
      work('1', ['  ', '', '插画']),
      work('2', undefined),
      work('3', 'not-an-array'),
    ]),
    [{ name: '插画', count: 1 }]
  )
})

test('多选作品标签按“同时包含”筛选收藏', () => {
  const works = [
    work('1', ['原神', '风景']),
    work('2', ['原神']),
    work('3', ['风景']),
  ]
  assert.deepEqual(
    filterWorksByArtworkTags(works, ['原神', '风景']).map((item) => item.id),
    ['1']
  )
  assert.deepEqual(
    filterWorksByArtworkTags(works, ['原神']).map((item) => item.id),
    ['1', '2']
  )
})

test('未选择作品标签时不改变收藏列表', () => {
  const works = [work('1', ['原神'])]
  assert.equal(filterWorksByArtworkTags(works, []), works)
  assert.equal(filterWorksByArtworkTags(works, ['  ']), works)
})

test('作品标签搜索忽略大小写', () => {
  const stats = [
    { name: 'Genshin', count: 3 },
    { name: '原神', count: 2 },
  ]
  assert.deepEqual(searchArtworkTagStats(stats, 'gen'), [
    { name: 'Genshin', count: 3 },
  ])
  assert.equal(searchArtworkTagStats(stats, '  '), stats)
})

test('已选中的作品标签即使被数量限制截断也保持可见', () => {
  const stats = [
    { name: 'a', count: 3 },
    { name: 'b', count: 2 },
    { name: 'c', count: 1 },
  ]
  assert.deepEqual(pinSelectedArtworkTags(stats, ['c'], 2), [
    { name: 'c', count: 1 },
    { name: 'a', count: 3 },
    { name: 'b', count: 2 },
  ])
  assert.deepEqual(pinSelectedArtworkTags(stats, ['a'], 2), [
    { name: 'a', count: 3 },
    { name: 'b', count: 2 },
  ])
})

test('本地分页按页码切片，页码非法时回落到第一页', () => {
  const items = [1, 2, 3, 4, 5]
  assert.deepEqual(paginateWorks(items, 2, 2), [3, 4])
  assert.deepEqual(paginateWorks(items, 3, 2), [5])
  assert.deepEqual(paginateWorks(items, 0, 2), [1, 2])
  assert.deepEqual(paginateWorks(items, Number.NaN, 2), [1, 2])
})
