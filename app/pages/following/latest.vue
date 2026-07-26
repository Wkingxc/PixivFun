<template lang="pug">
#following-latest-view
  ArtworkMarkerControl
  .following-shell(:style='artworkLayoutContainerStyle')
    header.following-header
      .heading-copy
        span.eyebrow FOLLOWING
        h1 已关注用户的作品
      span.page-summary(v-if='followingStore.latestIllusts.length')
        | 第 {{ currentPage }} 页 · {{ followingStore.latestIllusts.length }} 件

    .following-loading(
      v-if='followingStore.latestLoading && followingStore.latestIllusts.length'
    )
      span 正在加载第 {{ currentPage }} 页…

    ArtworkList(
      :list='followingStore.latestIllusts',
      :loading='followingStore.latestLoading && !followingStore.latestIllusts.length ? followingStore.latestPageSize : false'
      controlled
    )

    .following-empty(
      v-if='!followingStore.latestLoading && !followingStore.latestIllusts.length'
    ) 暂时没有关注用户的新作品

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
import ArtworkMarkerControl from '~/components/Artwork/ArtworkMarkerControl.vue'

onMounted(() => {
  setTitle('New Artworks from Following Users')
  followingStore.resetLatest()
  handleFetch(currentPage.value)
})

const userStore = useUserStore()
const followingStore = useFollowingStore()
const { containerStyle: artworkLayoutContainerStyle } =
  useArtworkLayoutSettings()
const route = useRoute()
const router = useRouter()
const currentPage = computed(() => {
  const page = Number(route.query.p)
  return Number.isInteger(page) && page > 0 ? page : 1
})

async function handleFetch(page: number) {
  if (!userStore.isLoggedIn) {
    return router.push(`/login?back=${encodeURIComponent(route.fullPath)}`)
  }
  await followingStore.fetchLatest(page)
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
