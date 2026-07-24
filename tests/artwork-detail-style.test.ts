import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  resolveArtworkDetailStyle,
  type ArtworkDetailStyle,
} from '../app/utils/artworkDetailStyle.ts'
import {
  resolveArtworkAccentTone,
  resolveArtworkPanelTone,
} from '../app/utils/artworkDetailTuning.ts'

test('作品页调试风格仅在开发环境恢复有效值', () => {
  const cases: Array<{
    development: boolean
    stored: string | null
    expected: ArtworkDetailStyle
  }> = [
    { development: true, stored: 'modern', expected: 'modern' },
    { development: true, stored: 'classic', expected: 'classic' },
    { development: true, stored: 'invalid', expected: 'classic' },
    { development: false, stored: 'modern', expected: 'classic' },
  ]

  for (const item of cases) {
    assert.equal(
      resolveArtworkDetailStyle(item.development, item.stored),
      item.expected
    )
  }
})

test('作品页调试色系与面板背景仅在开发环境恢复有效值', () => {
  assert.equal(resolveArtworkAccentTone(true, 'blue'), 'blue')
  assert.equal(resolveArtworkAccentTone(true, 'pink'), 'pink')
  assert.equal(resolveArtworkAccentTone(true, 'invalid'), 'pink')
  assert.equal(resolveArtworkAccentTone(false, 'blue'), 'pink')

  assert.equal(resolveArtworkPanelTone(true, 'pixiv-gray'), 'pixiv-gray')
  assert.equal(resolveArtworkPanelTone(true, 'surface'), 'surface')
  assert.equal(resolveArtworkPanelTone(true, 'invalid'), 'surface')
  assert.equal(resolveArtworkPanelTone(false, 'pixiv-gray'), 'surface')
})
