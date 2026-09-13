<template lang="pug">
#following-latest-view
  ArtworkMarkerControl
  .following-shell(:style='artworkLayoutContainerStyle')
    header.following-header
      .heading-copy
        span.eyebrow FOLLOWING
        h1 关注更新
      span.page-summary(v-if='!pageLoading && !loadError')
        | 第 {{ currentPage }} 页 · {{ activeIllusts.length }} 件

    nav.following-tabs(aria-label='关注更新分组')
      button(
        :aria-current='activeTab === item.key ? "page" : undefined',
        :class='{ active: activeTab === item.key }',
        :key='item.key',
        :title='item.label'
        @click='changeTab(item.key)'
        type='button'
        v-for='item in tabs'
      ) {{ item.label }}
      button.manage-categories(
        @click='categoryEditorOpen = true'
        type='button'
      ) + 管理分类

    AuthorCategoryEditor(
      @close='categoryEditorOpen = false'
      v-if='categoryEditorOpen'
    )

    .following-error(role='alert' v-if='loadError')
      span {{ loadError }}
      FnbButton(@click='handleFetch(currentPage)' size='sm') 重试

    .following-error(
      role='status'
      v-if='!pageLoading && !loadError && failedAuthorIds.length'
    )
      span(:title='failedAuthorIds.join(", ")') 有 {{ failedAuthorIds.length }} 位作者的作品暂时无法读取，当前显示已加载的作品
      FnbButton(@click='handleFetch(currentPage)' size='sm') 重试

    .following-loading(role='status' v-if='pageLoading')
      span {{ loadingNote }}

    ArtworkList(
      :list='[]',
      :loading='pageSize'
      controlled
      v-if='pageLoading && !activeIllusts.length'
    )

    .following-date-groups(v-else)
      section.following-date-group(
        :key='group.dateKey || "unknown"'
        v-for='group in displayedGroups'
      )
        header.following-date-divider
          span.following-date-anchor(aria-hidden='true')
          time.following-date-label(:datetime='group.dateKey || undefined') {{ group.dateLabel }}
          span.following-date-weekday(v-if='group.weekdayLabel') {{ group.weekdayLabel }}
          span.following-date-today(v-if='group.isToday') 今天
          span.following-date-line(aria-hidden='true')
          span.following-date-count {{ group.works.length }} 件
        ArtworkList(:list='group.works' controlled)

    .following-empty(
      v-if='!pageLoading && !loadError && !activeIllusts.length'
    ) {{ emptyText }}

    FnbPagination.following-pagination(
      :item-count='itemCount',
      :page='currentPage',
      :page-size='pageSize'
      @update:page='changePage'
      v-if='!pageLoading && !loadError && itemCount > 0'
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
import { useAuthorCategoriesStore } from '~/stores/author-categories'
import ArtworkMarkerControl from '~/components/Artwork/ArtworkMarkerControl.vue'
import type { ArtworkInfo } from '~/types'
import {
  createAuthorCategoryFeed,
  AUTHOR_CATEGORY_PAGE_SIZE,
} from '~/utils/authorCategoryFeed'
import {
  groupFollowingUpdatesByDate,
  partitionFollowingUpdates,
} from '~/utils/followingLatest'

type FollowingUpdateTab = 'featured' | 'regular' | `category:${string}`

onMounted(() => {
  setTitle('关注更新')
  followingStore.resetLatest()
  void handleFetch(currentPage.value)
})

const userStore = useUserStore()
const followingStore = useFollowingStore()
const localPersistenceStore = useLocalPersistenceStore()
const categoryStore = useAuthorCategoriesStore()
const pixivClient = usePixivClient()
const categoryFeed = createAuthorCategoryFeed<ArtworkInfo>({
  getUserProfileAll: (authorId) =>
    $fetch(`/api/local/author-categories/directory/${authorId}`),
  getUserIllusts: (authorId, ids, category) =>
    pixivClient.getUserIllusts(authorId, ids, category),
})
const activeIllusts = ref<ArtworkInfo[]>([])
const itemCount = ref(0)
const pageSize = AUTHOR_CATEGORY_PAGE_SIZE
const tabPages = new Map<FollowingUpdateTab, number>()
const loadingNote = ref('正在读取分类作者…')
const categoryEditorOpen = ref(false)
const loadError = ref('')
const failedAuthorIds = ref<string[]>([])
const { containerStyle: artworkLayoutContainerStyle } =
  useArtworkLayoutSettings()
const route = useRoute()
const router = useRouter()
const tabs = computed<Array<{ key: FollowingUpdateTab; label: string }>>(() => [
  { key: 'featured', label: '精选作者更新' },
  { key: 'regular', label: '普通作者更新' },
  ...categoryStore.categories.map((category) => ({
    key: `category:${category.id}` as const,
    label: category.name,
  })),
])
const groupingLoading = ref(true)
const currentPage = computed(() => {
  const page = Number(route.query.p)
  return Number.isInteger(page) && page > 0 ? page : 1
})
const activeTab = computed<FollowingUpdateTab>(
  () =>
    tabs.value.find((item) => item.key === route.query.tab)?.key ?? 'featured'
)
const activeCategory = computed(() =>
  categoryStore.categories.find(
    (category) => `category:${category.id}` === activeTab.value
  )
)
const categoryMembership = computed(
  () => activeCategory.value?.authorIds.slice().sort().join(',') ?? ''
)
const pageLoading = computed(() => groupingLoading.value)
const displayedGroups = computed(() =>
  groupingLoading.value || loadError.value
    ? []
    : groupFollowingUpdatesByDate(activeIllusts.value)
)
const emptyText = computed(() => {
  if (activeCategory.value) {
    return activeCategory.value.authorIds.length
      ? `“${activeCategory.value.name}”的作者暂无可查看的插画或漫画作品`
      : '这个分类还没有作者，可在关注列表或作者主页点击“分类”添加'
  }
  return activeTab.value === 'featured'
    ? '当前页没有精选作者的新作品'
    : '当前页没有普通作者的新作品'
})

let groupingRequestId = 0
let categoryRequest: AbortController | undefined

async function handleFetch(page: number) {
  if (!userStore.isLoggedIn) {
    return router.push(`/login?back=${encodeURIComponent(route.fullPath)}`)
  }
  const requestId = ++groupingRequestId
  categoryRequest?.abort()
  const controller = new AbortController()
  categoryRequest = controller
  groupingLoading.value = true
  loadError.value = ''
  failedAuthorIds.value = []
  loadingNote.value = '正在读取分类作者…'
  activeIllusts.value = []
  try {
    await categoryStore.init()
    if (requestId !== groupingRequestId) return
    if (!activeCategory.value) {
      loadingNote.value = `正在加载第 ${page} 页关注动态…`
      await followingStore.fetchLatest(page)
      if (requestId !== groupingRequestId) return
      await localPersistenceStore.ensureFeaturedAuthors(
        followingStore.latestIllusts.map((work) => work.userId)
      )
      if (requestId !== groupingRequestId) return
      const groups = partitionFollowingUpdates(
        followingStore.latestIllusts,
        localPersistenceStore.featuredAuthorIds
      )
      activeIllusts.value =
        activeTab.value === 'regular' ? groups.regular : groups.featured
      itemCount.value = followingStore.latestItemCount
      return
    }
    const ids = activeCategory.value.authorIds
    const result = await categoryFeed.load(
      ids,
      page,
      controller.signal,
      (loaded, total) => {
        if (requestId === groupingRequestId)
          loadingNote.value =
            loaded < total
              ? `正在汇总作者作品（${loaded}/${total}）…`
              : `正在加载第 ${page} 页作品…`
      }
    )
    if (requestId !== groupingRequestId) return
    activeIllusts.value = result.works
    itemCount.value = result.total
    failedAuthorIds.value = result.failedAuthorIds
    tabPages.set(activeTab.value, result.page)
    if (result.page !== currentPage.value) {
      const query = { ...route.query }
      if (result.page === 1) delete query.p
      else query.p = String(result.page)
      await router.replace({ query })
    }
  } catch {
    if (requestId === groupingRequestId)
      loadError.value = activeCategory.value
        ? '加载分类作者的作品失败，请重试'
        : '加载关注更新失败，请重试'
  } finally {
    if (requestId === groupingRequestId) groupingLoading.value = false
  }
}

function changeTab(tab: FollowingUpdateTab) {
  if (tab === activeTab.value) return
  const query = { ...route.query }
  tabPages.set(activeTab.value, currentPage.value)
  const page = tab.startsWith('category:') ? (tabPages.get(tab) ?? 1) : 1
  if (page === 1) delete query.p
  else query.p = String(page)
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

watch([currentPage, activeTab, categoryMembership], () => {
  if (!categoryStore.initialized) return
  void handleFetch(currentPage.value)
  window.scrollTo({ top: 0, behavior: 'auto' })
})

onBeforeUnmount(() => {
  groupingRequestId += 1
  categoryRequest?.abort()
})

watch(
  () => categoryStore.categories.map((category) => category.id),
  () => {
    if (!categoryStore.initialized || typeof route.query.tab !== 'string')
      return
    if (
      route.query.tab.startsWith('category:') &&
      !tabs.value.some((item) => item.key === route.query.tab)
    ) {
      const query = { ...route.query }
      delete query.tab
      delete query.p
      void router.replace({ query })
    }
  }
)
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
  overflow-x: auto;
  gap: 4px;
  margin-bottom: 20px;
  border-bottom: 1px solid var(--pf-line);

  button {
    flex: none;
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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

.following-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  color: var(--pf-pink);
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

.following-date-groups {
  display: grid;
  gap: 34px;
}

.following-date-group {
  min-width: 0;
}

.following-date-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 30px;
  margin-bottom: 16px;
}

.following-date-anchor {
  width: 4px;
  height: 28px;
  border-radius: 999px;
  background: var(--pf-pink);
  flex: 0 0 auto;
}

.following-date-label {
  color: var(--pf-text);
  font-size: 1.12rem;
  font-weight: 780;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.following-date-weekday,
.following-date-count {
  color: var(--pf-muted);
  font-size: 0.82rem;
  font-weight: 620;
  white-space: nowrap;
}

.following-date-today {
  padding: 3px 11px;
  color: var(--pf-pink);
  border: 1px solid var(--pf-pink);
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 720;
  line-height: 1.25;
  white-space: nowrap;
}

.following-date-line {
  height: 1px;
  background: var(--pf-line);
  flex: 1 1 auto;
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

.following-date-group :deep(.artworks-list) {
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

  .following-date-groups {
    gap: 28px;
  }

  .following-date-divider {
    gap: 8px;
    margin-bottom: 12px;
  }

  .following-date-label {
    font-size: 1rem;
  }

  .following-date-today {
    padding-inline: 8px;
  }

  :deep(.artworks-list) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
