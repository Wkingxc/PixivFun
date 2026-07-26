import { hasAuthenticatedSession } from '~/composables/userData'
import { PixivApiBase, type PixivResponse } from './base'
import { requestCache, cacheKey, CACHE_TTL } from './request-cache'
import type {
  Artwork,
  ArtworkGallery,
  ArtworkInfo,
  ArtworkInfoOrAd,
  ArtworkRank,
  RankedArtworkInfo,
} from '~/types'

export interface UgoiraMeta {
  src: string
  originalSrc: string
  mime_type: string
  frames: { file: string; delay: number }[]
}

export interface RecommendResult {
  illusts: ArtworkInfo[]
  nextIds: string[]
}

export class ArtworkApi extends PixivApiBase {
  async getArtwork(id: string): Promise<Artwork> {
    return requestCache.fetch(
      cacheKey('artwork', id),
      async () => {
        const { data } = await this.http.get<PixivResponse<Artwork>>(
          `/ajax/illust/${id}?full=1`
        )
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getArtworkPages(id: string): Promise<ArtworkGallery[]> {
    return requestCache.fetch(
      cacheKey('artwork-pages', id),
      async () => {
        const { data } = await this.http.get<PixivResponse<ArtworkGallery[]>>(
          `/ajax/illust/${id}/pages`
        )
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.profile }
    )
  }

  async getUgoiraMeta(id: string): Promise<UgoiraMeta> {
    return requestCache.fetch(
      cacheKey('ugoira-meta', id),
      async () => {
        const { data } = await this.http.get<PixivResponse<UgoiraMeta>>(
          `/ajax/illust/${id}/ugoira_meta`
        )
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.profile }
    )
  }

  async getDiscovery(params: {
    mode?: string
    limit?: number
  }): Promise<ArtworkInfo[]> {
    const hasAuth = hasAuthenticatedSession()
    if (hasAuth) {
      const { data } = await this.http.get<
        PixivResponse<{ thumbnails: { illust: ArtworkInfoOrAd[] } }>
      >('/ajax/discovery/artworks', {
        params: {
          mode: params.mode ?? 'all',
          limit: String(params.limit ?? 60),
        },
      })
      const body = this.unwrap(data)
      return body.thumbnails.illust.filter(
        (item): item is ArtworkInfo => 'id' in item
      )
    } else {
      const { data } = await this.http.get<
        PixivResponse<{ illusts: ArtworkInfoOrAd[] }>
      >('/ajax/illust/discovery', {
        params: {
          mode: params.mode ?? 'safe',
          max: String(Math.min(params.limit ?? 18, 18)),
        },
      })
      const body = this.unwrap(data)
      return body.illusts.filter((item): item is ArtworkInfo => 'id' in item)
    }
  }

  async getRecommendInit(
    id: string,
    limit: number = 18
  ): Promise<RecommendResult> {
    const { data } = await this.http.get<PixivResponse<RecommendResult>>(
      `/ajax/illust/${id}/recommend/init`,
      { params: { limit } }
    )
    return this.unwrap(data)
  }

  async getRecommendMore(ids: string[]): Promise<RecommendResult> {
    const searchParams = new URLSearchParams()
    for (const id of ids) {
      searchParams.append('illust_ids[]', id)
    }
    const { data } = await this.http.get<PixivResponse<RecommendResult>>(
      '/ajax/illust/recommend/illusts',
      { params: searchParams }
    )
    return this.unwrap(data)
  }

  async getRanking(params?: {
    p?: number
    mode?: string
    date?: string
    content?: string
  }): Promise<{ date: string; contents: RankedArtworkInfo[] }> {
    // NOTE: mixin classes must not declare new private members (the
    // PixivWebClient interface merge rejects them), so the fetch body
    // stays inline as a closure.
    return requestCache.fetch(
      cacheKey(
        'ranking',
        params?.p,
        params?.mode,
        params?.date,
        params?.content
      ),
      async () => {
        const searchParams = new URLSearchParams({ format: 'json' })
        if (params?.p) searchParams.set('p', String(params.p))
        if (params?.mode) searchParams.set('mode', params.mode)
        if (params?.date) searchParams.set('date', params.date)
        if (params?.content) searchParams.set('content', params.content)
        const { data } = await this.http.get<{
          date: string
          date_range_text: string
          contents: ArtworkRank[]
        }>('/ranking.php', { params: searchParams })
        const transformed = this.transform(data)
        return {
          date: transformed.date_range_text || transformed.date,
          contents: transformed.contents.map((item): RankedArtworkInfo => ({
            id: `${item.illust_id}`,
            title: item.title,
            description: '',
            createDate: item.date,
            updateDate: item.date,
            illustType: +item.illust_type as 0 | 1 | 2,
            restrict: 0,
            xRestrict: item.illust_content_type.sexual,
            sl: 0,
            userId: `${item.user_id}`,
            userName: item.user_name,
            alt: item.title,
            width: item.width,
            height: item.height,
            pageCount: +item.illust_page_count,
            isBookmarkable: true,
            bookmarkData: null,
            titleCaptionTranslation: {
              workTitle: null,
              workCaption: null,
            },
            isUnlisted: false,
            aiType: 0,
            url: item.url,
            tags: item.tags,
            profileImageUrl: item.profile_img,
            type: 'illust',
            rank: item.rank,
            viewCount: item.view_count,
          })),
        }
      },
      { ttl: CACHE_TTL.profile }
    )
  }
}
