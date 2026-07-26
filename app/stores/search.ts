import { defineStore } from 'pinia'
import type { SearchPopularResult } from '~/api/search'
import type { UserSearchUser } from '~/utils/userSearch'
import type { ArtworkInfo, NovelInfo } from '~/types'

export type SearchContentType =
  'artworks' | 'illustrations' | 'ugoira' | 'manga' | 'novels' | 'users'

export const useSearchStore = defineStore('search', () => {
  const pixivClient = usePixivClient()
  const artworkResults = ref<ArtworkInfo[]>([])
  const artworkTotal = ref(0)
  const novelResults = ref<NovelInfo[]>([])
  const novelTotal = ref(0)
  const popular = ref<SearchPopularResult>({ recent: [], permanent: [] })
  const userResults = ref<UserSearchUser[]>([])
  const userTotal = ref(0)
  const loading = ref(false)

  // Cancel the in-flight search when conditions change so a slow older
  // response can never overwrite a newer one.
  let currentSearch: AbortController | null = null

  function beginSearch(): AbortController {
    currentSearch?.abort()
    const controller = new AbortController()
    currentSearch = controller
    loading.value = true
    return controller
  }

  function endSearch(controller: AbortController) {
    if (currentSearch === controller) {
      currentSearch = null
      loading.value = false
    }
  }

  function isCancel(err: unknown): boolean {
    return (
      typeof err === 'object' &&
      err !== null &&
      (err as { code?: string }).code === 'ERR_CANCELED'
    )
  }

  async function searchArtworks(
    keyword: string,
    contentType: SearchContentType,
    params?: {
      p?: number
      mode?: string
      s_mode?: string
      order?: string
      ai_type?: string
      type?: string
    }
  ): Promise<void> {
    if (!keyword) return
    const controller = beginSearch()
    const options = { signal: controller.signal }
    try {
      let data: {
        data: ArtworkInfo[]
        total: number
        popular: SearchPopularResult
      }
      switch (contentType) {
        case 'illustrations':
          data = await pixivClient.searchIllustrations(
            keyword,
            { ...params, type: 'illust' },
            options
          )
          break
        case 'ugoira':
          data = await pixivClient.searchIllustrations(
            keyword,
            { ...params, type: 'ugoira' },
            options
          )
          break
        case 'manga':
          data = await pixivClient.searchManga(keyword, params, options)
          break
        default:
          data = await pixivClient.searchArtworks(keyword, params, options)
      }
      if (controller.signal.aborted) return
      artworkResults.value = data.data
      artworkTotal.value = data.total
      popular.value = data.popular
    } catch (err) {
      if (!isCancel(err)) throw err
    } finally {
      endSearch(controller)
    }
  }

  async function searchNovels(
    keyword: string,
    params?: {
      p?: number
      mode?: string
      s_mode?: string
      order?: string
      ai_type?: string
      work_lang?: string
    }
  ): Promise<void> {
    if (!keyword) return
    const controller = beginSearch()
    try {
      const data = await pixivClient.searchNovels(keyword, params, {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      novelResults.value = data.data
      novelTotal.value = data.total
    } catch (err) {
      if (!isCancel(err)) throw err
    } finally {
      endSearch(controller)
    }
  }

  async function searchUsers(
    keyword: string,
    params?: { p?: number }
  ): Promise<void> {
    if (!keyword) return
    const controller = beginSearch()
    try {
      const data = await pixivClient.searchUsers(keyword, params, {
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      userResults.value = data.users
      userTotal.value = data.total
    } catch (err) {
      if (!isCancel(err)) throw err
    } finally {
      endSearch(controller)
    }
  }

  function reset() {
    artworkResults.value = []
    artworkTotal.value = 0
    novelResults.value = []
    novelTotal.value = 0
    popular.value = { recent: [], permanent: [] }
    userResults.value = []
    userTotal.value = 0
  }

  return {
    artworkResults,
    artworkTotal,
    novelResults,
    novelTotal,
    popular,
    userResults,
    userTotal,
    loading,
    searchArtworks,
    searchNovels,
    searchUsers,
    reset,
  }
})
