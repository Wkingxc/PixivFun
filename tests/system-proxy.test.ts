import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  parseMacOSSystemProxy,
  resolveConfiguredProxyUrl,
} from '../server/utils/system-proxy.ts'

test('Pixiv 服务端代理优先使用显式配置并识别 macOS 系统代理', () => {
  assert.equal(
    resolveConfiguredProxyUrl({
      PIXIVFUN_PROXY: 'http://127.0.0.1:7891',
      HTTPS_PROXY: 'http://127.0.0.1:7890',
    }),
    'http://127.0.0.1:7891'
  )
  assert.equal(
    resolveConfiguredProxyUrl({
      HTTPS_PROXY: 'http://127.0.0.1:7890',
      HTTP_PROXY: 'http://127.0.0.1:7892',
    }),
    'http://127.0.0.1:7890'
  )

  assert.equal(
    parseMacOSSystemProxy(`
<dictionary> {
  HTTPEnable : 1
  HTTPProxy : 127.0.0.1
  HTTPPort : 7890
  HTTPSEnable : 1
  HTTPSProxy : 127.0.0.1
  HTTPSPort : 7890
}
`),
    'http://127.0.0.1:7890'
  )
  assert.equal(
    parseMacOSSystemProxy(`
<dictionary> {
  HTTPEnable : 0
  HTTPSEnable : 0
}
`),
    null
  )
})
