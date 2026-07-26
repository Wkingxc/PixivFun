import { PixivApiBase, type PixivResponse } from './base'
import { requestCache, cacheKey, CACHE_TTL } from './request-cache'
import {
  normalizeSearchSuggestions,
  type SearchSuggestion,
} from '~/utils/searchSuggestions'
import {
  normalizeUserSearchResult,
  type UserSearchResult,
} from '~/utils/userSearch'
import { emptyTagInfo, normalizeTagInfo, type TagInfo } from '~/utils/tagInfo'
import type { ArtworkInfo, NovelInfo } from '~/types'

export interface SearchRequestOptions {
  /** Cancels the underlying HTTP request (e.g. on route/filter change). */
  signal?: AbortSignal
}

/**
 * The popular-preview block embedded in artwork search responses — this is
 * what Pixiv shows non-premium users instead of full popularity sorting.
 */
export interface SearchPopularResult {
  recent: ArtworkInfo[]
  permanent: ArtworkInfo[]
}

function normalizePopular(raw: unknown): SearchPopularResult {
  const block = raw as {
    recent?: unknown
    permanent?: unknown
  } | null
  return {
    recent: Array.isArray(block?.recent) ? (block.recent as ArtworkInfo[]) : [],
    permanent: Array.isArray(block?.permanent)
      ? (block.permanent as ArtworkInfo[])
      : [],
  }
}

function buildSearchParams(params?: {
  p?: number
  mode?: string
  s_mode?: string
  order?: string
  ai_type?: string
}): Record<string, string | number> {
  const result: Record<string, string | number> = {
    p: params?.p ?? 1,
    mode: params?.mode ?? 'all',
    s_mode: params?.s_mode ?? 's_tag',
    order: params?.order ?? 'date_d',
  }
  if (params?.ai_type) result.ai_type = params.ai_type
  return result
}

function searchCacheKey(
  scope: string,
  keyword: string,
  params?: Record<string, string | number | undefined>
): string {
  return cacheKey(
    scope,
    keyword,
    params?.p,
    params?.mode,
    params?.s_mode,
    params?.order,
    params?.ai_type,
    params?.type,
    params?.work_lang
  )
}

export class SearchApi extends PixivApiBase {
  /** Tag autocomplete via /rpc/cps.php (includes zh translations). */
  async getSearchSuggestions(keyword: string): Promise<SearchSuggestion[]> {
    return requestCache.fetch(
      cacheKey('search-suggest', keyword),
      async () => {
        const { data } = await this.http.get<unknown>('/rpc/cps.php', {
          params: { keyword, lang: 'zh' },
        })
        return normalizeSearchSuggestions(this.transform(data))
      },
      { ttl: CACHE_TTL.profile }
    )
  }

  /**
   * Tag page metadata: the localized tag name plus the pixpedia summary.
   * Tag descriptions are not embedded in any list response, so chips that want
   * to show one have to ask for it per tag (cached; many tags have none).
   */
  async getTagInfo(tag: string): Promise<TagInfo> {
    const keyword = tag.trim()
    if (!keyword) return emptyTagInfo()
    return requestCache.fetch(
      cacheKey('tag-info', keyword),
      async () => {
        const { data } = await this.http.get<PixivResponse<unknown>>(
          `/ajax/search/tags/${encodeURIComponent(keyword)}`
        )
        return normalizeTagInfo(this.unwrap(data), keyword)
      },
      { ttl: CACHE_TTL.profile }
    )
  }

  /**
   * User search (requires authentication). Pixiv's own /search/users page
   * calls `GET /ajax/search/users?nick=&s_mode=&p=&i=` and receives a
   * relational `{ total, userIds, workIds }` payload, so profiles are
   * hydrated through the same cache the user endpoints use.
   */
  async searchUsers(
    keyword: string,
    params?: { p?: number; creatorOnly?: boolean },
    options?: SearchRequestOptions
  ): Promise<UserSearchResult> {
    return requestCache.fetch(
      cacheKey(
        'search-users',
        keyword,
        params?.p,
        params?.creatorOnly ?? false
      ),
      async () => {
        const { data } = await this.http.get<PixivResponse<unknown>>(
          '/ajax/search/users',
          {
            params: {
              nick: keyword,
              s_mode: 's_usr',
              p: params?.p ?? 1,
              i: params?.creatorOnly ? '1' : '0',
              lang: 'zh',
            },
            signal: options?.signal,
          }
        )
        const body = this.unwrap(data) as Record<string, unknown> | null
        // Some variants inline the user entities directly.
        if (Array.isArray(body?.users)) return normalizeUserSearchResult(body)

        const userIds = Array.isArray(body?.userIds)
          ? body.userIds.map(String)
          : []
        const users = (
          await Promise.all(
            userIds.map(async (id) => {
              try {
                const user = await requestCache.fetch(
                  // Same key as UserApi.getUser so profiles are shared.
                  cacheKey('user', id),
                  async () => {
                    const { data: profile } = await this.http.get<
                      PixivResponse<Record<string, unknown>>
                    >(`/ajax/user/${id}?full=1`)
                    return this.unwrap(profile)
                  },
                  { ttl: CACHE_TTL.profile }
                )
                const record = user as Record<string, unknown>
                return {
                  userId: String(record.userId ?? id),
                  userName: String(record.name ?? ''),
                  profileImageUrl: String(
                    record.imageBig ?? record.image ?? ''
                  ),
                  comment: String(record.comment ?? ''),
                  isFollowed: Boolean(record.isFollowed),
                  works: [],
                }
              } catch {
                return null
              }
            })
          )
        ).filter((user): user is NonNullable<typeof user> => user !== null)

        const totalRaw = body?.total
        const total =
          typeof totalRaw === 'number' && Number.isFinite(totalRaw)
            ? totalRaw
            : users.length
        return { users, total }
      },
      { ttl: CACHE_TTL.list, signal: options?.signal }
    )
  }

