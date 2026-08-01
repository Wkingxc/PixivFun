import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  parseMacOSSystemProxy,
  parseWindowsSystemProxy,
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

test('Windows 系统代理只在启用时解析并优先使用 HTTPS 映射', () => {
  assert.equal(
    parseWindowsSystemProxy(`
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    127.0.0.1:7891
`),
    'http://127.0.0.1:7891'
  )
  assert.equal(
    parseWindowsSystemProxy(`
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings
    ProxyEnable    REG_DWORD    0x1
    ProxyServer    REG_SZ    http=127.0.0.1:7890;https=127.0.0.1:7891
`),
    'http://127.0.0.1:7891'
  )
  assert.equal(
    parseWindowsSystemProxy(`
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings
    ProxyEnable    REG_DWORD    0x0
    ProxyServer    REG_SZ    127.0.0.1:7891
`),
    null
  )
})
