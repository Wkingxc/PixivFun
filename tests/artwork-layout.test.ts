import assert from 'node:assert/strict'
import test from 'node:test'
import {
  ARTWORK_LAYOUT_DEFAULTS,
  ARTWORK_LAYOUT_LIMITS,
  getArtworkCardImageUrl,
  getEffectiveArtworkColumns,
  normalizeArtworkLayoutValue,
  resolveArtworkCardImageQuality,
} from '../app/utils/artworkLayout.ts'

test('作品排列设置会恢复非法值并限制到允许范围', () => {
  assert.equal(
    normalizeArtworkLayoutValue(
      'invalid',
      ARTWORK_LAYOUT_DEFAULTS.width,
      ARTWORK_LAYOUT_LIMITS.width
    ),
    1840
  )
  assert.equal(
    normalizeArtworkLayoutValue(3000, 1840, ARTWORK_LAYOUT_LIMITS.width),
    2000
  )
  assert.equal(
    normalizeArtworkLayoutValue(1, 6, ARTWORK_LAYOUT_LIMITS.columns),
    2
  )
})

test('作品排列列数在窄屏自动收敛且宽屏保留用户设置', () => {
  assert.equal(getEffectiveArtworkColumns(8, 'wide'), 8)
  assert.equal(getEffectiveArtworkColumns(8, 'narrow'), 4)
  assert.equal(getEffectiveArtworkColumns(8, 'tablet'), 3)
  assert.equal(getEffectiveArtworkColumns(8, 'compact'), 2)
  assert.equal(getEffectiveArtworkColumns(2, 'narrow'), 2)
})

test('作品卡清晰度仅接受小图、高清和原图三档', () => {
  assert.equal(resolveArtworkCardImageQuality('small'), 'small')
  assert.equal(resolveArtworkCardImageQuality('regular'), 'regular')
  assert.equal(resolveArtworkCardImageQuality('original'), 'original')
  assert.equal(resolveArtworkCardImageQuality('invalid'), 'small')
})

test('作品卡清晰度复用现有 Pixiv 小图、高清和原图地址规则', () => {
  const thumb =
    '/-/c/250x250_80_a2/custom-thumb/img/2026/07/24/21/50/40/147583598_p0_custom1200.jpg'
  assert.equal(
    getArtworkCardImageUrl(thumb, 'small'),
    '/-/c/540x540_70/img-master/img/2026/07/24/21/50/40/147583598_p0_master1200.jpg'
  )
  assert.equal(
    getArtworkCardImageUrl(thumb, 'regular'),
    '/-/img-master/img/2026/07/24/21/50/40/147583598_p0_master1200.jpg'
  )
  assert.equal(
    getArtworkCardImageUrl(thumb, 'original'),
    '/-/img-original/img/2026/07/24/21/50/40/147583598_p0.jpg'
  )
})
