import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  normalizeSearchSuggestions,
  createSequenceGuard,
} from '../app/utils/searchSuggestions.ts'

test('归一化 cps.php 候选:提取标签与译名并去重', () => {
  const raw = {
    candidates: [
      { tag_name: '原神', tag_translation: 'Genshin Impact', type: 'tag' },
      { tag_name: '原神', tag_translation: 'dup', type: 'prefix' },
      { tag_name: 'ふりおり', access_count: '123' },
      { tag_name: '', tag_translation: 'empty' },
      { other: 'shape' },
    ],
  }
  assert.deepEqual(normalizeSearchSuggestions(raw), [
    { tag: '原神', translation: 'Genshin Impact' },
    { tag: 'ふりおり' },
  ])
})

test('未知响应形状安全降级为空列表', () => {
  assert.deepEqual(normalizeSearchSuggestions(null), [])
  assert.deepEqual(normalizeSearchSuggestions({}), [])
  assert.deepEqual(normalizeSearchSuggestions({ candidates: 'nope' }), [])
  assert.deepEqual(normalizeSearchSuggestions('text'), [])
})

test('序号守卫丢弃迟到的旧结果', () => {
  const guard = createSequenceGuard()
  const first = guard.next()
  const second = guard.next()
  assert.equal(guard.isCurrent(first), false)
  assert.equal(guard.isCurrent(second), true)
})
