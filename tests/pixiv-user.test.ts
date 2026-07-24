import assert from 'node:assert/strict'
import { test } from 'node:test'
import { normalizePixivUserImages } from '../server/utils/pixiv-user.ts'

test('登录用户头像统一转换为本站 pximg 代理 URL', () => {
  const user = {
    id: '12345678',
    name: 'PixivFun',
    profileImg:
      'https://i.pximg.net/user-profile/img/2026/01/01/avatar_50.jpg',
    profileImgBig:
      'https://s.pximg.net/common/images/no_profile.png',
  }

  assert.deepEqual(normalizePixivUserImages(user, '/-/', '/~/'), {
    ...user,
    profileImg: '/-/user-profile/img/2026/01/01/avatar_50.jpg',
    profileImgBig: '/~/common/images/no_profile.png',
  })
})
