<template lang="pug">
#following-latest-view
  ArtworkMarkerControl
  .following-shell(:style='artworkLayoutContainerStyle')
    header.following-header
      .heading-copy
        span.eyebrow FOLLOWING
        h1 关注更新
      span.page-summary(
        v-if='!pageLoading && followingStore.latestIllusts.length'
      )
        | 第 {{ currentPage }} 页 · {{ activeIllusts.length }} 件

    nav.following-tabs(aria-label='关注更新分组')
      button(
        :class='{ active: activeTab === item.key }',
        :key='item.key'
        @click='changeTab(item.key)'
        type='button'
        v-for='item in tabs'
      ) {{ item.label }}

    .following-loading(
      v-if='followingStore.latestLoading && followingStore.latestIllusts.length'
    )
      span 正在加载第 {{ currentPage }} 页…

    ArtworkList(
      :list='displayedIllusts',
      :loading='pageLoading && !displayedIllusts.length ? followingStore.latestPageSize : false'
      controlled
    )

    .following-empty(v-if='!pageLoading && !activeIllusts.length') {{ emptyText }}

    FnbPagination.following-pagination(
      :item-count='followingStore.latestItemCount',
      :page='currentPage',
      :page-size='followingStore.latestPageSize'
      @update:page='changePage'
      v-if='followingStore.latestIllusts.length'
    )
</template>

<script lang="ts" setup>
definePageMeta({
  name: 'following-latest',
  alias: ['/bookmark_new_illust'],
})
import { useUserStore } from '~/stores/session'
import { useFollowingStore } from '~/stores/following'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import ArtworkMarkerControl from '~/components/Artwork/ArtworkMarkerControl.vue'
import { partitionFollowingUpdates } from '~/utils/followingLatest'

type FollowingUpdateTab = 'featured' | 'regular'

onMounted(() => {
  setTitle('关注更新')
  followingStore.resetLatest()
  void handleFetch(currentPage.value)
})

const userStore = useUserStore()
const followingStore = useFollowingStore()
const localPersistenceStore = useLocalPersistenceStore()
const { containerStyle: artworkLayoutContainerStyle } =
  useArtworkLayoutSettings()
const route = useRoute()
const router = useRouter()
const tabs: Array<{ key: FollowingUpdateTab; label: string }> = [
  { key: 'featured', label: '精选作者更新' },
  { key: 'regular', label: '普通作者更新' },
]
const groupingLoading = ref(true)
const currentPage = computed(() => {
  const page = Number(route.query.p)
  return Number.isInteger(page) && page > 0 ? page : 1
})
const activeTab = computed<FollowingUpdateTab>(() =>
  route.query.tab === 'regular' ? 'regular' : 'featured'
)
const latestGroups = computed(() =>
  partitionFollowingUpdates(
    followingStore.latestIllusts,
    localPersistenceStore.featuredAuthorIds
  )
)
const activeIllusts = computed(() => latestGroups.value[activeTab.value])
const pageLoading = computed(
  () => followingStore.latestLoading || groupingLoading.value
)
const displayedIllusts = computed(() =>
  groupingLoading.value ? [] : activeIllusts.value
)
const emptyText = computed(() =>
  activeTab.value === 'featured'
    ? '当前页没有精选作者的新作品'
    : '当前页没有普通作者的新作品'
)

let groupingRequestId = 0

async function handleFetch(page: number) {
  if (!userStore.isLoggedIn) {
    return router.push(`/login?back=${encodeURIComponent(route.fullPath)}`)
  }
  const requestId = ++groupingRequestId
  groupingLoading.value = true
  try {
    await followingStore.fetchLatest(page)
    if (requestId !== groupingRequestId) return
    await localPersistenceStore.ensureFeaturedAuthors(
      followingStore.latestIllusts.map((artwork) => artwork.userId)
    )
  } finally {
    if (requestId === groupingRequestId) groupingLoading.value = false
  }
}

function changeTab(tab: FollowingUpdateTab) {
  if (tab === activeTab.value) return
  const query = { ...route.query }
  delete query.p
  if (tab === 'featured') delete query.tab
  else query.tab = tab
  void router.push({ query })
  window.scrollTo({ top: 0, behavior: 'auto' })
}

function changePage(page: number) {
  const query = { ...route.query }
  if (page === 1) delete query.p
  else query.p = String(page)
  router.push({ query })
}

watch(currentPage, (page) => {
  void handleFetch(page)
  window.scrollTo({ top: 0, behavior: 'auto' })
})
</script>

<style scoped lang="scss">
#following-latest-view {
  min-height: calc(100vh - 64px);
  padding: 28px 0 48px;
  color: var(--pf-text);
  background: var(--pf-bg);
}

.following-shell {
  width: min(1840px, calc(100% - 96px));
  margin: 0 auto;
}

.following-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 14px;
}

.following-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--pf-line);

  button {
    padding: 10px 18px 9px;
    color: var(--pf-muted);
    background: transparent;
    border: 0;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    font: inherit;
    font-size: 0.82rem;
    font-weight: 680;

    &:hover:not(.active) {
      color: var(--pf-text);
      background: var(--pf-soft-pink);
    }

    &.active {
      color: var(--pf-pink);
      border-color: var(--pf-pink);
    }
  }
}

.heading-copy {
  display: grid;
  gap: 3px;
}

.eyebrow {
  color: var(--pf-pink);
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.13em;
}

h1 {
  margin: 0;
  color: var(--pf-text);
  font-family: inherit;
  font-size: clamp(1.15rem, 2vw, 1.4rem);
  font-weight: 780;
  line-height: 1.35;
}

.page-summary,
.following-loading,
.following-empty {
  color: var(--pf-muted);
  font-size: 0.78rem;
}

.following-loading {
  min-height: 24px;
  text-align: right;
}

.following-empty {
  padding: 18vh 0;
  text-align: center;
}

.following-pagination {
  margin: 32px auto 8px;
}

:deep(.artworks-list) {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 16px 14px;
  margin-top: 0;
}

:deep(.artworks-list li) {
  display: block;
  width: auto;
  max-width: none;
}

:deep(.fnb-media-card__media) {
  border-color: var(--pf-line);
  border-radius: 14px;
  box-shadow: 0 4px 14px rgb(94 59 80 / 7%);
}

@media (max-width: 900px) {
  :deep(.artworks-list) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  #following-latest-view {
    padding-top: 18px;
  }

  .following-shell {
    width: calc(100% - 24px);
  }

  .following-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 6px;
  }

  :deep(.artworks-list) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
