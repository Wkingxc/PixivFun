import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  resolveConfiguredSessionSecret,
  sealPixivSessionPayload,
  unsealPixivSessionPayload,
  type PixivSessionPayload,
} from '../server/utils/session-crypto.ts'
import { shouldUseSecureCookie } from '../server/utils/session-cookie.ts'

const secret = 'test-only-session-secret-with-32-chars'
const now = 1_800_000_000_000
const payload: PixivSessionPayload = {
  version: 1,
  phpsessid: '12345678_0123456789abcdef0123456789ABCDEF',
  csrfToken: 'csrf-token',
  userData: {
    id: '12345678',
    name: 'PixivFun',
  },
  expiresAt: now + 60_000,
}

test('加密会话可解密并保持内容，密文不暴露凭据', () => {
  const sealed = sealPixivSessionPayload(payload, secret)

  assert.equal(sealed.includes(payload.phpsessid), false)
  assert.deepEqual(unsealPixivSessionPayload(sealed, secret, now), payload)
})

test('篡改、错误密钥和过期会话均安全失效', () => {
  const sealed = sealPixivSessionPayload(payload, secret)
  const parts = sealed.split('.')
  parts[2] = `${parts[2]!.startsWith('A') ? 'B' : 'A'}${parts[2]!.slice(1)}`
  const tampered = parts.join('.')

  assert.equal(unsealPixivSessionPayload(tampered, secret, now), null)
  assert.equal(
    unsealPixivSessionPayload(
      sealed,
      'another-test-secret-with-32-characters',
      now
    ),
    null
  )
  assert.equal(
    unsealPixivSessionPayload(sealed, secret, payload.expiresAt),
    null
  )
})

test('短密钥被拒绝', () => {
  assert.throws(() => sealPixivSessionPayload(payload, 'too-short'), /32/)
})

test('未配置会话密钥时允许自动生成，显式短密钥仍被拒绝', () => {
  assert.equal(resolveConfiguredSessionSecret('', true), null)
  assert.throws(
    () => resolveConfiguredSessionSecret('too-short', true),
    /NUXT_SESSION_SECRET/
  )
  assert.equal(resolveConfiguredSessionSecret('', false), null)
  assert.equal(resolveConfiguredSessionSecret(secret, true), secret)
})

test('会话 Cookie 只在实际 HTTPS 连接上启用 Secure', () => {
  assert.equal(shouldUseSecureCookie('https'), true)
  assert.equal(shouldUseSecureCookie('http'), false)
})
