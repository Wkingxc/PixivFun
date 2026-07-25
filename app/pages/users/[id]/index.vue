<template lang="pug">
#user-view
  ArtworkMarkerControl(v-if='showArtworkMarkerControl')

  //- Loading
  section.loading(v-if='loadingUser')
    .cover-banner.no-cover
    .body-inner.user-layout(
      :class='{ "artwork-grid-layout": isArtworkGridView }'
    )
      .user-sidebar(v-if='!isArtworkGridView')
        FnbCard
          .avatar-area
            FnbSkeleton(block height='6rem' width='6rem')
          .sidebar-info
            FnbSkeleton(height='1.4em' text width='8em')
            .meta-lines
              .meta-line(v-for='_ in 3')
                FnbSkeleton(height='1em' text width='1em')
                FnbSkeleton(
                  :width='`${Math.max(4, 10 * Math.random())}em`'
                  text
                )
      .user-content
        ArtworkList(:list='[]', :loading='20')

  //- Error
  section.error(v-else-if='error')
    ErrorPage(:description='error' title='出大问题')

  //- :)
  section.user(v-else-if='user')
    .cover-banner(:class='{ "no-cover": !user?.background }')
      .cover-image(
        :style='{ backgroundImage: `url("${user.background.url}")` }'
        v-if='user?.background?.url'
      )
      span.cover-placeholder(v-else) 用户未设置封面~

    .body-inner.user-layout(
      :class='{ "artwork-grid-layout": isArtworkGridView }'
    )
      //- Left: User info card
      .user-sidebar(v-if='!isArtworkGridView')
        FnbCard(shadow='md')
          .avatar-area
            a.plain.pointer(@click='showUserMore = true')
              img.user-avatar(:alt='user.name', :src='user.imageBig')
          h2.username {{ user.name }}
          .user-id(v-if='user.premium')
            FnbTag(color='var(--fnb-highlight)') Premium
          .meta-lines
            .meta-line
              RouterLink(:to='`/users/${user.userId}/following`')
                | 关注了
                strong {{ user.following }}
                |
                | 人
            .meta-line(v-if='user.gender?.name')
              FnbIcon: IFasVenusMars
              | {{ user.gender.name }}
            .meta-line(v-if='user.birthDay?.name')
              FnbIcon: IFasBirthdayCake
              | {{ user.birthDay?.name }}
            .meta-line(v-if='user.region?.name')
              FnbIcon: IFasMapMarkerAlt
              | {{ user.region?.name }}
            .meta-line(v-if='user.webpage')
              FnbIcon: IFasHome
              a(:href='user.webpage' rel='noopener noreferrer' target='_blank') {{ user.webpage }}
          .user-comment(v-if='user.comment')
            hr
            p.comment-text {{ user.comment }}
          .user-comment(v-else)
            hr
            p.comment-text.muted -
          .sidebar-actions
            a.plain.pointer(@click='showUserMore = true') 查看更多
          hr
          .sidebar-buttons
            template(v-if='!isSelfUserPage')
              FnbButton(
                :loading='loadingUserFollow',
                :variant='user.isFollowed ? "success" : "default"'
                @click='handleUserFollow'
                size='sm'
              )
                template(#icon)
                  FnbIcon
                    IFasCheck(v-if='user.isFollowed')
                    IFasPlus(v-else)
                | {{ user.isFollowed ? '已关注' : '关注' }}
            template(v-else)
              FnbButton(size='sm') 我真棒

      //- Right: Artworks
      .user-content
        FnbTabs(:tabs='tabsList' v-model='tab')
          template(#panel-illusts)
            .fnb-empty(v-if='user.illusts && !user.illusts.length') 用户没有插画作品 (｡•́︿•̀｡)
            .user-illust(v-else)
              ArtworkListByUser(:user-id='user.userId' work-category='illust')
          template(#panel-mangas)
            .fnb-empty(v-if='!user.manga?.length') 用户没有漫画作品 (*/ω＼*)
            .user-manga(v-else)
              ArtworkListByUser(:user-id='user.userId' work-category='manga')
          template(#panel-novels)
            .fnb-empty(v-if='!user.novels?.length') 用户没有小说作品 (｡•́︿•̀｡)
            .user-novels(v-else)
              NovelList(:list='user.novels')
          template(#panel-public_bookmarks)
            ArtworkList(
              :list='[]',
              :loading='8',
              :marker-disabled='isSelfUserPage'
              v-if='!publicBookmarks?.length && loadingPublicBookmarks'
            )
            .fnb-empty(v-else-if='!publicBookmarks?.length') {{ emptyPublicBookmarksText }}
            .user-bookmarks.bookmark-grid(ref='publicBookmarkGridRef' v-else)
              ArtworkList(
                :list='publicBookmarks',
                :marker-disabled='isSelfUserPage'
              )
              FnbPagination.bookmark-pagination(
                :item-count='totalPublicBookmarks',
                :page='publicBookmarkPage',
                :page-size='BOOKMARK_PAGE_SIZE'
                @update:page='changePublicBookmarkPage'
              )
          template(#panel-hidden_bookmarks v-if='isSelfUserPage')
            ArtworkList(
              :list='[]',
              :loading='8'
              marker-disabled
              v-if='!hiddenBookmarks?.length && loadingHiddenBookmarks'
            )
            .fnb-empty(v-else-if='!hiddenBookmarks?.length') 没有隐藏的小秘密 இ௰இ
            .user-bookmarks.bookmark-grid(ref='hiddenBookmarkGridRef' v-else)
              ArtworkList(:list='hiddenBookmarks' marker-disabled)
              FnbPagination.bookmark-pagination(
                :item-count='totalHiddenBookmarks',
                :page='hiddenBookmarkPage',
                :page-size='BOOKMARK_PAGE_SIZE'
                @update:page='changeHiddenBookmarkPage'
              )

    //- User detail dialog
    .fnb-dialog-overlay(@click.self='showUserMore = false' v-if='showUserMore')
      .fnb-dialog-card
        button.fnb-dialog-card__close(
          @click='showUserMore = false'
          aria-label='关闭'
        ) ×
        .fnb-dialog-card__header 用户资料
        .fnb-dialog-card__body
          .info-modal
            .modal-top
              a.modal-avatar(
                :href='user.imageBig'
                target='_blank'
                title='查看头像'
              )
                img(:src='user.imageBig')
                .premium-icon(title='该用户订阅了高级会员' v-if='user.premium')
                  FnbIcon: IFasParking
              .modal-name {{ user.name }}
            section.user-bio
              h4 个人简介
              .comment.pre {{ user.comment || '-' }}
            section.user-workspace(v-if='user.workspace')
              hr
              h4 工作环境
              FnbImage(
                :preview-src='user.workspace.wsBigUrl',
                :src='user.workspace.wsUrl'
                lazy
                v-if='user.workspace.wsUrl'
              )
              FnbTable
                tbody
                  tr(v-for='(val, key) in user.workspace')
                    th {{ workspaceNameMap[key] || key }}
                    td {{ val }}
            section.dev-only
              hr
              h4 Debug Info
              details
                pre(
                  style='overflow: auto; background: var(--fnb-bg); padding: 4px'
                ) {{ JSON.stringify(user, null, 2) }}
</template>

<script lang="ts" setup>
definePageMeta({
  name: 'users',
  alias: ['/u/:id'],
})
import ArtworkList from '~/components/Artwork/ArtworkList.vue'
import ArtworkListByUser from '~/components/Artwork/ArtworkListByUser.vue'
import ArtworkMarkerControl from '~/components/Artwork/ArtworkMarkerControl.vue'
import ErrorPage from '~/components/ErrorPage.vue'
import NovelList from '~/components/Novel/NovelList.vue'
import IFasBirthdayCake from '~icons/fa-solid/birthday-cake'
import IFasCheck from '~icons/fa-solid/check'
import IFasHome from '~icons/fa-solid/home'
import IFasMapMarkerAlt from '~icons/fa-solid/map-marker-alt'
import IFasParking from '~icons/fa-solid/parking'
import IFasPlus from '~icons/fa-solid/plus'
import IFasVenusMars from '~icons/fa-solid/venus-mars'
import { useUserStore } from '~/stores/session'
import { useUserProfileStore } from '~/stores/user-profile'
import type { ArtworkInfo, User } from '~/types'
import {
  BOOKMARK_PAGE_SIZE,
  bookmarkPageOffset,
  isArtworkGridTab,
} from '~/utils/refineModernArtwork'
import { setTitle } from '~/utils/setTitle'
import { effect } from 'vue'

const loadingUser = ref(true)
const user = ref<User>()
const userStore = useUserStore()
const userProfileStore = useUserProfileStore()
const toast = useToast()
const isSelfUserPage = computed(() => user.value?.userId === userStore.userId)

const publicBookmarks = ref<ArtworkInfo[]>([])
const loadingPublicBookmarks = ref(false)
const totalPublicBookmarks = ref(0)
const publicBookmarkPage = ref(1)
const publicBookmarkCache = new Map<number, ArtworkInfo[]>()

const hiddenBookmarks = ref<ArtworkInfo[]>([])
const loadingHiddenBookmarks = ref(false)
const totalHiddenBookmarks = ref(0)
const hiddenBookmarkPage = ref(1)
const hiddenBookmarkCache = new Map<number, ArtworkInfo[]>()
const publicBookmarkGridRef = ref<HTMLElement | null>(null)
const hiddenBookmarkGridRef = ref<HTMLElement | null>(null)

enum UserTabs {
  illusts = 'illusts',
  mangas = 'mangas',
  novels = 'novels',
  public_bookmarks = 'public_bookmarks',
  hidden_bookmarks = 'hidden_bookmarks',
}

const tab = ref<string>()
const error = ref('')
const showUserMore = ref(false)
useBodyScrollLock(showUserMore)
const route = useRoute()
const showArtworkMarkerControl = computed(
  () =>
    !!user.value &&
    !(
      isSelfUserPage.value &&
      [UserTabs.public_bookmarks, UserTabs.hidden_bookmarks].includes(
        tab.value as UserTabs
      )
    )
)
const isArtworkGridView = computed(() =>
  isArtworkGridTab(tab.value || String(route.query.tab || ''))
)

const emptyPublicBookmarksText = computed(() =>
  isSelfUserPage.value
    ? '收藏夹是空的 Σ(⊙▽⊙"a'
    : user.value?.name + '没有公开的收藏 (❁´◡`❁)'
)

const tabsList = computed(() => {
  const list = [
    { key: UserTabs.illusts, label: '插画' },
    { key: UserTabs.mangas, label: '漫画' },
  ]
  if (user.value?.novels?.length) {
    list.push({ key: UserTabs.novels, label: '小说' })
  }
  list.push({ key: UserTabs.public_bookmarks, label: '公开收藏' })
  if (isSelfUserPage.value) {
    list.push({ key: UserTabs.hidden_bookmarks, label: '秘密收藏' })
  }
  return list
})

const workspaceNameMap: Record<string, string> = {
  userWorkspacePc: '个人电脑',
  userWorkspaceMonitor: '显示器',
  userWorkspaceTool: '创作工具',
  userWorkspaceScanner: '扫描仪',
  userWorkspaceTablet: '平板电脑',
  userWorkspaceMouse: '鼠标',
  userWorkspacePrinter: '打印机',
  userWorkspaceDesktop: '桌面',
  userWorkspaceMusic: '音乐播放器',
  userWorkspaceDesk: '桌子',
  userWorkspaceChair: '椅子',
  userWorkspaceComment: '说明',
  wsUrl: '工作空间图片URL',
  wsBigUrl: '工作空间大图片URL',
}

async function init(id: string | number, initTab?: UserTabs): Promise<void> {
  // reset states
  user.value = undefined
  tab.value = undefined
  error.value = ''
  publicBookmarks.value = []
  hiddenBookmarks.value = []
  totalPublicBookmarks.value = 0
  totalHiddenBookmarks.value = 0
  publicBookmarkPage.value = 1
  hiddenBookmarkPage.value = 1
  publicBookmarkCache.clear()
  hiddenBookmarkCache.clear()

  try {
    loadingUser.value = true
    user.value = await userProfileStore.fetchUser('' + id)
    void $fetch(`/api/local/authors/${id}/visit`, { method: 'POST' }).catch(
      () => {}
    )
    tab.value = initTab || UserTabs.illusts
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = '未知错误'
    }
  } finally {
    loadingUser.value = false
  }
}

const loadingUserFollow = ref(false)
async function handleUserFollow() {
  const target = user.value
  if (!target) return

  loadingUserFollow.value = true
  try {
    if (target.isFollowed) {
      await userProfileStore.unfollowUser(target.userId)
    } else {
      await userProfileStore.followUser(target.userId)
    }
    target.isFollowed = !target.isFollowed
  } catch {
    toast.error(target.isFollowed ? '取消关注失败，请重试' : '关注失败，请重试')
  } finally {
    loadingUserFollow.value = false
  }
}

function userMore(): void {
  showUserMore.value = true
}

async function getBookmarks(hidden = false, page = 1): Promise<void> {
  const curUser = user.value
  if (!curUser) return

  const curLoading = hidden ? loadingHiddenBookmarks : loadingPublicBookmarks
  const curList = hidden ? hiddenBookmarks : publicBookmarks
  const curTotal = hidden ? totalHiddenBookmarks : totalPublicBookmarks
  const curPage = hidden ? hiddenBookmarkPage : publicBookmarkPage
  const cache = hidden ? hiddenBookmarkCache : publicBookmarkCache

  const cached = cache.get(page)
  if (cached) {
    curList.value = cached
    curPage.value = page
    return
  }

  if (curLoading.value) return

  try {
    curLoading.value = true
    const data = await userProfileStore.fetchBookmarks(curUser.userId, {
      offset: bookmarkPageOffset(page),
      hidden,
    })
    curTotal.value = data.total
    cache.set(page, data.works)
    curList.value = data.works
    curPage.value = page
  } catch (err) {
    console.warn('failed to fetch bookmarks', err)
  } finally {
    curLoading.value = false
  }
}

async function changePublicBookmarkPage(page: number): Promise<void> {
  await getBookmarks(false, page)
  publicBookmarkGridRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

async function changeHiddenBookmarkPage(page: number): Promise<void> {
  await getBookmarks(true, page)
  hiddenBookmarkGridRef.value?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}

watch(tab, (newTab) => {
  if (!newTab) return

  const isPublicBookmarkEmpty = !publicBookmarks.value.length
  const isHiddenBookmarkEmpty = !hiddenBookmarks.value.length

  const url = new URL(location.href)
  url.searchParams.set('tab', newTab)
  history.replaceState(history.state, '', '' + url)

  if (newTab === UserTabs.public_bookmarks && isPublicBookmarkEmpty) {
    getBookmarks(false, 1)
  }
  if (newTab === UserTabs.hidden_bookmarks && isHiddenBookmarkEmpty) {
    getBookmarks(true, 1)
  }
})

onBeforeRouteUpdate((to) => {
  if (to.name !== 'users') {
    return
  }
  init(to.params.id as string, to.query.tab as UserTabs)
})

effect(() => setTitle(user.value?.name, 'Users'))
onMounted(async () => {
  init(route.params.id as string, route.query.tab as UserTabs)
})
</script>

<style scoped lang="scss">
// ── Cover Banner ──
.cover-banner {
  height: 280px;
  position: relative;
  border-bottom: 3px solid var(--fnb-border);
  overflow: hidden;

  &.no-cover {
    height: 120px;
    background: var(--fnb-bg);
  }

  @media (max-width: 768px) {
    height: 180px;
    &.no-cover {
      height: 80px;
    }
  }
}

.cover-image {
  width: 100%;
  height: 100%;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--fnb-text-muted);
  user-select: none;
}

// ── Two-Column Layout ──
.user-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  gap: 1.5rem;
  margin-top: 1.5rem;
  align-items: start;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }

  &.artwork-grid-layout {
    grid-template-columns: minmax(0, 1fr);

    .user-content {
      width: 100%;
    }
  }
}

.bookmark-grid {
  scroll-margin-top: 100px;

  :deep(.artworks-list) {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 1.25rem;
    justify-content: stretch;
  }

  :deep(.artworks-list > li) {
    width: auto;
    max-width: none;
    min-width: 0;
  }

  @media (max-width: 1180px) {
    :deep(.artworks-list) {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }

  @media (max-width: 820px) {
    :deep(.artworks-list) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (max-width: 560px) {
    :deep(.artworks-list) {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 1rem;
    }
  }
}

.bookmark-pagination {
  margin: 2rem 0 0.5rem;
}

// ── Left Sidebar ──
.user-sidebar {
  text-align: center;

  .avatar-area {
    margin-bottom: 0.75rem;
  }

  .user-avatar {
    width: 100px;
    height: 100px;
    @include fnb-border;
    @include fnb-shadow-sm;
    background: var(--fnb-surface);
  }

  .username {
    font-family: var(--fnb-font-display);
    font-size: 1.3rem;
    font-weight: 900;
    margin: 0 0 0.25rem;
  }

  .user-id {
    margin-bottom: 0.5rem;
  }

  hr {
    border: none;
    height: 3px;
    background: var(--fnb-border);
    margin: 0.75rem -1rem;
  }

  .meta-lines {
    text-align: left;
    font-size: 0.85rem;
    color: var(--fnb-text);
  }

  .meta-line {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0;

    .fnb-icon {
      color: var(--fnb-brand);
      font-size: 1.3em;
    }

    a {
      display: inline;
    }
  }

  .user-comment {
    text-align: left;

    .comment-text {
      font-size: 0.85rem;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 6rem;
      overflow: hidden;
      margin: 0;

      &.muted {
        color: var(--fnb-text-muted);
      }
    }
  }

  .sidebar-actions {
    text-align: right;
    font-size: 0.8rem;
    margin-top: 0.25rem;
  }

  .sidebar-buttons {
    display: flex;
    justify-content: center;
    gap: 0.5rem;
  }
}

// ── Right Content ──
.user-content {
  min-width: 0;

  :deep(.fnb-tabs__nav) {
    position: sticky;
    top: 63px;
    z-index: 12;
  }
}

.user-illust,
.user-manga,
.user-novels {
  :deep(.author) {
    display: none;
  }
}

.fnb-empty {
  margin: 10vh auto;
  text-align: center;
  color: var(--fnb-text-muted);
}

// ── Detail Modal ──
.fnb-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

.fnb-dialog-card {
  @include fnb-border;
  @include fnb-shadow-lg;
  background: var(--fnb-surface);
  width: 600px;
  max-width: 86vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  position: relative;

  &__close {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    font-weight: 900;
    line-height: 1;
    cursor: pointer;
    color: var(--fnb-text-muted);
    z-index: 1;

    &:hover {
      color: var(--fnb-text);
    }
  }

  &__header {
    font-family: var(--fnb-font-display);
    font-weight: 900;
    font-size: 1.1rem;
    padding: 1rem 1.5rem 0.5rem;
    padding-right: 2.5rem;
  }

  &__body {
    padding: 0 1.5rem 1rem;
    overflow-y: auto;
    flex: 1;
  }
}

.info-modal {
  hr {
    border: none;
    height: 3px;
    background: var(--fnb-border);
    margin: 1rem 0;
  }

  .modal-top {
    text-align: center;
    background: var(--fnb-bg);
    border-bottom: 3px solid var(--fnb-border);
    padding: 1.5rem 0;
    margin: 0 -1.5rem;
  }

  .modal-avatar {
    display: inline-block;
    position: relative;

    img {
      width: 80px;
      height: 80px;
      @include fnb-border;
      @include fnb-shadow-sm;
    }

    .premium-icon {
      position: absolute;
      bottom: -4px;
      right: -4px;
      color: var(--fnb-highlight);
      background: var(--fnb-surface);
      border: 2px solid var(--fnb-border);
      width: 1.4rem;
      height: 1.4rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      cursor: help;
    }
  }

  .modal-name {
    font-family: var(--fnb-font-display);
    font-weight: 900;
    font-size: 1rem;
    margin-top: 0.5rem;
  }

  .user-workspace {
    :deep(img) {
      width: 100%;
    }
  }
}
</style>
