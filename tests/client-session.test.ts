import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearLegacySessionCredentials } from '../app/utils/sessionCredentials.ts'

test('启动迁移会删除旧版浏览器明文凭据', () => {
  const localRemoved: string[] = []
  const sessionRemoved: string[] = []

  clearLegacySessionCredentials({
    local: {
      removeItem(key: string) {
        localRemoved.push(key)
      },
    },
    session: {
      removeItem(key: string) {
        sessionRemoved.push(key)
      },
    },
  })

  assert.deepEqual(localRemoved, ['pixivnow:token'])
  assert.deepEqual(sessionRemoved, ['pixivnow:csrf'])
})
