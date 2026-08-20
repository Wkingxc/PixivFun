import assert from 'node:assert/strict'
import { test } from 'node:test'
import { resolveConfiguredProxyUrl } from '../server/utils/system-proxy.ts'

test('Pixiv 服务端只在用户明确启用并配置地址后使用代理', () => {
  assert.equal(
    resolveConfiguredProxyUrl({
      enabled: false,
      url: 'http://127.0.0.1:7890',
    }),
    null
  )
  assert.equal(
    resolveConfiguredProxyUrl({
      enabled: true,
      url: '',
    }),
    null
  )
  assert.equal(
    resolveConfiguredProxyUrl({
      enabled: true,
      url: 'http://127.0.0.1:7890',
    }),
    'http://127.0.0.1:7890'
  )
})
