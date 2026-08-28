<template lang="pug">
#artwork-view
  section.modern-placeholder(:style='directoryTuningStyle' v-if='loading')
    .modern-placeholder__shell
      .modern-placeholder__main
        .modern-placeholder__panel.modern-placeholder__media
          FnbSkeleton(block height='100%' width='100%')
        .modern-placeholder__panel.modern-placeholder__meta
          FnbSkeleton(height='2rem' width='46%')
          FnbSkeleton(:repeat='3' text)
      .modern-placeholder__panel.modern-placeholder__directory
        .modern-placeholder__heading
          FnbSkeleton(height='1.5rem' width='7rem')
          FnbSkeleton(height='2.1rem' width='9rem')
        .modern-placeholder__grid
          FnbSkeleton(
            :key='index'
            block
            height='100%'
            v-for='index in 6'
            width='100%'
          )

  ArtworkDetailModern(
    :bookmark-loading='bookmarkLoading',
    :current-artwork-id='currentArtworkId',
    :has-more-recommendations='!!artworkStore.recommendNextIds.length',
    :illust='illust',
    :like-loading='likeLoading',
    :pages='pages',
    :recommend-loading='recommendLoading',
    :recommendations='artworkStore.recommendations',
    :user='user'
    @add-bookmark='handleAddBookmark'
    @like='handleLike'
    @more-recommend='handleMoreRecommend'
    @remove-bookmark='handleRemoveBookmark'
    v-else-if='!error && illust'
  )

  ArtworkWaterfallReader(
    :illust-id='illust.illustId',
    :pages='pages',
    :title='illust.illustTitle'
    v-if='!loading && !error && illust && !isUgoira && pages.length'
  )

  ArtworkMarkerControl(v-if='!loading && !error && illust')

  //- Error
  section.error(v-if='error')
    ErrorPage(:description='error' title='出大问题')
</template>

<script lang="ts" setup>
definePageMeta({
  name: 'artworks',
  alias: ['/illust/:id', '/i/:id'],
  key: false,
})
import ArtworkDetailModern from '~/components/Artwork/ArtworkDetailModern.vue'
import ArtworkWaterfallReader from '~/components/Artwork/ArtworkWaterfallReader.vue'
import ArtworkMarkerControl from '~/components/Artwork/ArtworkMarkerControl.vue'
import ErrorPage from '~/components/ErrorPage.vue'

// Types
import type { Artwork, ArtworkGallery, User } from '~/types'
import { useUserStore } from '~/stores/session'
import { useArtworkStore } from '~/stores/artwork'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import { useUserProfileStore } from '~/stores/user-profile'
import { effect } from 'vue'
import { setTitle } from '~/utils/setTitle'
import {
  artworkDirectoryScrollKey,
  parseArtworkDirectoryScroll,
} from '~/utils/artworkDirectoryNavigation'

const loading = ref(true)
const error = ref('')
const illust = ref<Artwork>()
const pages = ref<ArtworkGallery[]>([])
const user = ref<User>()
const recommendLoading = ref(false)
const bookmarkLoading = ref(false)
const likeLoading = ref(false)
const route = useRoute()
const userStore = useUserStore()
const artworkStore = useArtworkStore()
const localPersistenceStore = useLocalPersistenceStore()
const userProfileStore = useUserProfileStore()
const { style: directoryTuningStyle } = useArtworkDirectoryTuning()

const isUgoira = computed(() => illust.value?.illustType === 2)
const currentArtworkId = computed(() => String(route.params.id))
let artworkRequestId = 0

function consumeDirectoryScroll(artworkId: string): number | null {
  if (!import.meta.client) return null

  const key = artworkDirectoryScrollKey(artworkId)
  try {
    const scrollTop = parseArtworkDirectoryScroll(localStorage.getItem(key))
    localStorage.removeItem(key)
    return scrollTop
  } catch {
    return null
  }
}

async function restoreDirectoryScroll(
  artworkId: string,
  scrollTop: number | null
): Promise<void> {
  if (!import.meta.client || scrollTop === null) return

  await nextTick()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (String(route.params.id) !== artworkId) return
      window.scrollTo({ top: scrollTop, behavior: 'auto' })
    })
  })
}

async function init(id: string): Promise<void> {
  const requestId = ++artworkRequestId
  const directoryScrollTop = consumeDirectoryScroll(id)
  const hasVisibleArtwork = !!illust.value
  if (!hasVisibleArtwork) loading.value = true
  error.value = ''

  const cachedArtwork = artworkStore.getCachedArtwork(id)
  const cachedPages = artworkStore.getCachedPages(id)
  if (cachedArtwork && cachedPages) {
    if (requestId !== artworkRequestId) return
    const previousUserId = illust.value?.userId
    illust.value = cachedArtwork
    pages.value = cachedPages
    if (previousUserId !== cachedArtwork.userId) user.value = undefined
    artworkStore.clearRecommendations()
    loading.value = false
    await restoreDirectoryScroll(id, directoryScrollTop)
    if (!user.value) void handleUserInit(cachedArtwork.userId)
    void handleRecommendInit(id)
    return
  }

  try {
    const [artworkData, pagesData] = await Promise.all([
      artworkStore.fetchArtwork(id),
      artworkStore.fetchArtworkPages(id),
    ])
    if (requestId !== artworkRequestId) return

    const previousUserId = illust.value?.userId
    illust.value = artworkData
    pages.value = pagesData
    if (previousUserId !== artworkData.userId) user.value = undefined
    artworkStore.clearRecommendations()
    if (!user.value) void handleUserInit(artworkData.userId)
    void handleRecommendInit(id)
  } catch (err) {
    if (requestId !== artworkRequestId) return
    console.warn('illust fetch error', `#${id}`, err)
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = '未知错误'
    }
  } finally {
    if (requestId === artworkRequestId) {
      loading.value = false
      await restoreDirectoryScroll(id, directoryScrollTop)
    }
  }
}

