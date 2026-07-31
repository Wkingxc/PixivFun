<template lang="pug">
#following-users-view
  .following-users-shell
    header.page-header
      button.back-button(
        @click='$router.push(`/users/${targetUserId}`)'
        aria-label='返回作者页'
        type='button'
      )
        IChevronLeft
      .page-heading
        span.eyebrow FOLLOWING
        h1 {{ followingStore.title }}

    nav.follow-tabs(aria-label='关注用户分组')
      button(
        :class='{ active: tab === item.key }',
        :key='item.key'
        @click='changeTab(item.key)'
        type='button'
        v-for='item in tabsList'
      ) {{ item.label }}

    .user-list
      template(v-if='activeLoading && !activeList.length')
        FollowUserCard(:key='n' v-for='n in 6')
      template(v-else)
        FollowUserCard(
          :key='user.userId',
          :user='user'
          @featured-change='handleFeaturedChange'
          v-for='user in activeList'
        )
      .empty-state(v-if='!activeLoading && !activeList.length') {{ emptyText }}

    FnbPagination.following-user-pagination(
      :item-count='activeTotal',
      :page='page',
      :page-size='PAGE_SIZE'
      @update:page='changePage'
    )
</template>

<script lang="ts" setup>
definePageMeta({ name: 'following' })
import IChevronLeft from '~icons/fa-solid/chevron-left'
import { useUserStore } from '~/stores/session'
import { useFollowingStore } from '~/stores/following'

onMounted(() => {
  setTitle('Following')
  resetAndFetch('' + route.params.id)
})
onBeforeRouteUpdate((to, from) => {
  if (to.name === from.name && to.params.id !== from.params.id) {
    resetAndFetch('' + to.params.id)
  }
})

const route = useRoute()
const router = useRouter()
const targetUserId = ref(String(route.params.id))

type FollowingTab = 'public' | 'hidden' | 'featured'
const tab = ref<FollowingTab>('public')
const PAGE_SIZE = 24
const page = computed(() => {
  const value = Number(route.query.p)
  return Number.isInteger(value) && value > 0 ? value : 1
})

const userStore = useUserStore()
const followingStore = useFollowingStore()
const localPersistenceStore = useLocalPersistenceStore()
const isSelfPage = computed(() => userStore.userId === targetUserId.value)
const activeList = computed(() => {
  if (tab.value === 'featured') return followingStore.featuredList
  return tab.value === 'hidden'
    ? followingStore.hiddenList
    : followingStore.publicList
})
const activeTotal = computed(() => {
  if (tab.value === 'featured') return followingStore.totalFeatured
  return tab.value === 'hidden'
    ? followingStore.totalHidden
    : followingStore.totalPublic
})
const activeLoading = computed(() => {
  if (tab.value === 'featured') return followingStore.isLoadingFeatured
  return tab.value === 'hidden'
    ? followingStore.isLoadingHidden
    : followingStore.isLoadingPublic
})
const emptyText = computed(() =>
  tab.value === 'featured'
    ? '还没有精选作者，可在关注列表或作者主页点击“设为精选”。'
    : '暂无关注用户'
)

const tabsList = computed(() => {
  const list: Array<{ key: FollowingTab; label: string }> = [
    { key: 'public', label: '公开关注' },
  ]
  if (isSelfPage.value) {
    list.push({ key: 'hidden', label: '私密关注' })
    list.push({ key: 'featured', label: '精选作者' })
  }
  return list
})

function resetAndFetch(userId: string) {
  targetUserId.value = userId
  tab.value = resolveTab()
  followingStore.resetFollowing()
  void fetchActiveList()
}

function resolveTab(): FollowingTab {
  if (!isSelfPage.value) return 'public'
  if (route.query.tab === 'featured') return 'featured'
  if (route.query.rest === 'hide') return 'hidden'
  return 'public'
}

async function fetchActiveList(): Promise<void> {
  if (tab.value === 'featured') {
    await followingStore.fetchFeaturedAuthors(page.value)
    localPersistenceStore.rememberFeaturedAuthors(
      activeList.value.map((user) => user.userId)
    )
  } else {
    await followingStore.fetchFollowingList(
      targetUserId.value,
      tab.value === 'hidden',
      page.value
    )
    void localPersistenceStore
      .ensureFeaturedAuthors(activeList.value.map((user) => user.userId))
      .catch(() => {})
  }
}

function changeTab(value: FollowingTab) {
  const query = { ...route.query }
  delete query.p
  if (value === 'hidden') {
    query.rest = 'hide'
    delete query.tab
  } else if (value === 'featured') {
    query.tab = 'featured'
    delete query.rest
  } else {
    delete query.rest
    delete query.tab
  }
  router.push({ query })
}

function changePage(value: number) {
  const query = { ...route.query }
  if (value === 1) delete query.p
  else query.p = String(value)
  router.push({ query })
}

function handleFeaturedChange(featured: boolean) {
  if (tab.value !== 'featured' || featured) return
  if (activeList.value.length === 1 && page.value > 1) {
    changePage(page.value - 1)
  } else {
    void followingStore.fetchFeaturedAuthors(page.value)
  }
}

watch(
  () => [route.query.p, route.query.rest, route.query.tab],
  () => {
    tab.value = resolveTab()
    void fetchActiveList()
    window.scrollTo({ top: 0, behavior: 'auto' })
  }
)
</script>

<style scoped lang="scss">
#following-users-view {
  min-height: calc(100vh - 64px);
  padding: 28px 0 48px;
  color: var(--pf-text);
  background: var(--pf-bg);
}

.following-users-shell {
  width: min(1540px, calc(100% - 64px));
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 22px;
}

.back-button {
  display: grid;
  width: 38px;
  height: 38px;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 50%;
  cursor: pointer;
  place-items: center;

  svg {
    width: 14px;
    height: 14px;
  }
}

.page-heading {
  display: grid;
  gap: 2px;

  .eyebrow {
    color: var(--pf-pink);
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  h1 {
    margin: 0;
    font-family: inherit;
    font-size: clamp(1.25rem, 2vw, 1.65rem);
    font-weight: 780;
  }
}

.follow-tabs {
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

    &.active {
      color: var(--pf-pink);
      border-color: var(--pf-pink);
    }
  }
}

.user-list {
  display: grid;
  gap: 20px;
}

.empty-state {
  padding: 16vh 0;
  color: var(--pf-muted);
  text-align: center;
}

.following-user-pagination {
  margin-top: 30px;
}

@media (max-width: 680px) {
  .following-users-shell {
    width: calc(100% - 24px);
  }
}
</style>
