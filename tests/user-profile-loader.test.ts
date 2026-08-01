import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadUserProfileSources } from '../app/utils/userProfileLoader.ts'

test('作者精选资料失败时保留核心作者与作品数据', async () => {
  const userData = { userId: '42', name: 'Author' }
  const profileData = { illusts: { '100': {} }, manga: {}, novels: {} }
  const result = await loadUserProfileSources(
    {
      getUser: async () => userData,
      getUserProfileTop: async () => profileData,
      getUserProfileAll: async () => {
        throw new TypeError('fetch failed')
      },
    },
    '42'
  )

  assert.equal(result.userData, userData)
  assert.equal(result.profileData, profileData)
  assert.equal(result.profileAllData, null)
})

test('核心作者资料失败时仍然向调用方报告错误', async () => {
  await assert.rejects(
    loadUserProfileSources(
      {
        getUser: async () => {
          throw new Error('core profile failed')
        },
        getUserProfileTop: async () => ({
          illusts: {},
          manga: {},
          novels: {},
        }),
        getUserProfileAll: async () => ({ pickup: [] }),
      },
      '42'
    ),
    /core profile failed/
  )
})