async function handleUserInit(userId: string): Promise<void> {
  const cached = userProfileStore.getCachedUser(userId)
  if (cached) {
    user.value = cached
    return
  }

  try {
    const userData = await userProfileStore.fetchUser(userId)
    user.value = userData
  } catch (err) {
    console.warn('User fetch error', err)
  }
}

async function handleRecommendInit(id: string): Promise<void> {
  if (recommendLoading.value) return
  try {
    recommendLoading.value = true
    console.log('init recommend')
    await artworkStore.fetchRecommendInit(id)
  } catch (err) {
    console.error('recommend fetch error', err)
  } finally {
    recommendLoading.value = false
  }
}
async function handleMoreRecommend(): Promise<void> {
  if (recommendLoading.value) return
  if (!artworkStore.recommendNextIds.length) {
    console.log('no more recommend')
    return
  }

  try {
    recommendLoading.value = true
    console.log('get more recommend')
    await artworkStore.fetchRecommendMore()
  } catch (err) {
    console.error('recommend fetch error', err)
  } finally {
    recommendLoading.value = false
  }
}

async function handleAddBookmark(): Promise<void> {
  if (!illust.value) return
  if (!userStore.isLoggedIn) {
    console.log('需要登录才可以添加收藏')
    return
  }
  if (!illust.value.isBookmarkable) {
    console.log('无法添加收藏')
    return
  }
  if (illust.value.bookmarkData) {
    console.log('已经收藏过啦')
    return
  }
  if (bookmarkLoading.value) return
  try {
    bookmarkLoading.value = true
    const data = await artworkStore.addBookmark(illust.value.illustId)
    if (data.last_bookmark_id) {
      illust.value.bookmarkData = {
        id: data.last_bookmark_id,
        private: false,
      }
      illust.value.bookmarkCount++
    }
  } catch (err) {
    console.error('bookmark add error:', err)
  } finally {
    bookmarkLoading.value = false
  }
}
async function handleRemoveBookmark(): Promise<void> {
  if (!illust.value) return
  if (bookmarkLoading.value || !illust.value.bookmarkData) return
  try {
    bookmarkLoading.value = true
    await artworkStore.removeBookmark(illust.value.bookmarkData.id)
    illust.value.bookmarkData = null
    illust.value.bookmarkCount--
  } catch (err) {
    console.error('bookmark remove failed:', err)
  } finally {
    bookmarkLoading.value = false
  }
}

async function handleLike(): Promise<void> {
  if (!illust.value) return
  if (!userStore.isLoggedIn) {
    console.log('需要登录才可以点赞')
    return
  }
  // Likes are irreversible; once liked, clicking again is a no-op.
  if (likeLoading.value || illust.value.likeData) return
  try {
    likeLoading.value = true
    const { is_liked } = await artworkStore.likeArtwork(illust.value.illustId)
    // is_liked === false means it was not liked before → this call registered it.
    illust.value.likeData = true
    if (!is_liked) illust.value.likeCount++
  } catch (err) {
    console.error('like failed:', err)
  } finally {
    likeLoading.value = false
  }
}

function trackArtworkVisit(id: string): void {
  void localPersistenceStore.recordArtworkVisit(id).catch((error) => {
    console.warn('artwork visit record failed', `#${id}`, error)
  })
}

onBeforeRouteUpdate(async (to) => {
  if (to.name !== 'artworks') {
    return
  }
  const id = String(to.params.id)
  trackArtworkVisit(id)
  init(id)
})

effect(() => setTitle(illust.value?.illustTitle, 'Artworks'))

onMounted(() => {
  const id = String(route.params.id)
  trackArtworkVisit(id)
  init(id)
})
</script>

<style scoped lang="scss">
.modern-placeholder {
  min-height: calc(100vh - 64px);
  padding: 28px 0;
  background: var(--pf-bg);
}

.modern-placeholder__shell {
  display: grid;
  grid-template-columns:
    min(
      var(--modern-content-width, 740px),
      calc(100vw - var(--modern-sidebar-width, 620px) - 96px)
    )
    var(--modern-sidebar-width, 620px);
  align-items: start;
  gap: 28px;
  width: auto;
  margin-right: 20px;
  margin-left: max(24px, calc((100% - 1440px) / 2));
}

.modern-placeholder__main {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.modern-placeholder__panel {
  overflow: hidden;
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: var(--pf-card-shadow);
}

.modern-placeholder__media {
  height: min(68vh, 720px);
  min-height: 420px;
  padding: 16px;
}

.modern-placeholder__meta,
.modern-placeholder__directory {
  padding: 20px;
}

.modern-placeholder__meta {
  display: grid;
  gap: 14px;
}

.modern-placeholder__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 16px;
}

.modern-placeholder__grid {
  display: grid;
  grid-template-columns: repeat(
    2,
    min(var(--directory-card-size, 240px), calc((100% - 10px) / 2))
  );
  gap: 10px;
  justify-content: center;

  :deep(.fnb-skeleton) {
    aspect-ratio: 1;
    border-radius: 14px;
  }
}

@media (max-width: 920px) {
  .modern-placeholder__shell {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 680px) {
  .modern-placeholder {
    padding-top: 14px;
  }

  .modern-placeholder__shell {
    gap: 14px;
    margin-right: 12px;
    margin-left: 12px;
  }

  .modern-placeholder__panel {
    border-radius: 14px;
  }
}
</style>
