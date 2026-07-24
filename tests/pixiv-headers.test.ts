import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createPixivRequestHeaders } from '../server/utils/pixiv-headers.ts'

const maliciousHeaders = {
  accept: 'application/json',
  authorization: 'attacker-token',
  cookie: 'PHPSESSID=attacker; private_app_cookie=secret',
  'content-type': 'application/json',
  'x-csrf-token': 'attacker-csrf',
  'x-unrelated-secret': 'do-not-forward',
}

test('代理只注入可信会话凭据并丢弃浏览器伪造凭据', () => {
  const headers = createPixivRequestHeaders(
    maliciousHeaders,
    {
      phpsessid: '12345678_0123456789abcdef0123456789ABCDEF',
      csrfToken: 'trusted-csrf',
    },
    'POST'
  )

  assert.equal(
    headers.cookie,
    'PHPSESSID=12345678_0123456789abcdef0123456789ABCDEF'
  )
  assert.equal(headers['x-csrf-token'], 'trusted-csrf')
  assert.equal(headers.authorization, undefined)
  assert.equal(headers['x-unrelated-secret'], undefined)
})

test('公开读取请求不携带任何登录凭据', () => {
  const headers = createPixivRequestHeaders(maliciousHeaders, null, 'GET')

  assert.equal(headers.cookie, undefined)
  assert.equal(headers['x-csrf-token'], undefined)
  assert.equal(headers.authorization, undefined)
  assert.equal(headers.accept, 'application/json')
  assert.equal(headers['content-type'], 'application/json')
})
