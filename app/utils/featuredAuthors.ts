import type { User, UserListItem } from '~/types'

export function toFeaturedAuthorSnapshot(
  user: User | UserListItem
): UserListItem {
  if ('userName' in user) {
    return {
      ...user,
      illusts: user.illusts.slice(0, 4),
      novels: [],
    }
  }
  return {
    userId: user.userId,
    userName: user.name,
    profileImageUrl: user.imageBig || user.image,
    userComment: user.comment || '',
    following: user.isFollowed,
    followed: user.followedBack,
    isBlocking: user.isBlocking,
    isMypixiv: user.isMypixiv,
    illusts: user.illusts.slice(0, 4),
    novels: [],
    acceptRequest: user.acceptRequest,
  }
}