  async searchArtworks(
    keyword: string,
    params?: {
      p?: number
      mode?: string
      s_mode?: string
      order?: string
      ai_type?: string
    },
    options?: SearchRequestOptions
  ): Promise<{
    data: ArtworkInfo[]
    total: number
    popular: SearchPopularResult
  }> {
    return requestCache.fetch(
      searchCacheKey('search-artworks', keyword, params),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{
            illustManga: { data: ArtworkInfo[]; total: number }
            popular?: unknown
          }>
        >(`/ajax/search/artworks/${encodeURIComponent(keyword)}`, {
          params: buildSearchParams(params),
          signal: options?.signal,
        })
        const body = this.unwrap(data)
        return {
          data: body.illustManga?.data ?? [],
          total: body.illustManga?.total ?? 0,
          popular: normalizePopular(body.popular),
        }
      },
      { ttl: CACHE_TTL.list, signal: options?.signal }
    )
  }

  async searchIllustrations(
    keyword: string,
    params?: {
      p?: number
      mode?: string
      s_mode?: string
      order?: string
      ai_type?: string
      type?: string
    },
    options?: SearchRequestOptions
  ): Promise<{
    data: ArtworkInfo[]
    total: number
    popular: SearchPopularResult
  }> {
    return requestCache.fetch(
      searchCacheKey('search-illustrations', keyword, params),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{
            illust: { data: ArtworkInfo[]; total: number }
            popular?: unknown
          }>
        >(`/ajax/search/illustrations/${encodeURIComponent(keyword)}`, {
          params: {
            ...buildSearchParams(params),
            type: params?.type ?? 'illust_and_ugoira',
          },
          signal: options?.signal,
        })
        const body = this.unwrap(data)
        return {
          data: body.illust?.data ?? [],
          total: body.illust?.total ?? 0,
          popular: normalizePopular(body.popular),
        }
      },
      { ttl: CACHE_TTL.list, signal: options?.signal }
    )
  }

  async searchManga(
    keyword: string,
    params?: {
      p?: number
      mode?: string
      s_mode?: string
      order?: string
      ai_type?: string
    },
    options?: SearchRequestOptions
  ): Promise<{
    data: ArtworkInfo[]
    total: number
    popular: SearchPopularResult
  }> {
    return requestCache.fetch(
      searchCacheKey('search-manga', keyword, params),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{
            manga: { data: ArtworkInfo[]; total: number }
            popular?: unknown
          }>
        >(`/ajax/search/manga/${encodeURIComponent(keyword)}`, {
          params: buildSearchParams(params),
          signal: options?.signal,
        })
        const body = this.unwrap(data)
        return {
          data: body.manga?.data ?? [],
          total: body.manga?.total ?? 0,
          popular: normalizePopular(body.popular),
        }
      },
      { ttl: CACHE_TTL.list, signal: options?.signal }
    )
  }

  async searchNovels(
    keyword: string,
    params?: {
      p?: number
      mode?: string
      s_mode?: string
      order?: string
      ai_type?: string
      work_lang?: string
    },
    options?: SearchRequestOptions
  ): Promise<{ data: NovelInfo[]; total: number }> {
    return requestCache.fetch(
      searchCacheKey('search-novels', keyword, params),
      async () => {
        const searchParams = {
          ...buildSearchParams({
            ...params,
            s_mode: params?.s_mode ?? 's_tag',
          }),
          ...(params?.work_lang ? { work_lang: params.work_lang } : {}),
        }
        const { data } = await this.http.get<
          PixivResponse<{
            novel: { data: NovelInfo[]; total: number }
          }>
        >(`/ajax/search/novels/${encodeURIComponent(keyword)}`, {
          params: searchParams,
          signal: options?.signal,
        })
        const body = this.unwrap(data)
        return {
          data: body.novel?.data ?? [],
          total: body.novel?.total ?? 0,
        }
      },
      { ttl: CACHE_TTL.list, signal: options?.signal }
    )
  }
}
