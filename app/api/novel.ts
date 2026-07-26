import { PixivApiBase, type PixivResponse } from './base'
import { requestCache, cacheKey, CACHE_TTL } from './request-cache'
import type {
  Novel,
  NovelInfo,
  NovelContentTitle,
  NovelSeries,
  NovelSeriesContentResult,
  NovelRankItem,
  RankedNovelInfo,
} from '~/types'

export class NovelApi extends PixivApiBase {
  async getNovel(id: string): Promise<Novel> {
    return requestCache.fetch(
      cacheKey('novel', id),
      async () => {
        const { data } = await this.http.get<PixivResponse<Novel>>(
          `/ajax/novel/${id}`
        )
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getNovelSeries(id: string): Promise<NovelSeries> {
    return requestCache.fetch(
      cacheKey('novel-series', id),
      async () => {
        const { data } = await this.http.get<PixivResponse<NovelSeries>>(
          `/ajax/novel/series/${id}`
        )
        return this.unwrap(data)
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getNovelSeriesContent(
    id: string,
    params?: { limit?: number; lastOrder?: number; orderBy?: 'asc' | 'dsc' }
  ): Promise<NovelSeriesContentResult> {
    const { data } = await this.http.get<
      PixivResponse<NovelSeriesContentResult>
    >(`/ajax/novel/series_content/${id}`, {
      params: {
        limit: params?.limit ?? 30,
        last_order: params?.lastOrder ?? 0,
        order_by: params?.orderBy ?? 'asc',
      },
    })
    return this.unwrap(data)
  }

  async getNovelSeriesContentTitles(id: string): Promise<NovelContentTitle[]> {
    const { data } = await this.http.get<PixivResponse<NovelContentTitle[]>>(
      `/ajax/novel/series/${id}/content_titles`
    )
    return this.unwrap(data)
  }

  async getNovelRecommendInit(
    id: string,
    limit: number = 18
  ): Promise<{ novels: NovelInfo[]; nextIds: string[] }> {
    const { data } = await this.http.get<
      PixivResponse<{ novels: NovelInfo[]; nextIds: string[] }>
    >(`/ajax/novel/${id}/recommend/init`, { params: { limit } })
    const body = this.unwrap(data)
    return { novels: body.novels ?? [], nextIds: body.nextIds ?? [] }
  }

  async getNovelRecommendMore(ids: string[]): Promise<{ novels: NovelInfo[] }> {
    const searchParams = new URLSearchParams()
    for (const id of ids) {
      searchParams.append('novelIds[]', id)
    }
    const { data } = await this.http.get<
      PixivResponse<{ novels: NovelInfo[] }>
    >('/ajax/novel/recommend/novels', { params: searchParams })
    const body = this.unwrap(data)
    return { novels: body.novels ?? [] }
  }

  async getNovelDiscovery(params: {
    mode?: string
    limit?: number
  }): Promise<NovelInfo[]> {
    const { data } = await this.http.get<
      PixivResponse<{ novels: NovelInfo[] }>
    >('/ajax/novel/discovery', {
      params: {
        mode: params.mode ?? 'safe',
        limit: params.limit,
      },
    })
    return this.unwrap(data).novels ?? []
  }

  async getNovelRanking(params?: {
    p?: number
    mode?: string
  }): Promise<{ date: string; contents: RankedNovelInfo[] }> {
    return requestCache.fetch(
      cacheKey('novel-ranking', params?.p, params?.mode),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{
            display_a: { rank_a: NovelRankItem[] }
            date: string | null
            start: string | null
            end: string | null
          }>
        >('/ajax/ranking/novel', {
          params: { mode: params?.mode ?? 'daily', p: params?.p },
        })
        const body = this.unwrap(data)
        const date =
          body.date ??
          (body.start && body.end ? `${body.start}～${body.end}` : '')
        return {
          date,
          contents: (body.display_a?.rank_a ?? []).map(
            (item): RankedNovelInfo => ({
              id: `${item.id}`,
              title: item.title,
              description: item.comment ?? '',
              createDate: item.create_date ?? '',
              updateDate: item.create_date ?? '',
              restrict: +item.restrict as 0,
              xRestrict: +item.x_restrict as 0 | 1 | 2,
              userId: `${item.user_id}`,
              userName: item.user_name,
              isBookmarkable: true,
              bookmarkData: null,
              titleCaptionTranslation: {
                workTitle: null,
                workCaption: null,
              },
              isUnlisted: false,
              aiType: +item.ai_type,
              url: item.url,
              tags: item.tag_a ?? [],
              profileImageUrl: item.profile_img,
              type: 'novel',
              genre: item.genre,
              textCount: item.character_count,
              wordCount: item.word_count,
              readingTime: item.reading_time,
              isOriginal: item.is_original,
              bookmarkCount: item.bookmark_count,
              language: item.language,
              marker: item.marker,
              rank: item.rank,
            })
          ),
        }
      },
      { ttl: CACHE_TTL.profile }
    )
  }
}
