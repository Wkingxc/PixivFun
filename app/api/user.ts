import { PixivApiBase, type PixivResponse } from './base'
import { requestCache, cacheKey, CACHE_TTL } from './request-cache'
import { buildDiscoveryUsers, type DiscoveryUsersBody } from './discovery-users'
import type {
  ArtworkInfo,
  NovelInfo,
  User,
  UserArtworkTag,
  UserListItem,
  PixivUser,
} from '~/types'

export interface FollowingResult {
  total: number
  users: UserListItem[]
  extraData: {
    meta: {
      ogp: { title: string; image: string; description: string }
    }
  }
}

export class UserApi extends PixivApiBase {
  async getUser(id: string): Promise<User> {
    return requestCache.fetch(
      cacheKey('user', id),
      async () => {
        const { data } = await this.http.get<PixivResponse<User>>(
          `/ajax/user/${id}?full=1`
        )
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.profile }
    )
  }

  async getUserProfileTop(id: string): Promise<{
    illusts: Record<string, ArtworkInfo>
    manga: Record<string, ArtworkInfo>
    novels: Record<string, NovelInfo>
  }> {
    return requestCache.fetch(
      cacheKey('user-profile-top', id),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{
            illusts: Record<string, ArtworkInfo>
            manga: Record<string, ArtworkInfo>
            novels: Record<string, NovelInfo>
          }>
        >(`/ajax/user/${id}/profile/top`)
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getUserProfileAll(id: string): Promise<{
    illusts: Record<string, null>
    manga: Record<string, null>
    pickup?: Record<string, unknown>[] | null
  }> {
    return requestCache.fetch(
      cacheKey('user-profile-all', id),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{
            illusts: Record<string, null>
            manga: Record<string, null>
            pickup?: Record<string, unknown>[] | null
          }>
        >(`/ajax/user/${id}/profile/all`)
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getUserIllusts(
    userId: string,
    ids: string[],
    workCategory: string
  ): Promise<Record<string, ArtworkInfo>> {
    const { data } = await this.http.get<
      PixivResponse<{ works: Record<string, ArtworkInfo> }>
    >(`/ajax/user/${userId}/profile/illusts`, {
      params: { ids, work_category: workCategory, is_first_page: 0 },
    })
    return this.unwrap(data).works
  }

  async getUserArtworkTags(
    userId: string,
    includeR18 = true
  ): Promise<UserArtworkTag[]> {
    return requestCache.fetch(
      cacheKey('user-artwork-tags', userId, includeR18),
      async () => {
        const { data } = await this.http.get<PixivResponse<UserArtworkTag[]>>(
          `/ajax/user/${userId}/illusts/tags`,
          {
            params: {
              lang: 'zh',
              ...(includeR18 ? { all: 1 } : {}),
            },
          }
        )
        return this.unwrap(data).sort((a, b) => b.cnt - a.cnt)
      },
      { ttl: CACHE_TTL.profile }
    )
  }

  async getUserArtworksByTag(
    userId: string,
    tag: string,
    params: { offset: number; limit: number }
  ): Promise<{ works: ArtworkInfo[]; total: number }> {
    return requestCache.fetch(
      cacheKey('user-tag-artworks', userId, tag, params.offset, params.limit),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{ works: ArtworkInfo[]; total: number }>
        >(`/ajax/user/${userId}/illusts/tag`, {
          params: {
            tag,
            offset: params.offset,
            limit: params.limit,
            sensitiveFilterMode: 'userSetting',
            lang: 'zh',
          },
        })
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getUserFollowing(
    userId: string,
    params: { offset: number; limit: number; rest: string }
  ): Promise<FollowingResult> {
    return requestCache.fetch(
      cacheKey('following', userId, params.offset, params.limit, params.rest),
      async () => {
        const { data } = await this.http.get<PixivResponse<FollowingResult>>(
          `/ajax/user/${userId}/following`,
          { params }
        )
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getFollowLatest(params: { p: number; mode: string }): Promise<{
    page: { isLastPage: boolean }
    thumbnails: { illust: ArtworkInfo[] }
  }> {
    return requestCache.fetch(
      cacheKey('follow-latest', params.p, params.mode),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{
            page: { isLastPage: boolean }
            thumbnails: { illust: ArtworkInfo[] }
          }>
        >('/ajax/follow_latest/illust', { params })
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.list }
    )
  }

  /**
   * Authors related to the given user (requires authentication). The
   * payload mirrors /ajax/discovery/users but names the join list
   * `recommendUsers` with `illustIds`/`novelIds`, so it is adapted to the
   * DiscoveryUsersBody shape before reuse.
   */
  async getUserRecommends(
    userId: string,
    params?: { userNum?: number; workNum?: number }
  ): Promise<UserListItem[]> {
    return requestCache.fetch(
      cacheKey('user-recommends', userId, params?.userNum, params?.workNum),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<
            Partial<DiscoveryUsersBody> & {
              recommendUsers?: Array<{
                userId: string
                illustIds?: string[]
                novelIds?: string[]
                recentIllustIds?: string[]
                recentNovelIds?: string[]
              }>
            }
          >
        >(`/ajax/user/${userId}/recommends`, {
          params: {
            userNum: params?.userNum ?? 20,
            workNum: params?.workNum ?? 3,
            isR18: true,
            lang: 'zh',
          },
        })
        const body = this.unwrap(data)
        const joins = body.recommendUsers ?? body.recommendedUsers ?? []
        return buildDiscoveryUsers({
          recommendedUsers: joins.map((join) => ({
            userId: join.userId,
            recentIllustIds:
              ('recentIllustIds' in join ? join.recentIllustIds : undefined) ??
              ('illustIds' in join ? join.illustIds : undefined) ??
              [],
            recentNovelIds:
              ('recentNovelIds' in join ? join.recentNovelIds : undefined) ??
              ('novelIds' in join ? join.novelIds : undefined) ??
              [],
          })),
          users: body.users ?? [],
          thumbnails: body.thumbnails ?? {},
        })
      },
      { ttl: CACHE_TTL.profile }
    )
  }

  async getDiscoveryUsers(params: { limit?: number }): Promise<UserListItem[]> {
    const { data } = await this.http.get<PixivResponse<DiscoveryUsersBody>>(
      '/ajax/discovery/users',
      {
        params: {
          limit: String(params.limit ?? 20),
          lang: 'zh',
        },
      }
    )
    return buildDiscoveryUsers(this.unwrap(data))
  }

  async followUser(userId: string | number): Promise<any> {
    const { data } = await this.postFormData('/bookmark_add.php', {
      mode: 'add',
      type: 'user',
      user_id: '' + userId,
      tag: '',
      restrict: '0',
      format: 'json',
    })
    requestCache.invalidate('following:')
    requestCache.invalidate('follow-latest:')
    requestCache.invalidate(cacheKey('user', userId))
    return data
  }

  async unfollowUser(userId: string | number): Promise<any> {
    const { data } = await this.postFormData('/rpc_group_setting.php', {
      mode: 'del',
      type: 'bookuser',
      id: '' + userId,
    })
    requestCache.invalidate('following:')
    requestCache.invalidate('follow-latest:')
    requestCache.invalidate(cacheKey('user', userId))
    return data
  }

  async _getSessionUser(): Promise<{
    userData: PixivUser
  }> {
    const { data } = await this.http.get<{
      userData: PixivUser
    }>('/api/auth/session', { headers: { 'Cache-Control': 'no-store' } })
    return this.transform(data)
  }
}
