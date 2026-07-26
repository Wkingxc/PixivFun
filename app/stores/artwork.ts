import { defineStore } from 'pinia'
import type { Artwork, ArtworkGallery, ArtworkInfo } from '~/types'
import type {
  ArtworkBookmarkSettings,
  BookmarkTagGroups,
} from '~/utils/bookmarkTags'

export const useArtworkStore = defineStore('artwork', () => {
  const pixivClient = usePixivClient()
  const artworkCache = ref(new Map<string, Artwork>())
  const pagesCache = ref(new Map<string, ArtworkGallery[]>())

  const recommendations = ref<ArtworkInfo[]>([])
  const recommendNextIds = ref<string[]>([])

  function getCachedArtwork(id: string): Artwork | undefined {
    return artworkCache.value.get(id)
  }

  function getCachedPages(id: string): ArtworkGallery[] | undefined {
    return pagesCache.value.get(id)
  }

  async function fetchArtwork(id: string): Promise<Artwork> {
    const cached = artworkCache.value.get(id)
    if (cached) return cached

    const artwork = await pixivClient.getArtwork(id)
    artworkCache.value.set(id, artwork)
    return artwork
  }

  async function fetchArtworkPages(id: string): Promise<ArtworkGallery[]> {
    const cached = pagesCache.value.get(id)
    if (cached) return cached

    const pages = await pixivClient.getArtworkPages(id)
    pagesCache.value.set(id, pages)
    return pages
  }

  async function fetchRecommendInit(
    id: string
  ): Promise<{ illusts: ArtworkInfo[]; nextIds: string[] }> {
    const result = await pixivClient.getRecommendInit(id, 18)
    recommendations.value = result.illusts
    recommendNextIds.value = result.nextIds
    return result
  }

  async function fetchRecommendMore(): Promise<void> {
    if (!recommendNextIds.value.length) return
    const ids = recommendNextIds.value.splice(0, 18)
    const result = await pixivClient.getRecommendMore(ids)
    recommendations.value = recommendations.value.concat(result.illusts)
    recommendNextIds.value = recommendNextIds.value.concat(result.nextIds)
  }

  async function fetchComments(
    illustId: string,
    params: { limit: number; offset: number }
  ) {
    return pixivClient.getComments(illustId, params)
  }

  async function fetchBookmarkTags(userId: string): Promise<BookmarkTagGroups> {
    return pixivClient.getBookmarkTags(userId)
  }

  async function fetchArtworkBookmarkSettings(
    illustId: string | number,
    fallbackPrivate = false,
    fallbackTags: string[] = []
  ): Promise<ArtworkBookmarkSettings> {
    return pixivClient.getArtworkBookmarkSettings(
      illustId,
      fallbackPrivate,
      fallbackTags
    )
  }

  async function addBookmark(
    illustId: string | number,
    options: { tags?: string[]; private?: boolean } = {}
  ): Promise<any> {
    return pixivClient.addBookmark(illustId, options)
  }

  async function updateBookmark(
    bookmarkId: string | number,
    current: ArtworkBookmarkSettings,
    next: ArtworkBookmarkSettings
  ): Promise<void> {
    const currentTags = new Set(current.tags)
    const nextTags = new Set(next.tags)
    const addTags = next.tags.filter((tag) => !currentTags.has(tag))
    const removeTags = current.tags.filter((tag) => !nextTags.has(tag))
    const updates: Promise<void>[] = [
      pixivClient.addBookmarkTags(bookmarkId, addTags),
      pixivClient.removeBookmarkTags(bookmarkId, removeTags),
    ]
    if (current.private !== next.private) {
      updates.push(
        pixivClient.editBookmarkVisibility(
          bookmarkId,
          next.private ? 'private' : 'public'
        )
      )
    }
    await Promise.all(updates)
  }

  async function addTagsToBookmarks(
    bookmarkIds: Array<string | number>,
    tags: string[]
  ): Promise<void> {
    await pixivClient.addBookmarkTags(bookmarkIds, tags)
  }

  async function setBookmarksVisibility(
    bookmarkIds: Array<string | number>,
    privateBookmarks: boolean
  ): Promise<void> {
    await pixivClient.editBookmarkVisibility(
      bookmarkIds,
      privateBookmarks ? 'private' : 'public'
    )
  }

  async function removeBookmark(bookmarkId: string | number): Promise<any> {
    return pixivClient.removeBookmark(bookmarkId)
  }

  async function likeArtwork(illustId: string | number): Promise<any> {
    return pixivClient.likeArtwork(illustId)
  }

  function clearRecommendations() {
    recommendations.value = []
    recommendNextIds.value = []
  }

  return {
    artworkCache,
    pagesCache,
    recommendations,
    recommendNextIds,
    getCachedArtwork,
    getCachedPages,
    fetchArtwork,
    fetchArtworkPages,
    fetchRecommendInit,
    fetchRecommendMore,
    fetchComments,
    fetchBookmarkTags,
    fetchArtworkBookmarkSettings,
    addBookmark,
    updateBookmark,
    addTagsToBookmarks,
    setBookmarksVisibility,
    removeBookmark,
    likeArtwork,
    clearRecommendations,
  }
})
