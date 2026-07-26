import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildDiscoveryUsers } from '../app/api/discovery-users.ts'

test('用户卡头像优先 imageBig,否则将 _50 规格升级为 _170', () => {
  const body = {
    recommendedUsers: [
      { userId: '1', recentIllustIds: [], recentNovelIds: [] },
      { userId: '2', recentIllustIds: [], recentNovelIds: [] },
      { userId: '3', recentIllustIds: [], recentNovelIds: [] },
    ],
    users: [
      {
        userId: '1' as const,
        name: 'A',
        image: '/-/user-profile/img/a_50.jpg',
        imageBig: '/-/user-profile/img/a_170.jpg',
        comment: '',
        isFollowed: false,
        followedBack: false,
        isMypixiv: false,
        isBlocking: false,
      },
      {
        userId: '2' as const,
        name: 'B',
        image: '/-/user-profile/img/b_50.png',
        comment: '',
        isFollowed: false,
        followedBack: false,
        isMypixiv: false,
        isBlocking: false,
      },
      {
        userId: '3' as const,
        name: 'C',
        image: '/~/common/images/no_profile.png',
        comment: '',
        isFollowed: false,
        followedBack: false,
        isMypixiv: false,
        isBlocking: false,
      },
    ],
    thumbnails: {},
  }
  const result = buildDiscoveryUsers(body as never)
  assert.deepEqual(
    result.map((u) => u.profileImageUrl),
    [
      '/-/user-profile/img/a_170.jpg',
      '/-/user-profile/img/b_170.png',
      '/~/common/images/no_profile.png',
    ]
  )
})
