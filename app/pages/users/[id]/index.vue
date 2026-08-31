<template lang="pug">
#user-view
  ArtworkMarkerControl(v-if='showArtworkMarkerControl')

  //- Loading
  section.loading(v-if='loadingUser')
    .cover-banner.no-cover
    .body-inner.user-layout(
      :class='{ "artwork-grid-layout": isArtworkGridView }',
      :style='isArtworkGridView ? artworkLayoutContainerStyle : undefined'
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
        ArtworkList(:list='[]', :loading='20' controlled)

  //- Error
  section.error(v-else-if='error')
    ErrorPage(:description='error' title='出大问题')

  //- :)
  section.user(v-else-if='user')
    .blocked-banner(v-if='authorBlocked')
      span 该作者已被你屏蔽，其作品不会出现在任何列表中。
      button(@click='handleUnblock' type='button') 解除屏蔽
    .cover-banner(:class='{ "no-cover": !user?.background }')
      .cover-image(
        :style='{ backgroundImage: `url("${user.background.url}")` }'
        v-if='user?.background?.url'
      )
      span.cover-placeholder(v-else) 用户未设置封面~

    .body-inner.user-layout(
      :class='{ "artwork-grid-layout": isArtworkGridView }',
      :style='isArtworkGridView ? artworkLayoutContainerStyle : undefined'
    )
      //- Left: User info card
      .user-sidebar(v-if='!isArtworkGridView')
        .user-sidebar-card
          .avatar-area
            a.plain.pointer(@click='showUserMore = true')
              img.user-avatar(:alt='user.name', :src='user.imageBig')
          h2.username {{ user.name }}
          .user-id(v-if='user.premium')
            span.user-premium Premium
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
              button.sidebar-follow-button(
                :class='{ followed: user.isFollowed }',
                :disabled='loadingUserFollow'
                @click='handleUserFollow'
                type='button'
              )
                IFasCheck(v-if='user.isFollowed')
                IFasPlus(v-else)
                | {{ user.isFollowed ? '已关注' : '关注' }}
              button.sidebar-feature-button(
                :aria-label='featuredAuthor ? `将 ${user.name} 移出精选作者` : `将 ${user.name} 设为精选作者`',
                :class='{ featured: featuredAuthor }',
                :disabled='loadingFeaturedAuthor'
                @click='handleToggleFeaturedAuthor'
                type='button'
              )
                IFasStar
                | {{ featuredAuthor ? '已精选' : '精选' }}
              button.sidebar-block-button(
                :class='{ blocked: authorBlocked }'
                @click='handleToggleBlock'
                type='button'
              ) {{ authorBlocked ? '解除屏蔽' : '屏蔽此作者' }}
            template(v-else)
              span.self-user-badge 这是你自己

      //- Right: Artworks
      .user-content
        UserArtworkOverview(
          :feature-loading='loadingFeaturedAuthor',
          :featured='featuredAuthor',
          :follow-loading='loadingUserFollow',
          :is-self='isSelfUserPage',
          :selected-tag='selectedArtworkTag',
          :show-tags='tab === UserTabs.illusts',
          :tags='userArtworkTags',
          :tags-loading='loadingUserArtworkTags',
          :user='user'
          @follow='handleUserFollow'
          @show-profile='showUserMore = true'
          @toggle-featured='handleToggleFeaturedAuthor'
          @update:selected-tag='selectedArtworkTag = $event'
          v-if='isAuthorWorksTab'
        )
        details.author-featured(
          :key='`featured-${user.userId}`'
          v-if='showFeaturedWorks'
        )
          summary.author-featured-heading
            .author-featured-title
              span.eyebrow FEATURED
              h2 精选
            .author-featured-meta
              span.author-featured-count {{ featuredWorkCount }} 件
              span.author-featured-toggle(aria-hidden='true')
          .author-featured-body
            .author-featured-group(v-if='featuredArtworks.length')
              h3 插画 / 漫画作品
              ArtworkList.author-featured-artworks(
                :list='featuredArtworks'
                controlled
                filter-disabled
              )
            .author-featured-group(v-if='featuredNovels.length')
              h3 小说作品
              NovelList.author-featured-novels(
                :list='featuredNovels'
                filter-disabled
              )
        FnbTabs(:tabs='tabsList' v-model='tab')
          template(#panel-illusts)
            ArtworkListByUserTag(
              :tag='selectedArtworkTag',
              :user-id='user.userId'
              controlled
              v-if='selectedArtworkTag'
            )
            .fnb-empty(v-else-if='user.illusts && !user.illusts.length') 用户没有插画作品 (｡•́︿•̀｡)
            .user-illust(v-else)
              ArtworkListByUser(
                :user-id='user.userId'
                controlled
                work-category='illust'
              )
          template(#panel-mangas)
            .fnb-empty(v-if='!user.manga?.length') 用户没有漫画作品 (*/ω＼*)
            .user-manga(v-else)
              ArtworkListByUser(
                :user-id='user.userId'
                controlled
                work-category='manga'
              )
          template(#panel-novels)
            .fnb-empty(v-if='!user.novels?.length') 用户没有小说作品 (｡•́︿•̀｡)
            .user-novels(v-else)
              NovelList(:list='user.novels' filter-disabled)
          template(#panel-public_bookmarks)
            BookmarkTagFilter(
              :items='bookmarkTags.public',
              :loading='loadingBookmarkTags'
              v-if='isSelfUserPage'
              v-model='selectedPublicBookmarkTag'
            )
            BookmarkArtworkTagPanel(
              :author-count='publicBookmarkAuthorGroups.length',
              :author-sort='publicBookmarkAuthorSort',
              :view-mode='publicBookmarkViewMode'
              @expand='publicArtworkTags.scan()'
              @refresh='publicArtworkTags.scan(true)'
              @update:author-sort='updatePublicBookmarkAuthorSort'
              @update:selected-tags='publicArtworkTags.setSelectedTags($event)'
              @update:view-mode='updatePublicBookmarkViewMode'
              v-bind='publicArtworkTagProps'
              v-if='publicBookmarks.length || publicArtworkTags.scanned.value'
            )
            BookmarkBatchToolbar(
              :active='bookmarkBatchMode',
              :all-selected='allPageBookmarksSelected',
              :available-tags='batchAvailableBookmarkTags',
              :loading='bookmarkBatchLoading',
              :selected-count='selectedBookmarks.length',
              :total-count='publicBookmarkVisibleWorks.length'
              @add-tags='handleBatchAddTags'
              @cancel='cancelBookmarkBatch'
              @set-visibility='handleBatchVisibility'
              @start='startBookmarkBatch'
              @toggle-all='toggleAllPageBookmarks'
              v-if='isSelfUserPage && publicBookmarkDisplayCount'
            )
            ArtworkList(
              :list='[]',
              :loading='8',
              :marker-disabled='isSelfUserPage'
              controlled
              v-if='publicBookmarkDisplayLoading'
            )
            .fnb-empty(v-else-if='!publicBookmarkDisplayCount') {{ emptyPublicBookmarksText }}
            .user-bookmarks.bookmark-grid(
              ref='publicBookmarkGridRef'
              v-else-if='publicBookmarkViewMode === "artwork-tags"'
            )
              ArtworkList(
                :list='displayPublicBookmarks',
                :marker-disabled='isSelfUserPage',
                :selectable='bookmarkBatchMode',
                :selected-ids='selectedBookmarkIds'
                @toggle-selection='toggleBookmarkSelection'
                controlled
                filter-disabled
              )
              FnbPagination.bookmark-pagination(
                :item-count='displayPublicBookmarkTotal',
                :page='displayPublicBookmarkPage',
                :page-size='BOOKMARK_PAGE_SIZE'
                @update:page='changePublicBookmarkPage'
              )
            .user-bookmarks.bookmark-author-groups(
              ref='publicBookmarkGridRef'
              v-else
            )
              section.bookmark-author-group(
                :key='group.authorId || group.authorName'
                v-for='group in displayPublicBookmarkAuthorGroups'
              )
                header.bookmark-author-divider
                  span.bookmark-author-anchor(aria-hidden='true')
                  RouterLink.bookmark-author-avatar-link(
                    :to='`/users/${group.authorId}`'
                    v-if='group.authorId && group.profileImageUrl'
                  )
                    img.bookmark-author-avatar(
                      :alt='group.authorName',
                      :src='group.profileImageUrl'
                    )
                  span.bookmark-author-avatar.bookmark-author-avatar--empty(
                    v-else
                  )
                    IFasUser(aria-hidden='true')
                  .bookmark-author-identity
                    RouterLink.bookmark-author-name(
                      :to='`/users/${group.authorId}`'
                      v-if='group.authorId'
                    ) {{ group.authorName }}
                    strong.bookmark-author-name(v-else) {{ group.authorName }}
                    span(v-if='group.authorId') ID {{ group.authorId }}
                  span.bookmark-author-line(aria-hidden='true')
                  span.bookmark-author-count {{ group.works.length }} 件
                ArtworkList(
                  :list='group.works',
                  :marker-disabled='isSelfUserPage',
                  :selectable='bookmarkBatchMode',
                  :selected-ids='selectedBookmarkIds'
                  @toggle-selection='toggleBookmarkSelection'
                  controlled
                  filter-disabled
                )
              FnbPagination.bookmark-pagination(
                :item-count='publicBookmarkAuthorGroups.length',
                :page='publicBookmarkAuthorPage',
                :page-size='BOOKMARK_AUTHOR_GROUP_PAGE_SIZE'
                @update:page='changePublicBookmarkAuthorPage'
                v-if='publicBookmarkAuthorGroups.length > BOOKMARK_AUTHOR_GROUP_PAGE_SIZE'
              )
          template(#panel-hidden_bookmarks v-if='isSelfUserPage')
            BookmarkTagFilter(
              :items='bookmarkTags.private',
              :loading='loadingBookmarkTags'
              v-model='selectedHiddenBookmarkTag'
            )
            BookmarkArtworkTagPanel(
              :author-count='hiddenBookmarkAuthorGroups.length',
              :author-sort='hiddenBookmarkAuthorSort',
              :view-mode='hiddenBookmarkViewMode'
              @expand='hiddenArtworkTags.scan()'
              @refresh='hiddenArtworkTags.scan(true)'
              @update:author-sort='updateHiddenBookmarkAuthorSort'
              @update:selected-tags='hiddenArtworkTags.setSelectedTags($event)'
              @update:view-mode='updateHiddenBookmarkViewMode'
              v-bind='hiddenArtworkTagProps'
              v-if='hiddenBookmarks.length || hiddenArtworkTags.scanned.value'
            )
            BookmarkBatchToolbar(
              :active='bookmarkBatchMode',
              :all-selected='allPageBookmarksSelected',
              :available-tags='batchAvailableBookmarkTags',
              :loading='bookmarkBatchLoading',
              :selected-count='selectedBookmarks.length',
              :total-count='hiddenBookmarkVisibleWorks.length'
              @add-tags='handleBatchAddTags'
              @cancel='cancelBookmarkBatch'
              @set-visibility='handleBatchVisibility'
              @start='startBookmarkBatch'
              @toggle-all='toggleAllPageBookmarks'
              v-if='hiddenBookmarkDisplayCount'
            )
            ArtworkList(
              :list='[]',
              :loading='8'
              controlled
              marker-disabled
              v-if='hiddenBookmarkDisplayLoading'
            )
            .fnb-empty(v-else-if='!hiddenBookmarkDisplayCount') {{ emptyHiddenBookmarksText }}
            .user-bookmarks.bookmark-grid(
              ref='hiddenBookmarkGridRef'
              v-else-if='hiddenBookmarkViewMode === "artwork-tags"'
            )
              ArtworkList(
                :list='displayHiddenBookmarks',
                :selectable='bookmarkBatchMode',
                :selected-ids='selectedBookmarkIds'
                @toggle-selection='toggleBookmarkSelection'
                controlled
                filter-disabled
                marker-disabled
              )
              FnbPagination.bookmark-pagination(
                :item-count='displayHiddenBookmarkTotal',
                :page='displayHiddenBookmarkPage',
                :page-size='BOOKMARK_PAGE_SIZE'
                @update:page='changeHiddenBookmarkPage'
              )
            .user-bookmarks.bookmark-author-groups(
              ref='hiddenBookmarkGridRef'
              v-else
            )
              section.bookmark-author-group(
                :key='group.authorId || group.authorName'
                v-for='group in displayHiddenBookmarkAuthorGroups'
              )
                header.bookmark-author-divider
                  span.bookmark-author-anchor(aria-hidden='true')
                  RouterLink.bookmark-author-avatar-link(
                    :to='`/users/${group.authorId}`'
                    v-if='group.authorId && group.profileImageUrl'
                  )
                    img.bookmark-author-avatar(
                      :alt='group.authorName',
                      :src='group.profileImageUrl'
                    )
                  span.bookmark-author-avatar.bookmark-author-avatar--empty(
                    v-else
                  )
                    IFasUser(aria-hidden='true')
                  .bookmark-author-identity
                    RouterLink.bookmark-author-name(
                      :to='`/users/${group.authorId}`'
                      v-if='group.authorId'
                    ) {{ group.authorName }}
                    strong.bookmark-author-name(v-else) {{ group.authorName }}
                    span(v-if='group.authorId') ID {{ group.authorId }}
                  span.bookmark-author-line(aria-hidden='true')
                  span.bookmark-author-count {{ group.works.length }} 件
                ArtworkList(
                  :list='group.works',
                  :selectable='bookmarkBatchMode',
                  :selected-ids='selectedBookmarkIds'
                  @toggle-selection='toggleBookmarkSelection'
                  controlled
                  filter-disabled
                  marker-disabled
                )
              FnbPagination.bookmark-pagination(
                :item-count='hiddenBookmarkAuthorGroups.length',
                :page='hiddenBookmarkAuthorPage',
                :page-size='BOOKMARK_AUTHOR_GROUP_PAGE_SIZE'
                @update:page='changeHiddenBookmarkAuthorPage'
                v-if='hiddenBookmarkAuthorGroups.length > BOOKMARK_AUTHOR_GROUP_PAGE_SIZE'
              )

    //- Related authors (silently hidden on failure / empty result)
    .body-inner.related-authors(v-if='relatedAuthors.length')
      h2.related-authors-title 相关作者
      .related-authors-list
        FollowUserCard(
          :key='item.userId',
          :user='item'
          v-for='item in relatedAuthors'
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
                  style='overflow: auto; background: var(--pf-bg); padding: 4px'
                ) {{ JSON.stringify(user, null, 2) }}
</template>

<script lang="ts" setup>
definePageMeta({
  name: 'users',
  alias: ['/u/:id'],
})
import ArtworkList from '~/components/Artwork/ArtworkList.vue'
import ArtworkListByUser from '~/components/Artwork/ArtworkListByUser.vue'
import ArtworkListByUserTag from '~/components/Artwork/ArtworkListByUserTag.vue'
import ArtworkMarkerControl from '~/components/Artwork/ArtworkMarkerControl.vue'
import BookmarkArtworkTagPanel from '~/components/Bookmark/BookmarkArtworkTagPanel.vue'
import BookmarkBatchToolbar from '~/components/Bookmark/BookmarkBatchToolbar.vue'
import BookmarkTagFilter from '~/components/Bookmark/BookmarkTagFilter.vue'
import ErrorPage from '~/components/ErrorPage.vue'
import NovelList from '~/components/Novel/NovelList.vue'
import UserArtworkOverview from '~/components/User/UserArtworkOverview.vue'
import IFasBirthdayCake from '~icons/fa-solid/birthday-cake'
import IFasCheck from '~icons/fa-solid/check'
import IFasHome from '~icons/fa-solid/home'
import IFasMapMarkerAlt from '~icons/fa-solid/map-marker-alt'
import IFasParking from '~icons/fa-solid/parking'
import IFasPlus from '~icons/fa-solid/plus'
import IFasStar from '~icons/fa-solid/star'
import IFasUser from '~icons/fa-solid/user'
import IFasVenusMars from '~icons/fa-solid/venus-mars'
import { useUserStore } from '~/stores/session'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import { useUserArtworksStore } from '~/stores/user-artworks'
import { useArtworkStore } from '~/stores/artwork'
import { useUserProfileStore } from '~/stores/user-profile'
import type {
  ArtworkInfo,
  User,
  UserArtworkTag,
  UserFeaturedArtwork,
  UserFeaturedNovel,
  UserListItem,
} from '~/types'
import {
  BOOKMARK_PAGE_SIZE,
  bookmarkBelongsToVisibility,
  bookmarkPageOffset,
  getActiveBookmarkRefreshPage,
  isArtworkGridTab,
  isBookmarkTab,
} from '~/utils/refineModernArtwork'
import { setTitle } from '~/utils/setTitle'
import { toFeaturedAuthorSnapshot } from '~/utils/featuredAuthors'
import {
  bookmarkListCacheKey,
  mergeBookmarkTags,
  prioritizeBookmarkTags,
  type BookmarkTagGroups,
} from '~/utils/bookmarkTags'
import { paginateWorks } from '~/utils/bookmarkArtworkTags'
import {
  groupBookmarkWorksByAuthor,
  paginateBookmarkAuthorGroups,
  type BookmarkAuthorSort,
  type BookmarkCollectionViewMode,
} from '~/utils/bookmarkAuthorGroups'
import {
  bookmarkViewStorageKey,
  createBookmarkViewState,
  parseBookmarkViewState,
  serializeBookmarkViewState,
  type BookmarkViewState,
} from '~/utils/bookmarkViewNavigation'
import type { BookmarkArtworkTagIndex } from '~/composables/useBookmarkArtworkTags'
import { effect } from 'vue'

const loadingUser = ref(true)
const user = ref<User>()
const userStore = useUserStore()
const localPersistenceStore = useLocalPersistenceStore()
const userArtworksStore = useUserArtworksStore()
const artworkStore = useArtworkStore()
const userProfileStore = useUserProfileStore()
const toast = useToast()
const dialog = useDialog()
const { containerStyle: artworkLayoutContainerStyle } =
  useArtworkLayoutSettings()
const isSelfUserPage = computed(() => user.value?.userId === userStore.userId)
const featuredAuthor = computed(() =>
  localPersistenceStore.isFeaturedAuthor(user.value?.userId)
)

const { isBlocked, blockAuthor, unblockAuthor, filterBlocked } =
  useAuthorBlocklist()
const authorBlocked = computed(() => isBlocked(user.value?.userId))

async function handleUnblock(): Promise<void> {
  if (!user.value) return
  try {
    await unblockAuthor(user.value.userId)
    toast.success(`已解除屏蔽 ${user.value.name}`)
  } catch {
    toast.error('操作失败，请重试')
  }
}

async function handleToggleBlock(): Promise<void> {
  if (!user.value) return
  if (authorBlocked.value) return handleUnblock()
  try {
    const confirmed = await dialog.open({
      title: '屏蔽作者',
      content: `屏蔽后，${user.value.name} 的作品将不再出现在任何列表中。可在侧边栏“屏蔽作者管理”中解除。`,
      positiveText: '屏蔽',
      negativeText: '取消',
    })
    if (!confirmed) return
    await blockAuthor({ id: user.value.userId, name: user.value.name })
    toast.success(`已屏蔽 ${user.value.name}`)
  } catch {
    toast.error('操作失败，请重试')
  }
}

const publicBookmarks = ref<ArtworkInfo[]>([])
const loadingPublicBookmarks = ref(false)
const totalPublicBookmarks = ref(0)
const publicBookmarkPage = ref(1)
const publicBookmarkCache = new Map<string, ArtworkInfo[]>()
const selectedPublicBookmarkTag = ref('')
const userArtworkTags = ref<UserArtworkTag[]>([])
const loadingUserArtworkTags = ref(false)
const selectedArtworkTag = ref('')
let artworkTagsRequestId = 0

const hiddenBookmarks = ref<ArtworkInfo[]>([])
const loadingHiddenBookmarks = ref(false)
const totalHiddenBookmarks = ref(0)
const hiddenBookmarkPage = ref(1)
const hiddenBookmarkCache = new Map<string, ArtworkInfo[]>()
const selectedHiddenBookmarkTag = ref('')
const bookmarkTags = ref<BookmarkTagGroups>({ public: [], private: [] })
const batchAvailableBookmarkTags = computed(() => {
  const tagCounts = new Map<string, number>()
  for (const tag of [
    ...bookmarkTags.value.public,
    ...bookmarkTags.value.private,
  ]) {
    tagCounts.set(tag.name, (tagCounts.get(tag.name) ?? 0) + tag.count)
  }
  return prioritizeBookmarkTags(
    [...tagCounts].map(([name, count]) => ({ name, count })),
    []
  )
})
const loadingBookmarkTags = ref(false)
const bookmarkBatchMode = ref(false)
const bookmarkBatchLoading = ref(false)
const selectedBookmarkIds = ref<string[]>([])
let publicBookmarkRequestId = 0
let hiddenBookmarkRequestId = 0
const publicBookmarkGridRef = ref<HTMLElement | null>(null)
const hiddenBookmarkGridRef = ref<HTMLElement | null>(null)
let initializingUserView = false

// Artwork-tag statistics: built from the bookmark pages themselves, scoped to
// the currently selected bookmark tag, and paged locally once a filter is on.
function fetchBookmarkPageForScan(hidden: boolean, offset: number) {
  const curUser = user.value
  if (!curUser) return Promise.resolve({ works: [], total: 0 })
  return userProfileStore.fetchBookmarks(curUser.userId, {
    offset,
    hidden,
    tag: hidden
      ? selectedHiddenBookmarkTag.value
      : selectedPublicBookmarkTag.value,
  })
}

const publicArtworkTags = useBookmarkArtworkTags((offset) =>
  fetchBookmarkPageForScan(false, offset)
)
const hiddenArtworkTags = useBookmarkArtworkTags((offset) =>
  fetchBookmarkPageForScan(true, offset)
)
const publicArtworkTagPage = ref(1)
const hiddenArtworkTagPage = ref(1)
const BOOKMARK_AUTHOR_GROUP_PAGE_SIZE = 6
const publicBookmarkViewMode = ref<BookmarkCollectionViewMode>('artwork-tags')
const hiddenBookmarkViewMode = ref<BookmarkCollectionViewMode>('artwork-tags')
const publicBookmarkAuthorSort = ref<BookmarkAuthorSort>('count')
const hiddenBookmarkAuthorSort = ref<BookmarkAuthorSort>('count')
const publicBookmarkAuthorPage = ref(1)
const hiddenBookmarkAuthorPage = ref(1)

function artworkTagPanelProps(index: BookmarkArtworkTagIndex) {
  return computed(() => ({
    stats: index.stats.value,
    selectedTags: index.selectedTags.value,
    matchedCount: index.filteredWorks.value.length,
    scannedCount: index.works.value.length,
    totalCount: index.total.value,
    scanning: index.scanning.value,
    scanned: index.scanned.value,
    truncated: index.truncated.value,
    error: index.error.value,
  }))
}

const publicArtworkTagProps = artworkTagPanelProps(publicArtworkTags)
const hiddenArtworkTagProps = artworkTagPanelProps(hiddenArtworkTags)

const displayPublicBookmarks = computed(() =>
  publicArtworkTags.active.value
    ? paginateWorks(
        publicArtworkTags.filteredWorks.value,
        publicArtworkTagPage.value
      )
    : publicBookmarks.value
)
const displayPublicBookmarkTotal = computed(() =>
  publicArtworkTags.active.value
    ? publicArtworkTags.filteredWorks.value.length
    : totalPublicBookmarks.value
)
const displayPublicBookmarkPage = computed(() =>
  publicArtworkTags.active.value
    ? publicArtworkTagPage.value
    : publicBookmarkPage.value
)
const displayHiddenBookmarks = computed(() =>
  hiddenArtworkTags.active.value
    ? paginateWorks(
        hiddenArtworkTags.filteredWorks.value,
        hiddenArtworkTagPage.value
      )
    : hiddenBookmarks.value
)
const displayHiddenBookmarkTotal = computed(() =>
  hiddenArtworkTags.active.value
    ? hiddenArtworkTags.filteredWorks.value.length
    : totalHiddenBookmarks.value
)
const displayHiddenBookmarkPage = computed(() =>
  hiddenArtworkTags.active.value
    ? hiddenArtworkTagPage.value
    : hiddenBookmarkPage.value
)

const publicBookmarkAuthorGroups = computed(() =>
  groupBookmarkWorksByAuthor(
    publicArtworkTags.filteredWorks.value,
    publicBookmarkAuthorSort.value
  )
)
const hiddenBookmarkAuthorGroups = computed(() =>
  groupBookmarkWorksByAuthor(
    hiddenArtworkTags.filteredWorks.value,
    hiddenBookmarkAuthorSort.value
  )
)
const displayPublicBookmarkAuthorGroups = computed(() =>
  paginateBookmarkAuthorGroups(
    publicBookmarkAuthorGroups.value,
    publicBookmarkAuthorPage.value,
    BOOKMARK_AUTHOR_GROUP_PAGE_SIZE
  )
)
const displayHiddenBookmarkAuthorGroups = computed(() =>
  paginateBookmarkAuthorGroups(
    hiddenBookmarkAuthorGroups.value,
    hiddenBookmarkAuthorPage.value,
    BOOKMARK_AUTHOR_GROUP_PAGE_SIZE
  )
)
const publicBookmarkVisibleWorks = computed(() =>
  publicBookmarkViewMode.value === 'authors'
    ? displayPublicBookmarkAuthorGroups.value.flatMap((group) => group.works)
    : displayPublicBookmarks.value
)
const hiddenBookmarkVisibleWorks = computed(() =>
  hiddenBookmarkViewMode.value === 'authors'
    ? displayHiddenBookmarkAuthorGroups.value.flatMap((group) => group.works)
    : displayHiddenBookmarks.value
)
const publicBookmarkDisplayLoading = computed(
  () =>
    (!publicBookmarks.value.length && loadingPublicBookmarks.value) ||
    (publicBookmarkViewMode.value === 'authors' &&
      publicArtworkTags.scanning.value)
)
const hiddenBookmarkDisplayLoading = computed(
  () =>
    (!hiddenBookmarks.value.length && loadingHiddenBookmarks.value) ||
    (hiddenBookmarkViewMode.value === 'authors' &&
      hiddenArtworkTags.scanning.value)
)
const publicBookmarkDisplayCount = computed(() =>
  publicBookmarkViewMode.value === 'authors'
    ? publicBookmarkAuthorGroups.value.length
    : displayPublicBookmarks.value.length
)
const hiddenBookmarkDisplayCount = computed(() =>
  hiddenBookmarkViewMode.value === 'authors'
    ? hiddenBookmarkAuthorGroups.value.length
    : displayHiddenBookmarks.value.length
)

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
const isAuthorWorksTab = computed(
  () => tab.value === UserTabs.illusts || tab.value === UserTabs.mangas
)
const featuredArtworks = computed(() =>
  (user.value?.featuredWorks ?? []).filter(
    (work): work is UserFeaturedArtwork => work.type === 'illust'
  )
)
const featuredNovels = computed(() =>
  (user.value?.featuredWorks ?? []).filter(
    (work): work is UserFeaturedNovel => work.type === 'novel'
  )
)
const featuredWorkCount = computed(() => user.value?.featuredWorks?.length ?? 0)
const showFeaturedWorks = computed(
  () =>
    tab.value === UserTabs.illusts &&
    !selectedArtworkTag.value &&
    featuredWorkCount.value > 0
)

const emptyPublicBookmarksText = computed(() =>
  publicBookmarkViewMode.value === 'authors'
    ? publicArtworkTags.error.value ||
      (publicArtworkTags.active.value
        ? '没有作者符合所选作品标签'
        : '没有可按作者聚合的公开收藏')
    : publicArtworkTags.active.value
      ? '没有同时包含所选作品标签的公开收藏'
      : selectedPublicBookmarkTag.value
        ? '这个标签下还没有公开收藏'
        : isSelfUserPage.value
          ? '收藏夹是空的 Σ(⊙▽⊙"a'
          : user.value?.name + '没有公开的收藏 (❁´◡`❁)'
)
const emptyHiddenBookmarksText = computed(() =>
  hiddenBookmarkViewMode.value === 'authors'
    ? hiddenArtworkTags.error.value ||
      (hiddenArtworkTags.active.value
        ? '没有作者符合所选作品标签'
        : '没有可按作者聚合的私密收藏')
    : hiddenArtworkTags.active.value
      ? '没有同时包含所选作品标签的私密收藏'
      : selectedHiddenBookmarkTag.value
        ? '这个标签下还没有私密收藏'
        : '没有隐藏的小秘密 இ௰இ'
)
const activeBookmarkList = computed(() =>
  tab.value === UserTabs.hidden_bookmarks
    ? hiddenBookmarkVisibleWorks.value
    : publicBookmarkVisibleWorks.value
)
const selectedBookmarks = computed(() => {
  const selected = new Set(selectedBookmarkIds.value)
  return activeBookmarkList.value.filter(
    (item) => item.bookmarkData && selected.has(item.id)
  )
})
const allPageBookmarksSelected = computed(
  () =>
    !!activeBookmarkList.value.length &&
    activeBookmarkList.value.every((item) =>
      selectedBookmarkIds.value.includes(item.id)
    )
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

const rawRelatedAuthors = ref<UserListItem[]>([])
let relatedAuthorsRequestId = 0

const relatedAuthors = computed(() => filterBlocked(rawRelatedAuthors.value))

async function loadRelatedAuthors(id: string): Promise<void> {
  const requestId = ++relatedAuthorsRequestId
  rawRelatedAuthors.value = []
  try {
    const pixivClient = usePixivClient()
    const users = await pixivClient.getUserRecommends(id, {
      userNum: 12,
      workNum: 3,
    })
    if (requestId !== relatedAuthorsRequestId) return
    rawRelatedAuthors.value = users.filter((item) => item.userId !== id)
  } catch {
    // The section hides itself when the endpoint fails or returns nothing.
  }
}

function consumeBookmarkViewState(
  userId: string,
  requestedTab?: UserTabs
): BookmarkViewState | null {
  if (!import.meta.client || !requestedTab) return null
  if (!isBookmarkTab(requestedTab)) return null

  const key = bookmarkViewStorageKey(userId, requestedTab)
  try {
    const state = parseBookmarkViewState(
      sessionStorage.getItem(key),
      userId,
      requestedTab
    )
    sessionStorage.removeItem(key)
    return state
  } catch {
    return null
  }
}

function persistBookmarkViewState(): void {
  if (!import.meta.client || !user.value || !isBookmarkTab(tab.value || '')) {
    return
  }

  const hidden = tab.value === UserTabs.hidden_bookmarks
  const state = createBookmarkViewState({
    userId: user.value.userId,
    tab: hidden ? 'hidden_bookmarks' : 'public_bookmarks',
    page: getActiveBookmarkRefreshPage(
      publicBookmarkPage.value,
      hiddenBookmarkPage.value,
      hidden
    ),
    tag: hidden
      ? selectedHiddenBookmarkTag.value
      : selectedPublicBookmarkTag.value,
    scrollTop: window.scrollY,
    savedAt: Date.now(),
  })

  try {
    sessionStorage.setItem(
      bookmarkViewStorageKey(state.userId, state.tab),
      serializeBookmarkViewState(state)
    )
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
}

async function restoreBookmarkViewScroll(
  state: BookmarkViewState | null
): Promise<void> {
  if (!import.meta.client || !state) return
  await nextTick()
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (user.value?.userId !== state.userId || tab.value !== state.tab) {
        return
      }
      window.scrollTo({ top: state.scrollTop, behavior: 'auto' })
    })
  })
}

async function init(id: string | number, initTab?: UserTabs): Promise<void> {
  const userId = String(id)
  const requestedTab = initTab || UserTabs.illusts
  const restoredBookmarkView = consumeBookmarkViewState(userId, initTab)
  initializingUserView = true

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
  selectedPublicBookmarkTag.value = ''
  selectedHiddenBookmarkTag.value = ''
  bookmarkBatchMode.value = false
  bookmarkBatchLoading.value = false
  selectedBookmarkIds.value = []
  bookmarkTags.value = { public: [], private: [] }
  publicArtworkTags.reset()
  hiddenArtworkTags.reset()
  publicArtworkTagPage.value = 1
  hiddenArtworkTagPage.value = 1
  publicBookmarkViewMode.value = 'artwork-tags'
  hiddenBookmarkViewMode.value = 'artwork-tags'
  publicBookmarkAuthorSort.value = 'count'
  hiddenBookmarkAuthorSort.value = 'count'
  publicBookmarkAuthorPage.value = 1
  hiddenBookmarkAuthorPage.value = 1
  publicBookmarkRequestId += 1
  hiddenBookmarkRequestId += 1
  userArtworkTags.value = []
  selectedArtworkTag.value = ''
  artworkTagsRequestId += 1
  publicBookmarkCache.clear()
  hiddenBookmarkCache.clear()

  try {
    loadingUser.value = true
    user.value = await userProfileStore.fetchUser(userId)
    void localPersistenceStore.recordAuthorVisit(id).catch(() => {})
    void localPersistenceStore.ensureFeaturedAuthors([userId]).catch(() => {})
    if (requestedTab === UserTabs.public_bookmarks) {
      selectedPublicBookmarkTag.value = restoredBookmarkView?.tag ?? ''
      publicBookmarkPage.value = restoredBookmarkView?.page ?? 1
      await getBookmarks(false, publicBookmarkPage.value)
    } else if (requestedTab === UserTabs.hidden_bookmarks) {
      selectedHiddenBookmarkTag.value = restoredBookmarkView?.tag ?? ''
      hiddenBookmarkPage.value = restoredBookmarkView?.page ?? 1
      await getBookmarks(true, hiddenBookmarkPage.value)
    }
    tab.value = requestedTab
    void loadUserArtworkTags(userId)
    void loadRelatedAuthors(userId)
    if (isSelfUserPage.value) void loadBookmarkTags()
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = '未知错误'
    }
  } finally {
    initializingUserView = false
    loadingUser.value = false
    await restoreBookmarkViewScroll(restoredBookmarkView)
  }
}

async function loadBookmarkTags() {
  if (!isSelfUserPage.value || !userStore.userId) return
  loadingBookmarkTags.value = true
  try {
    bookmarkTags.value = await artworkStore.fetchBookmarkTags(userStore.userId)
  } catch (err) {
    console.warn('failed to fetch bookmark tags', err)
    bookmarkTags.value = { public: [], private: [] }
  } finally {
    loadingBookmarkTags.value = false
  }
}

async function loadUserArtworkTags(userId: string) {
  const requestId = ++artworkTagsRequestId
  loadingUserArtworkTags.value = true
  try {
    const tags = await userArtworksStore.fetchTags(userId)
    if (requestId === artworkTagsRequestId) userArtworkTags.value = tags
  } catch {
    if (requestId === artworkTagsRequestId) userArtworkTags.value = []
  } finally {
    if (requestId === artworkTagsRequestId) {
      loadingUserArtworkTags.value = false
    }
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

const loadingFeaturedAuthor = ref(false)
async function handleToggleFeaturedAuthor() {
  const target = user.value
  if (!target || isSelfUserPage.value || loadingFeaturedAuthor.value) return
  const removing = featuredAuthor.value
  loadingFeaturedAuthor.value = true
  try {
    if (removing) {
      await localPersistenceStore.unfeatureAuthor(target.userId)
    } else {
      await localPersistenceStore.featureAuthor(
        toFeaturedAuthorSnapshot(target)
      )
    }
    toast.success(removing ? '已移出精选作者' : '已加入精选作者')
  } catch {
    toast.error(
      removing ? '移出精选作者失败，请重试' : '设为精选作者失败，请重试'
    )
  } finally {
    loadingFeaturedAuthor.value = false
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
  const tag = hidden
    ? selectedHiddenBookmarkTag.value
    : selectedPublicBookmarkTag.value
  const cacheKey = bookmarkListCacheKey(tag, page)
  const requestId = hidden
    ? ++hiddenBookmarkRequestId
    : ++publicBookmarkRequestId

  const cached = cache.get(cacheKey)
  if (cached) {
    curList.value = cached
    curPage.value = page
    curLoading.value = false
    return
  }

  try {
    curLoading.value = true
    const data = await userProfileStore.fetchBookmarks(curUser.userId, {
      offset: bookmarkPageOffset(page),
      hidden,
      tag,
    })
    const isLatest = hidden
      ? requestId === hiddenBookmarkRequestId
      : requestId === publicBookmarkRequestId
    if (!isLatest) return
    curTotal.value = data.total
    cache.set(cacheKey, data.works)
    curList.value = data.works
    curPage.value = page
  } catch (err) {
    console.warn('failed to fetch bookmarks', err)
  } finally {
    const isLatest = hidden
      ? requestId === hiddenBookmarkRequestId
      : requestId === publicBookmarkRequestId
    if (isLatest) curLoading.value = false
  }
}

async function changePublicBookmarkPage(page: number): Promise<void> {
  selectedBookmarkIds.value = []
  publicBookmarkGridRef.value?.scrollIntoView({
    behavior: 'auto',
    block: 'start',
  })
  // With an artwork-tag filter on, the list is already in memory: page locally
  // instead of asking Pixiv for an offset that no longer matches the filter.
  if (publicArtworkTags.active.value) {
    publicArtworkTagPage.value = Math.max(1, page)
  } else {
    await getBookmarks(false, page)
  }
}

async function changeHiddenBookmarkPage(page: number): Promise<void> {
  selectedBookmarkIds.value = []
  hiddenBookmarkGridRef.value?.scrollIntoView({
    behavior: 'auto',
    block: 'start',
  })
  if (hiddenArtworkTags.active.value) {
    hiddenArtworkTagPage.value = Math.max(1, page)
  } else {
    await getBookmarks(true, page)
  }
}

function updatePublicBookmarkViewMode(mode: BookmarkCollectionViewMode) {
  publicBookmarkViewMode.value = mode
  publicBookmarkAuthorPage.value = 1
  selectedBookmarkIds.value = []
  if (mode === 'authors') void publicArtworkTags.scan()
}

function updateHiddenBookmarkViewMode(mode: BookmarkCollectionViewMode) {
  hiddenBookmarkViewMode.value = mode
  hiddenBookmarkAuthorPage.value = 1
  selectedBookmarkIds.value = []
  if (mode === 'authors') void hiddenArtworkTags.scan()
}

function updatePublicBookmarkAuthorSort(sort: BookmarkAuthorSort) {
  publicBookmarkAuthorSort.value = sort
  publicBookmarkAuthorPage.value = 1
  selectedBookmarkIds.value = []
}

function updateHiddenBookmarkAuthorSort(sort: BookmarkAuthorSort) {
  hiddenBookmarkAuthorSort.value = sort
  hiddenBookmarkAuthorPage.value = 1
  selectedBookmarkIds.value = []
}

function changePublicBookmarkAuthorPage(page: number) {
  publicBookmarkAuthorPage.value = Math.max(1, page)
  selectedBookmarkIds.value = []
  publicBookmarkGridRef.value?.scrollIntoView({
    behavior: 'auto',
    block: 'start',
  })
}

function changeHiddenBookmarkAuthorPage(page: number) {
  hiddenBookmarkAuthorPage.value = Math.max(1, page)
  selectedBookmarkIds.value = []
  hiddenBookmarkGridRef.value?.scrollIntoView({
    behavior: 'auto',
    block: 'start',
  })
}

watch(tab, (newTab, oldTab) => {
  if (!newTab) return
  if (oldTab && oldTab !== newTab) {
    selectedArtworkTag.value = ''
    cancelBookmarkBatch()
  }

  const isPublicBookmarkEmpty = !publicBookmarks.value.length
  const isHiddenBookmarkEmpty = !hiddenBookmarks.value.length

  const url = new URL(location.href)
  url.searchParams.set('tab', newTab)
  history.replaceState(history.state, '', '' + url)
  if (initializingUserView) return

  if (newTab === UserTabs.public_bookmarks && isPublicBookmarkEmpty) {
    getBookmarks(false, publicBookmarkPage.value)
  }
  if (newTab === UserTabs.hidden_bookmarks && isHiddenBookmarkEmpty) {
    getBookmarks(true, hiddenBookmarkPage.value)
  }
})

watch(selectedPublicBookmarkTag, () => {
  selectedBookmarkIds.value = []
  publicBookmarkPage.value = 1
  // The index only covers one bookmark tag at a time.
  publicArtworkTags.reset()
  if (tab.value === UserTabs.public_bookmarks) void getBookmarks(false, 1)
  if (publicBookmarkViewMode.value === 'authors') {
    void publicArtworkTags.scan()
  }
})

watch(selectedHiddenBookmarkTag, () => {
  selectedBookmarkIds.value = []
  hiddenBookmarkPage.value = 1
  hiddenArtworkTags.reset()
  if (tab.value === UserTabs.hidden_bookmarks) void getBookmarks(true, 1)
  if (hiddenBookmarkViewMode.value === 'authors') {
    void hiddenArtworkTags.scan()
  }
})

watch(publicArtworkTags.selectedTags, () => {
  selectedBookmarkIds.value = []
  publicArtworkTagPage.value = 1
  publicBookmarkAuthorPage.value = 1
})

watch(hiddenArtworkTags.selectedTags, () => {
  selectedBookmarkIds.value = []
  hiddenArtworkTagPage.value = 1
  hiddenBookmarkAuthorPage.value = 1
})

function startBookmarkBatch() {
  bookmarkBatchMode.value = true
  selectedBookmarkIds.value = []
}

function cancelBookmarkBatch() {
  bookmarkBatchMode.value = false
  selectedBookmarkIds.value = []
}

function toggleBookmarkSelection(item: ArtworkInfo) {
  const selected = new Set(selectedBookmarkIds.value)
  if (selected.has(item.id)) selected.delete(item.id)
  else selected.add(item.id)
  selectedBookmarkIds.value = [...selected]
}

function toggleAllPageBookmarks() {
  selectedBookmarkIds.value = allPageBookmarksSelected.value
    ? []
    : activeBookmarkList.value.map((item) => item.id)
}

function removeBookmarkFromCurrentView(artworkId: string): void {
  const hidden = tab.value === UserTabs.hidden_bookmarks
  const list = hidden ? hiddenBookmarks : publicBookmarks
  const total = hidden ? totalHiddenBookmarks : totalPublicBookmarks
  const nextList = list.value.filter((item) => item.id !== artworkId)

  if (nextList.length !== list.value.length) {
    list.value = nextList
    total.value = Math.max(0, total.value - 1)
  }

  const artworkTags = hidden ? hiddenArtworkTags : publicArtworkTags
  artworkTags.removeWork(artworkId)
  selectedBookmarkIds.value = selectedBookmarkIds.value.filter(
    (id) => id !== artworkId
  )
}

async function refreshActiveBookmarkPage() {
  publicBookmarkCache.clear()
  hiddenBookmarkCache.clear()
  const hidden = tab.value === UserTabs.hidden_bookmarks
  const page = getActiveBookmarkRefreshPage(
    publicBookmarkPage.value,
    hiddenBookmarkPage.value,
    hidden
  )
  await Promise.all([loadBookmarkTags(), getBookmarks(hidden, page)])
  const list = hidden ? hiddenBookmarks.value : publicBookmarks.value
  if (!list.length && page > 1) await getBookmarks(hidden, page - 1)
  refreshArtworkTagIndexes()
}

/**
 * Batch edits can move works between the public and private lists, so any index
 * already built has to be rebuilt — but only if the user actually opened it.
 */
function refreshArtworkTagIndexes(): void {
  for (const index of [publicArtworkTags, hiddenArtworkTags]) {
    if (index.scanned.value) void index.scan(true)
  }
}

async function handleBatchAddTags(tags: string[]) {
  const normalizedTags = tags.slice(0, 10)
  const targets = selectedBookmarks.value
  const bookmarkIds = targets.flatMap((item) =>
    item.bookmarkData ? [item.bookmarkData.id] : []
  )
  if (!bookmarkIds.length || bookmarkBatchLoading.value) return

  bookmarkBatchLoading.value = true
  try {
    await artworkStore.addTagsToBookmarks(bookmarkIds, normalizedTags)
    for (const item of targets) {
      if (!item.bookmarkData) continue
      item.bookmarkData.tags = mergeBookmarkTags(
        item.bookmarkData.tags ?? [],
        normalizedTags
      )
    }
    await refreshActiveBookmarkPage()
    toast.success(`已为 ${bookmarkIds.length} 个收藏添加标签`)
  } catch (err) {
    console.warn('failed to add bookmark tags in batch', err)
    toast.error('批量添加标签失败，请稍后重试')
  } finally {
    bookmarkBatchLoading.value = false
  }
}

async function handleBatchVisibility(privateBookmarks: boolean) {
  const targets = selectedBookmarks.value
  const bookmarkIds = targets.flatMap((item) =>
    item.bookmarkData ? [item.bookmarkData.id] : []
  )
  if (!bookmarkIds.length || bookmarkBatchLoading.value) return

  bookmarkBatchLoading.value = true
  try {
    await artworkStore.setBookmarksVisibility(bookmarkIds, privateBookmarks)
    selectedBookmarkIds.value = []
    await refreshActiveBookmarkPage()
    toast.success(
      `已将 ${bookmarkIds.length} 个收藏转为${privateBookmarks ? '私密' : '公开'}`
    )
  } catch (err) {
    console.warn('failed to edit bookmark visibility in batch', err)
    toast.error('批量修改可见范围失败，请稍后重试')
  } finally {
    bookmarkBatchLoading.value = false
  }
}

const { revision: bookmarkRevision, target: bookmarkEditorTarget } =
  useBookmarkEditor()
watch(bookmarkRevision, () => {
  if (!isSelfUserPage.value) return
  const hidden = tab.value === UserTabs.hidden_bookmarks
  const currentTarget = bookmarkEditorTarget.value
  const artworkId = String(currentTarget?.illustId || currentTarget?.id || '')

  if (
    artworkId &&
    isBookmarkTab(tab.value || '') &&
    !bookmarkBelongsToVisibility(currentTarget?.bookmarkData, hidden)
  ) {
    removeBookmarkFromCurrentView(artworkId)
  }

  if (isBookmarkTab(tab.value || '')) void refreshActiveBookmarkPage()
})

onBeforeRouteUpdate((to) => {
  if (to.name !== 'users') {
    return
  }
  init(to.params.id as string, to.query.tab as UserTabs)
})

onBeforeRouteLeave(() => {
  persistBookmarkViewState()
})

effect(() => setTitle(user.value?.name, 'Users'))
onMounted(async () => {
  init(route.params.id as string, route.query.tab as UserTabs)
})
</script>

<style scoped lang="scss">
#user-view {
  min-height: 100vh;
  color: var(--pf-text);
  background: var(--pf-bg);
}

.cover-banner {
  position: relative;
  height: 150px;
  overflow: hidden;
  background: color-mix(in srgb, var(--pf-pink) 7%, var(--pf-bg));

  &.no-cover {
    height: 86px;
    background:
      radial-gradient(
        circle at 22% 20%,
        color-mix(in srgb, var(--pf-pink) 18%, transparent),
        transparent 34%
      ),
      var(--pf-bg);
  }

  @media (max-width: 768px) {
    height: 110px;

    &.no-cover {
      height: 70px;
    }
  }
}

.cover-image {
  width: 100%;
  height: 100%;
  background-position: center;
  background-size: cover;
  background-repeat: no-repeat;
  filter: saturate(0.92);
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--pf-muted);
  user-select: none;
}

.user-layout {
  position: relative;
  display: grid;
  grid-template-columns: 280px 1fr;
  align-items: start;
  gap: 24px;
  width: min(1320px, calc(100% - 48px));
  margin: -32px auto 0;
  padding-bottom: 48px;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    width: calc(100% - 24px);
    margin-top: -20px;
  }

  &.artwork-grid-layout {
    grid-template-columns: minmax(0, 1fr);

    .user-content {
      width: 100%;
    }
  }
}

.bookmark-grid,
.bookmark-author-groups {
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

.bookmark-author-groups {
  display: grid;
  gap: 34px;
}

.bookmark-author-group {
  min-width: 0;
}

.bookmark-author-divider {
  display: flex;
  min-height: 38px;
  align-items: center;
  gap: 11px;
  margin-bottom: 16px;
}

.bookmark-author-anchor {
  width: 4px;
  height: 28px;
  flex: 0 0 auto;
  background: var(--pf-pink);
  border-radius: 999px;
}

.bookmark-author-avatar-link {
  display: inline-flex;
  flex: 0 0 auto;
}

.bookmark-author-avatar {
  display: inline-flex;
  width: 36px;
  height: 36px;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  color: var(--pf-muted);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 50%;

  &--empty svg {
    width: 16px;
    height: 16px;
  }
}

.bookmark-author-identity {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;

  > span {
    overflow: hidden;
    max-width: 150px;
    color: var(--pf-muted);
    font-size: 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.bookmark-author-name {
  overflow: hidden;
  max-width: 230px;
  color: var(--pf-text);
  font-size: 0.9rem;
  font-weight: 780;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--pf-pink);
  }
}

.bookmark-author-line {
  height: 1px;
  flex: 1 1 auto;
  background: var(--pf-line);
}

.bookmark-author-count {
  flex: 0 0 auto;
  color: var(--pf-muted);
  font-size: 0.76rem;
  font-weight: 650;
  white-space: nowrap;
}

@media (max-width: 560px) {
  .bookmark-author-groups {
    gap: 28px;
  }

  .bookmark-author-divider {
    gap: 8px;
    margin-bottom: 12px;
  }

  .bookmark-author-identity > span {
    display: none;
  }

  .bookmark-author-name {
    max-width: 140px;
  }
}

.bookmark-pagination {
  margin: 2rem 0 0.5rem;
}

.user-sidebar {
  text-align: center;

  .user-sidebar-card {
    padding: 20px;
    background: color-mix(in srgb, var(--pf-surface) 96%, transparent);
    border: 1px solid var(--pf-line);
    border-radius: 18px;
    box-shadow: var(--pf-card-shadow);
  }

  .avatar-area {
    margin-bottom: 12px;
  }

  .user-avatar {
    width: 92px;
    height: 92px;
    object-fit: cover;
    background: var(--pf-surface);
    border: 3px solid var(--pf-surface);
    border-radius: 50%;
    box-shadow: 0 8px 22px rgb(67 41 59 / 18%);
  }

  .username {
    font-size: 1.3rem;
    font-weight: 780;
    margin: 0 0 0.25rem;
  }

  .user-id {
    margin-bottom: 0.5rem;
  }

  .user-premium {
    display: inline-flex;
    padding: 3px 8px;
    color: #fff;
    background: #f3a221;
    border-radius: 999px;
    font-size: 0.64rem;
    font-weight: 750;
    text-transform: uppercase;
  }

  hr {
    border: none;
    height: 1px;
    background: var(--pf-line);
    margin: 14px 0;
  }

  .meta-lines {
    text-align: left;
    font-size: 0.85rem;
    color: var(--pf-text);
  }

  .meta-line {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.2rem 0;

    .fnb-icon {
      color: var(--pf-pink);
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
        color: var(--pf-muted);
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
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.5rem;
  }
}

.sidebar-feature-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 40px;
  padding: 0 14px;
  color: var(--pf-muted);
  background: transparent;
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 720;

  svg {
    width: 13px;
    height: 13px;
  }

  &.featured {
    color: #f3a221;
    background: color-mix(in srgb, #f3a221 10%, transparent);
    border-color: color-mix(in srgb, #f3a221 48%, var(--pf-line));
  }

  &:disabled {
    cursor: wait;
    opacity: 0.64;
  }
}

.sidebar-follow-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 112px;
  min-height: 40px;
  padding: 0 16px;
  color: #fff;
  background: var(--pf-blue);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 750;

  svg {
    width: 14px;
    height: 14px;
  }

  &.followed {
    color: var(--pf-text);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.64;
  }
}

.self-user-badge {
  color: var(--pf-muted);
  font-size: 0.76rem;
}

.sidebar-block-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 40px;
  padding: 0 16px;
  color: var(--pf-muted);
  background: transparent;
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;

  &.blocked {
    color: #fff;
    background: var(--pf-muted);
    border-color: var(--pf-muted);
  }
}

.author-featured {
  margin-bottom: 24px;
  overflow: hidden;
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-surface) 96%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: var(--pf-card-shadow);
}

.author-featured-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px;
  cursor: pointer;
  list-style: none;
  user-select: none;

  &::-webkit-details-marker {
    display: none;
  }

  &:focus-visible {
    outline: 2px solid var(--pf-pink);
    outline-offset: -3px;
  }
}

.author-featured-title {
  display: grid;
  gap: 2px;

  .eyebrow {
    color: var(--pf-pink);
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.12em;
  }

  h2 {
    margin: 0;
    font-size: 1.18rem;
  }
}

.author-featured-count {
  color: var(--pf-muted);
  font-size: 0.75rem;
}

.author-featured-meta {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-featured-toggle {
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--pf-muted);
  border-bottom: 2px solid var(--pf-muted);
  transform: rotate(45deg);
  transition: transform 150ms ease;
}

.author-featured[open] .author-featured-toggle {
  transform: rotate(-135deg);
}

.author-featured-body {
  padding: 0 22px 24px;
  border-top: 1px solid var(--pf-line);
}

.author-featured-group {
  margin-top: 18px;

  h3 {
    margin: 0;
    color: var(--pf-muted);
    font-size: 0.78rem;
    font-weight: 680;
  }
}

:deep(.author-featured-artworks.artworks-list),
:deep(.author-featured-novels.novel-list) {
  margin-top: 12px;
}

.related-authors {
  margin-top: 28px;
  padding-bottom: 28px;
}

.related-authors-title {
  margin: 0 0 14px;
  font-size: 1.05rem;
}

.related-authors-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

.blocked-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 10px 16px;
  color: #fff;
  background: color-mix(in srgb, var(--pf-pink) 82%, #000);
  font-size: 0.85rem;

  button {
    padding: 4px 14px;
    color: inherit;
    background: rgb(255 255 255 / 16%);
    border: 1px solid rgb(255 255 255 / 45%);
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-size: 0.78rem;
  }
}

.user-content {
  min-width: 0;

  :deep(.fnb-tabs__nav) {
    position: sticky;
    top: 63px;
    z-index: 12;
    justify-content: center;
    gap: 4px;
    padding: 0;
    background: color-mix(in srgb, var(--pf-bg) 92%, transparent);
    border: 0;
    border-bottom: 1px solid var(--pf-line);
    // The layout is pulled up over the cover banner, so the top edge shows:
    // round it to match the cards below instead of cutting a hard rectangle.
    border-radius: 18px 18px 0 0;
    backdrop-filter: blur(14px);
  }

  :deep(.fnb-tabs__tab) {
    flex: 0 1 auto;
    min-width: 96px;
    padding: 13px 20px 11px;
    color: var(--pf-muted);
    background: transparent;
    border: 0;
    border-bottom: 3px solid transparent;
    font-size: 0.86rem;
    font-weight: 650;

    &:hover:not(.fnb-tabs__tab--active) {
      color: var(--pf-text);
      background: color-mix(in srgb, var(--pf-pink) 6%, transparent);
    }
  }

  :deep(.fnb-tabs__tab--active) {
    color: var(--pf-pink);
    background: transparent;
    border-color: var(--pf-pink);
    font-weight: 760;
  }

  :deep(.fnb-tabs__panel) {
    margin-top: 22px;
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
  color: var(--pf-muted);
}

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
  width: 600px;
  max-width: 86vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: 0 22px 70px rgb(0 0 0 / 28%);

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
    color: var(--pf-muted);
    z-index: 1;

    &:hover {
      color: var(--pf-text);
    }
  }

  &__header {
    font-weight: 780;
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
    height: 1px;
    background: var(--pf-line);
    margin: 1rem 0;
  }

  .modal-top {
    text-align: center;
    background: var(--pf-bg);
    border-bottom: 1px solid var(--pf-line);
    padding: 1.5rem 0;
    margin: 0 -1.5rem;
  }

  .modal-avatar {
    display: inline-block;
    position: relative;

    img {
      width: 80px;
      height: 80px;
      object-fit: cover;
      border: 3px solid var(--pf-surface);
      border-radius: 50%;
      box-shadow: 0 8px 22px rgb(67 41 59 / 18%);
    }

    .premium-icon {
      position: absolute;
      bottom: -4px;
      right: -4px;
      color: #f3a221;
      background: var(--pf-surface);
      border: 1px solid var(--pf-line);
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
    font-weight: 780;
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
