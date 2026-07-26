import { PixivApiBase, type PixivResponse } from './base'
import { requestCache, cacheKey, CACHE_TTL } from './request-cache'
import {
  extractBookmarkTagsFromHtml,
  normalizeArtworkBookmarkSettings,
  normalizeBookmarkTagGroups,
  type ArtworkBookmarkSettings,
  type BookmarkTagGroups,
  type BookmarkVisibility,
} from '~/utils/bookmarkTags'
import type { ArtworkInfo } from '~/types'

/**
 * Bookmark writes change state surfaced by cached reads (bookmark lists,
 * tag groups and the bookmarkData embedded in artwork details).
 */
function invalidateBookmarkCaches(illustId?: string | number): void {
  requestCache.invalidate('bookmarks:')
  requestCache.invalidate('bookmark-tags:')
  if (illustId != null) {
    requestCache.invalidateExact(cacheKey('artwork', illustId))
  } else {
    // Tag/visibility edits only know the bookmark id, not the artwork id.
    requestCache.invalidate('artwork:')
  }
}

export class BookmarkApi extends PixivApiBase {
  async getUserBookmarks(
    userId: string,
    params: { tag: string; offset: number; limit: number; rest: string }
  ): Promise<{ works: ArtworkInfo[]; total: number }> {
    return requestCache.fetch(
      cacheKey(
        'bookmarks',
        userId,
        params.tag,
        params.offset,
        params.limit,
        params.rest
      ),
      async () => {
        const { data } = await this.http.get<
          PixivResponse<{
            works: ArtworkInfo[]
            total: number
            bookmarkTags?: Record<string, string[]>
          }>
        >(`/ajax/user/${userId}/illusts/bookmarks`, { params })
        const body = this.unwrap(data)
        for (const work of body.works) {
          if (!work.bookmarkData) continue
          work.bookmarkData.tags =
            body.bookmarkTags?.[work.bookmarkData.id] ?? []
        }
        return body
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getBookmarkTags(userId: string): Promise<BookmarkTagGroups> {
    return requestCache.fetch(
      cacheKey('bookmark-tags', userId),
      async () => {
        const { data } = await this.http.get<PixivResponse<unknown>>(
          `/ajax/user/${userId}/illusts/bookmark/tags`
        )
        return normalizeBookmarkTagGroups(this.unwrap(data))
      },
      { ttl: CACHE_TTL.list }
    )
  }

  async getArtworkBookmarkSettings(
    illustId: string | number,
    fallbackPrivate = false,
    fallbackTags: string[] = []
  ): Promise<ArtworkBookmarkSettings> {
    const [bookmarkDataResult, editPageResult] = await Promise.allSettled([
      this.http.get<PixivResponse<unknown>>(
        `/ajax/illust/${illustId}/bookmarkData`
      ),
      this.http.get<string>('/bookmark_add.php', {
        params: { type: 'illust', illust_id: '' + illustId },
        responseType: 'text',
      }),
    ])
    if (
      bookmarkDataResult.status === 'rejected' &&
      editPageResult.status === 'rejected'
    ) {
      throw bookmarkDataResult.reason
    }

    let settings: ArtworkBookmarkSettings = {
      tags: [],
      private: fallbackPrivate,
    }
    if (bookmarkDataResult.status === 'fulfilled') {
      try {
        settings = normalizeArtworkBookmarkSettings(
          this.unwrap(bookmarkDataResult.value.data),
          fallbackPrivate
        )
      } catch {
        // The HTML edit page below still exposes current tags and the target
        // artwork already carries the bookmark visibility as a fallback.
      }
    }
    const editPageTags =
      editPageResult.status === 'fulfilled'
        ? extractBookmarkTagsFromHtml(editPageResult.value.data)
        : settings.tags.length
          ? settings.tags
          : fallbackTags
    return {
      ...settings,
      tags: editPageTags,
    }
  }

  async addBookmark(
    illustId: string | number,
    options: { tags?: string[]; private?: boolean } = {}
  ): Promise<any> {
    const { data } = await this.http.post<PixivResponse<any>>(
      '/ajax/illusts/bookmarks/add',
      {
        illust_id: '' + illustId,
        restrict: options.private ? 1 : 0,
        comment: '',
        tags: options.tags ?? [],
      }
    )
    const body = this.unwrap(data)
    invalidateBookmarkCaches(illustId)
    return body
  }

  async addBookmarkTags(
    bookmarkId: string | number | Array<string | number>,
    tags: string[]
  ): Promise<void> {
    if (!tags.length) return
    const bookmarkIds = (Array.isArray(bookmarkId) ? bookmarkId : [bookmarkId])
      .map(String)
      .filter(Boolean)
    if (!bookmarkIds.length) return
    const { data } = await this.http.post<PixivResponse<unknown>>(
      '/ajax/illusts/bookmarks/add_tags',
      { bookmarkIds, tags }
    )
    this.unwrap(data)
    invalidateBookmarkCaches()
  }

  async removeBookmarkTags(
    bookmarkId: string | number | Array<string | number>,
    tags: string[]
  ): Promise<void> {
    if (!tags.length) return
    const bookmarkIds = (Array.isArray(bookmarkId) ? bookmarkId : [bookmarkId])
      .map(String)
      .filter(Boolean)
    if (!bookmarkIds.length) return
    const { data } = await this.http.post<PixivResponse<unknown>>(
      '/ajax/illusts/bookmarks/remove_tags',
      { bookmarkIds, removeTags: tags }
    )
    this.unwrap(data)
    invalidateBookmarkCaches()
  }

  async editBookmarkVisibility(
    bookmarkId: string | number | Array<string | number>,
    visibility: BookmarkVisibility
  ): Promise<void> {
    const bookmarkIds = (Array.isArray(bookmarkId) ? bookmarkId : [bookmarkId])
      .map(String)
      .filter(Boolean)
    if (!bookmarkIds.length) return
    const { data } = await this.http.post<PixivResponse<unknown>>(
      '/ajax/illusts/bookmarks/edit_restrict',
      {
        bookmarkIds,
        bookmarkRestrict: visibility,
      }
    )
    this.unwrap(data)
    invalidateBookmarkCaches()
  }

  async removeBookmark(bookmarkId: string | number): Promise<any> {
    const { data } = await this.postFormData('/ajax/illusts/bookmarks/delete', {
      bookmark_id: '' + bookmarkId,
    })
    invalidateBookmarkCaches()
    return data
  }

  /** Like an artwork. Irreversible — Pixiv has no unlike endpoint. */
  async likeArtwork(illustId: string | number): Promise<{ is_liked: boolean }> {
    const { data } = await this.http.post<PixivResponse<{ is_liked: boolean }>>(
      '/ajax/illusts/like',
      { illust_id: '' + illustId }
    )
    const body = this.unwrap(data)
    requestCache.invalidateExact(cacheKey('artwork', illustId))
    return body
  }
}
