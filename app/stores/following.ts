import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ArtworkInfo, UserListItem } from '~/types'

export const useFollowingStore = defineStore('following', () => {
  // Following list state
  const publicList = ref<UserListItem[]>([])
  const hiddenList = ref<UserListItem[]>([])
  const featuredList = ref<UserListItem[]>([])
  const totalPublic = ref(0)
  const totalHidden = ref(0)
  const totalFeatured = ref(0)
  const isLoadingPublic = ref(false)
  const isLoadingHidden = ref(false)
  const isLoadingFeatured = ref(false)
  const title = ref('Following')

  const hasMorePublic = computed(
    () => totalPublic.value > publicList.value.length
  )
  const hasMoreHidden = computed(
    () => totalHidden.value > hiddenList.value.length
  )

  async function fetchFollowingList(
    userId: string,
    hidden: boolean,
    page = 1
  ): Promise<void> {
    const pixivClient = usePixivClient()
    const list = hidden ? hiddenList : publicList
    const isLoading = hidden ? isLoadingHidden : isLoadingPublic
    const total = hidden ? totalHidden : totalPublic

    if (isLoading.value) return
    isLoading.value = true

    try {
      const data = await pixivClient.getUserFollowing(userId, {
        offset: (page - 1) * 24,
        limit: 24,
        rest: hidden ? 'hide' : 'show',
      })
      list.value = data.users
      total.value = data.total
      title.value = data.extraData.meta.ogp.title || 'Following'
    } finally {
      isLoading.value = false
    }
  }

  async function fetchFeaturedAuthors(page = 1): Promise<void> {
    if (isLoadingFeatured.value) return
    isLoadingFeatured.value = true
    try {
      const data = await $fetch<{
        authors: UserListItem[]
        total: number
      }>('/api/local/featured-authors', {
        query: { page, limit: 24 },
      })
      featuredList.value = data.authors
      totalFeatured.value = data.total
    } finally {
      isLoadingFeatured.value = false
    }
  }

  function resetFollowing() {
    publicList.value = []
    hiddenList.value = []
    featuredList.value = []
    totalPublic.value = 0
    totalHidden.value = 0
    totalFeatured.value = 0
    isLoadingPublic.value = false
    isLoadingHidden.value = false
    isLoadingFeatured.value = false
    title.value = 'Following'
  }

  // Following latest state. One Pixiv page contains up to 60 works. The
  // six-column desktop grid therefore stays within the requested ten rows.
  const LATEST_PAGE_SIZE = 60
  const latestIllusts = ref<ArtworkInfo[]>([])
  const latestPage = ref(1)
  const latestPageSize = ref(LATEST_PAGE_SIZE)
  const latestLastPage = ref<number>()
  const latestHasNextPage = ref(true)
  const latestLoading = ref(false)
  const latestPageCache = new Map<number, ArtworkInfo[]>()
  let latestRequestId = 0

  const latestItemCount = computed(() => {
    if (latestLastPage.value) {
      const lastPageItems =
        latestPageCache.get(latestLastPage.value)?.length ?? 0
      return (latestLastPage.value - 1) * LATEST_PAGE_SIZE + lastPageItems
    }
    return latestPage.value * LATEST_PAGE_SIZE + 1
  })

  async function fetchLatest(page = latestPage.value): Promise<void> {
    const requestId = ++latestRequestId
    const cached = latestPageCache.get(page)
    if (cached) {
      latestLoading.value = false
      latestPage.value = page
      latestIllusts.value = cached
      latestHasNextPage.value =
        !latestLastPage.value || page < latestLastPage.value
      return
    }

    latestLoading.value = true
    try {
      const data = await usePixivClient().getFollowLatest({
        p: page,
        mode: 'all',
      })
      if (requestId !== latestRequestId) return

      const works = data.thumbnails.illust.slice(0, LATEST_PAGE_SIZE)
      latestPageCache.set(page, works)
      latestPage.value = page
      latestIllusts.value = works
      latestHasNextPage.value = !data.page.isLastPage
      if (data.page.isLastPage) latestLastPage.value = page
    } finally {
      if (requestId === latestRequestId) latestLoading.value = false
    }
  }

  function resetLatest() {
    latestRequestId += 1
    latestPageCache.clear()
    latestIllusts.value = []
    latestPage.value = 1
    latestPageSize.value = LATEST_PAGE_SIZE
    latestLastPage.value = undefined
    latestHasNextPage.value = true
    latestLoading.value = false
  }

  return {
    publicList,
    hiddenList,
    featuredList,
    totalPublic,
    totalHidden,
    totalFeatured,
    isLoadingPublic,
    isLoadingHidden,
    isLoadingFeatured,
    hasMorePublic,
    hasMoreHidden,
    title,
    fetchFollowingList,
    fetchFeaturedAuthors,
    resetFollowing,
    latestIllusts,
    latestPage,
    latestPageSize,
    latestItemCount,
    latestHasNextPage,
    latestLoading,
    fetchLatest,
    resetLatest,
  }
})
