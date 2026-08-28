<template lang="pug">
section.artwork-modern(
  :class='{ "artwork-modern--accent-blue": accentTone === "blue", "artwork-modern--panel-pixiv-gray": panelTone === "pixiv-gray" }',
  :style='directoryTuningStyle'
)
  .modern-blocked-banner(v-if='authorBlocked')
    span 该作品的作者已被你屏蔽。
    button(@click='handleUnblockAuthor' type='button') 解除屏蔽
  .modern-shell
    main.modern-content
      .media-panel
        .ugoira-stage(v-if='isUgoira')
          UgoiraViewer(:illust='illust', :key='illust.illustId')
        template(v-else)
          a.modern-image-link(
            :href='getOriginalImageViewerUrl(page.urls.original)',
            :key='index'
            target='_blank'
            title='在新标签页查看原图'
            v-for='(page, index) in visiblePages'
          )
            DeferLoad.modern-image(
              :alt='`${illust.illustTitle} 第 ${index + 1} 页`',
              :height='page.height',
              :src='page.urls.regular',
              :width='page.width'
              lazyload
            )
            .page-pill(v-if='pages.length > 1') {{ index + 1 }} / {{ pages.length }}
          button.read-more(
            @click='pagesExpanded = !pagesExpanded'
            type='button'
            v-if='pages.length > 1'
          )
            ITablerChevronUp(aria-hidden='true' v-if='pagesExpanded')
            ITablerChevronDown(aria-hidden='true' v-else)
            | {{ pagesExpanded ? '收起作品' : `阅读更多（剩余 ${pages.length - 1} 张）` }}

      article.info-panel
        .title-row
          .title-copy
            h1(:class='{ danger: illust.xRestrict }') {{ illust.illustTitle }}
            p.publish-time {{ formattedDate }} · {{ illust.isOriginal ? '原创插画' : '插画' }}
          .primary-actions
            button.action.action--like(
              :aria-label='illust.likeData ? "已赞" : "赞！"',
              :class='{ active: illust.likeData }',
              :disabled='likeLoading || illust.likeData',
              :title='illust.likeData ? "已赞" : "赞！"'
              @click='$emit("like")'
              type='button'
            )
              ITablerCheck(aria-hidden='true' v-if='illust.likeData')
              PixivLikeIcon(v-else)
              span 赞！
            button.action.action--icon.action--bookmark(
              :aria-label='illust.bookmarkData ? "取消收藏" : "收藏"',
              :class='{ active: illust.bookmarkData }',
              :disabled='bookmarkLoading',
              :title='illust.bookmarkData ? "取消收藏" : "收藏"'
              @click='$emit(illust.bookmarkData ? "remove-bookmark" : "add-bookmark")'
              type='button'
            )
              ITablerHeartFilled(aria-hidden='true' v-if='illust.bookmarkData')
              ITablerHeart(aria-hidden='true' v-else)
            button.action.action--icon(
              @click='shareArtwork'
              aria-label='分享'
              title='分享'
              type='button'
            )
              PixivShareIcon
            button.action.action--icon.action--more(
              @click='openBookmarkEditor(illust)'
              aria-label='收藏设置'
              title='收藏设置'
              type='button'
            )
              ITablerDots(aria-hidden='true')

        .description.pre(v-html='artworkDescription' v-if='artworkDescription')
        p.description.no-desc(v-else) 作者未填写简介

        .tag-list
          span.status-tag.original(v-if='illust.isOriginal') 原创
          ArtTag(
            :key='item.tag',
            :tag='item.tag',
            :translation='item.translation?.en'
            v-for='item in illust.tags.tags'
          )

        .meta-row
          span
            ITablerHeart(aria-hidden='true')
            | {{ illust.bookmarkCount }}
          span
            ITablerEye(aria-hidden='true')
            | {{ illust.viewCount }}
          span
            ITablerMessage(aria-hidden='true')
            | {{ illust.commentCount }}
          FnbButton(
            :href='illust.extraData?.meta?.canonical || "#"'
            rel='noopener noreferrer'
            size='sm'
            tag='a'
            target='_blank'
          ) 前往 Pixiv

      section.comments-panel
        .comments-heading
          h2 评论 · {{ illust.commentCount }}
          button.comments-toggle(
            :aria-expanded='commentsExpanded'
            @click='commentsExpanded = !commentsExpanded'
            type='button'
          )
            ITablerChevronUp(aria-hidden='true' v-if='commentsExpanded')
            ITablerChevronDown(aria-hidden='true' v-else)
            | {{ commentsExpanded ? '折叠评论' : '展开评论' }}
        CommentArea(
          :author-id='illust.userId',
          :count='illust.commentCount',
          :disabled='illust.commentOff === 1',
          :id='illust.id || illust.illustId'
          v-show='commentsExpanded'
        )

    aside.modern-sidebar
      section.sidebar-card.sidebar-directory-shell
        AuthorArtworkDirectory(
          :current-artwork-id='currentArtworkId',
          :user-id='illust.userId'
        )

        ModernAuthorCard(:user='user')

  section.modern-recommend(:style='artworkLayoutContainerStyle')
    h2.plain 相关作品
    ArtworkList(
      :list='recommendations',
      :loading='recommendLoading && !recommendations.length'
      controlled
      page-count-filtered
    )
    .recommend-more(v-if='recommendations.length && hasMoreRecommendations')
      FnbButton(
        :loading='recommendLoading'
        @click='$emit("more-recommend")'
        @mouseenter='startRecommendHover'
        @mouseleave='cancelRecommendHover'
        size='sm'
      ) {{ recommendLoading ? '加载中' : '加载更多' }}

  PageSettingsPanel(
    title='作品页设置'
    v-if='directoryTuningEnabled && pageSettingsVisible'
  )
    .directory-debug-controls
      .directory-debug-heading
        strong 作品页布局
        button(@click='resetDirectoryTuning' type='button') 重置
      label.directory-debug-control.directory-debug-control--choice
        span 面板背景
        select(aria-label='作品内容面板背景' v-model='panelTone')
          option(value='surface') 当前白色
          option(value='pixiv-gray') Pixiv 灰
      label.directory-debug-control.directory-debug-control--choice
        span 强调色系
        select(aria-label='作品页强调色系' v-model='accentTone')
          option(value='pink') 粉色系
          option(value='blue') 蓝色系
      label.directory-debug-control
        span 左侧作品宽度
        input(
          aria-label='左侧作品框宽度'
          max='1200'
          min='520'
          step='10'
          type='range'
          v-model.number='directoryContentWidth'
        )
        output {{ directoryContentWidth }}px
      label.directory-debug-control
        span 作品框限高
        input(
          aria-label='作品框最大高度'
          max='1800'
          min='420'
          step='20'
          type='range'
          v-model.number='artworkMaxHeight'
        )
        output {{ artworkMaxHeight }}px
      label.directory-debug-control
        span 图片大小
        input(
          aria-label='目录图片大小'
          max='340'
          min='140'
          step='2'
          type='range'
          v-model.number='directoryCardSize'
        )
        output {{ directoryCardSize }}px
      label.directory-debug-control
        span 右栏宽度
        input(
          aria-label='作品目录右栏宽度'
          max='800'
          min='420'
          step='10'
          type='range'
          v-model.number='directorySidebarWidth'
        )
        output {{ directorySidebarWidth }}px
</template>

<script lang="ts" setup>
import ArtTag from '~/components/ArtTag.vue'
import AuthorArtworkDirectory from '~/components/Artwork/AuthorArtworkDirectory.vue'
import ModernAuthorCard from '~/components/Artwork/ModernAuthorCard.vue'
import CommentArea from '~/components/Comment/CommentArea.vue'
import ArtworkList from '~/components/Artwork/ArtworkList.vue'
import DeferLoad from '~/components/DeferLoad.vue'
import PixivLikeIcon from '~/components/icons/PixivLikeIcon.vue'
import PixivShareIcon from '~/components/icons/PixivShareIcon.vue'
import type { Artwork, ArtworkGallery, ArtworkInfo, User } from '~/types'
import { unwrapPixivJumpLinks } from '~/utils/pixivJumpLink'
import { getOriginalImageViewerUrl } from '~/utils/pximg'
import { getVisibleArtworkPages } from '~/utils/refineModernArtwork'
import {
  IconCheck as ITablerCheck,
  IconChevronDown as ITablerChevronDown,
  IconChevronUp as ITablerChevronUp,
  IconDots as ITablerDots,
  IconEye as ITablerEye,
  IconHeart as ITablerHeart,
  IconHeartFilled as ITablerHeartFilled,
  IconMessageCircle as ITablerMessage,
} from '@tabler/icons-vue'

const props = defineProps<{
  illust: Artwork
  currentArtworkId: string
  pages: ArtworkGallery[]
  user?: User
  recommendations: ArtworkInfo[]
  recommendLoading?: boolean
  hasMoreRecommendations?: boolean
  bookmarkLoading?: boolean
  likeLoading?: boolean
}>()

const emit = defineEmits<{
  like: []
  'add-bookmark': []
  'remove-bookmark': []
  'more-recommend': []
}>()

const toast = useToast()
const { isBlocked, unblockAuthor } = useAuthorBlocklist()
const authorBlocked = computed(() => isBlocked(props.illust.userId))

async function handleUnblockAuthor(): Promise<void> {
  try {
    await unblockAuthor(props.illust.userId)
    toast.success('已解除屏蔽该作者')
  } catch {
    toast.error('操作失败，请重试')
  }
}
const { openBookmarkEditor } = useBookmarkEditor()
const { containerStyle: artworkLayoutContainerStyle } =
  useArtworkLayoutSettings()
const { pageSettingsVisible } = useFloatingControlsVisibility()
const {
  accentTone,
  artworkMaxHeight,
  cardSize: directoryCardSize,
  contentWidth: directoryContentWidth,
  enabled: directoryTuningEnabled,
  panelTone,
  reset: resetDirectoryTuning,
  sidebarWidth: directorySidebarWidth,
  style: directoryTuningStyle,
} = useArtworkDirectoryTuning()
const isUgoira = computed(() => props.illust.illustType === 2)
const pagesExpanded = ref(false)
const commentsExpanded = ref(false)
let recommendHoverTimer: ReturnType<typeof setTimeout> | undefined
const visiblePages = computed(() =>
  getVisibleArtworkPages(props.pages, pagesExpanded.value)
)
const formattedDate = computed(() =>
  new Date(props.illust.createDate).toLocaleString()
)
const artworkDescription = computed(() =>
  unwrapPixivJumpLinks(props.illust.description)
)
const UgoiraViewer = defineAsyncComponent(
  () => import('~/components/UgoiraViewer.vue')
)

watch(
  () => props.illust.illustId,
  () => {
    pagesExpanded.value = false
    commentsExpanded.value = false
  }
)

function cancelRecommendHover(): void {
  if (!recommendHoverTimer) return
  clearTimeout(recommendHoverTimer)
  recommendHoverTimer = undefined
}

function startRecommendHover(): void {
  cancelRecommendHover()
  if (props.recommendLoading || !props.hasMoreRecommendations) return

  recommendHoverTimer = setTimeout(() => {
    recommendHoverTimer = undefined
    if (!props.recommendLoading && props.hasMoreRecommendations) {
      emit('more-recommend')
    }
  }, 100)
}

onBeforeUnmount(cancelRecommendHover)

async function shareArtwork() {
  const url = window.location.href
  try {
    if (navigator.share) {
      await navigator.share({ title: props.illust.illustTitle, url })
    } else {
      await navigator.clipboard.writeText(url)
      toast.success('作品链接已复制')
    }
  } catch (error) {
    if ((error as DOMException).name !== 'AbortError') {
      toast.error('分享失败，请稍后重试')
    }
  }
}
</script>

<style scoped lang="scss">
.artwork-modern {
  padding: 28px 0 0;
  color: var(--pf-text);
  background: var(--pf-bg);
}

.modern-blocked-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  margin: -28px 0 20px;
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

.modern-shell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(300px, 390px);
  gap: 28px;
  width: min(1320px, calc(100% - 48px));
  margin: 0 auto;
}

.modern-content {
  display: grid;
  gap: 20px;
  min-width: 0;
}

.media-panel,
.info-panel,
.comments-panel,
.sidebar-card {
  min-width: 0;
  max-width: 100%;
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: var(--pf-card-shadow);
}

.media-panel {
  position: relative;
  display: grid;
  gap: 12px;
  min-height: 420px;
  padding: 16px;
  overflow: hidden;
  background: color-mix(in srgb, var(--pf-surface) 82%, var(--pf-bg));
  place-items: center;
}

.modern-image-link {
  display: grid;
  width: 100%;
  min-width: 0;
  place-items: center;
}

.ugoira-stage {
  display: grid;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  place-items: center;
}

.modern-image {
  display: block;
  width: auto;
  max-width: 100%;
  height: auto;
  max-height: 76vh;
  object-fit: contain;
  border-radius: 13px;
}

.page-pill {
  position: absolute;
  top: 28px;
  right: 28px;
  padding: 7px 13px;
  color: #fff;
  background: rgb(30 25 32 / 72%);
  border-radius: 999px;
  font-size: 0.84rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.read-more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: min(360px, 100%);
  min-height: 44px;
  margin: 4px auto 0;
  color: var(--modern-pink-strong);
  background: var(--modern-soft-pink);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;

  svg {
    width: 17px;
    height: 17px;
  }

  &:hover {
    color: #fff;
    background: var(--modern-pink);
  }

  &:focus-visible {
    outline: 2px solid var(--modern-pink);
    outline-offset: 3px;
  }
}

.info-panel,
.comments-panel {
  padding: 24px;
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.title-copy {
  min-width: 0;

  h1 {
    margin: 0;
    font-size: clamp(1.35rem, 2.3vw, 1.8rem);

    &.danger {
      color: #ff8c42;
    }
  }
}

.publish-time,
.description,
.meta-row {
  color: var(--pf-muted);
}

.publish-time {
  margin: 6px 0 0;
  font-size: 0.78rem;
}

.primary-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

.action {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 38px;
  padding: 0 12px;
  color: var(--pf-text);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  cursor: pointer;

  &.active {
    color: #fff;
    background: var(--pf-pink);
    border-color: transparent;
  }

  &:disabled {
    cursor: default;
    opacity: 0.7;
  }
}

.description {
  min-width: 0;
  max-width: 100%;
  margin: 18px 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  line-height: 1.7;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  :deep(.artwork-tag) {
    margin: 0;
    padding: 6px 11px;
    font-family: var(--pf-font-sans);
    font-size: 0.88rem;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 1.45;
  }

  :deep(.artwork-tag__name) {
    font-weight: 680;
  }

  :deep(.artwork-tag__translation) {
    font-size: 0.8rem;
  }
}

.status-tag {
  padding: 5px 9px;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 650;

  &.original {
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
  }

  &.r18 {
    color: #d74755;
    background: rgb(215 71 85 / 12%);
  }
}

.meta-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  margin-top: 18px;
  font-size: 0.78rem;

  span {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  .fnb-button {
    margin-left: auto;
  }
}

.comments-panel h2,
.directory-heading h2,
.modern-recommend h2 {
  margin: 0;
  font-size: 1.2rem;
}

.modern-sidebar {
  display: grid;
  align-content: start;
  gap: 18px;
  min-width: 0;
}

.sidebar-card {
  padding: 20px;
}

.author-panel {
  :deep(.author-card .artworks-list),
  :deep(.author-card .description) {
    display: none;
  }

  :deep(.author-card .left img) {
    width: 54px;
    height: 54px;
    border-color: var(--pf-line);
    border-radius: 999px;
    box-shadow: none;
  }
}

.directory-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;

  span {
    color: var(--pf-pink);
    font-size: 0.75rem;
    font-weight: 650;
  }
}

.page-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  max-height: 560px;
  overflow-y: auto;
}

.page-item {
  min-width: 0;
  padding: 0;
  overflow: hidden;
  color: var(--pf-muted);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 12px;
  cursor: pointer;
  text-align: left;

  &.active {
    color: var(--pf-pink);
    border-color: var(--pf-pink);
    box-shadow: 0 0 0 2px var(--pf-soft-pink);
  }

  :deep(img) {
    display: block;
    width: 100%;
    height: 96px;
    object-fit: cover;
  }

  span {
    display: block;
    padding: 7px 9px;
    font-size: 0.72rem;
    font-weight: 650;
  }
}

.browse-switch,
.page-nav {
  display: flex;
  gap: 4px;
  margin-top: 16px;
  padding: 4px;
  background: var(--pf-bg);
  border-radius: 11px;

  button {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 36px;
    color: var(--pf-muted);
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;

    &.active {
      color: #fff;
      background: var(--pf-pink);
    }
  }
}

.page-nav {
  align-items: center;
  justify-content: space-between;
  background: transparent;

  button {
    flex: 0 0 38px;
    color: var(--pf-pink);
    background: var(--pf-soft-pink);

    &:disabled {
      opacity: 0.35;
    }
  }

  strong {
    font-size: 0.8rem;
  }
}

.modern-recommend {
  margin-top: 30px;
  padding: 26px max(24px, calc((100% - 1320px) / 2));
  background: transparent;
  border: 0;

  :deep(.artworks-list) {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 14px;
    justify-content: stretch;

    li {
      width: auto;
      max-width: none;
      min-width: 0;
    }
  }
}

.recommend-more {
  margin-top: 20px;
  text-align: center;
}

@media (max-width: 1020px) {
  .modern-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .modern-sidebar {
    grid-row: 2;
  }

  .modern-recommend :deep(.artworks-list) {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 680px) {
  .artwork-modern {
    padding-top: 16px;
  }

  .modern-shell {
    width: min(100% - 24px, 1320px);
    gap: 14px;
  }

  .media-panel,
  .info-panel,
  .comments-panel,
  .sidebar-card {
    border-radius: 14px;
  }

  .media-panel {
    min-height: 260px;
    padding: 10px;
  }

  .info-panel,
  .comments-panel,
  .sidebar-card {
    padding: 16px;
  }

  .title-row {
    display: grid;
  }

  .primary-actions {
    justify-content: flex-start;
  }

  .modern-recommend :deep(.artworks-list) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

<style scoped lang="scss">
.artwork-modern {
  --modern-bg: #f7f7f8;
  --modern-surface: #fff;
  --modern-card-tint: #fff8fb;
  --modern-soft-panel: #f7f3f6;
  --modern-soft-pink: #fff0f7;
  --modern-pink: #f05da4;
  --modern-pink-strong: #d65091;
  --modern-text: #2d2630;
  --modern-text-soft: #554a57;
  --modern-muted: #918692;
  --modern-line: #ece7eb;
  --modern-skeleton: #eee9ed;
  --modern-shadow: 0 5px 16px rgb(94 59 80 / 8%);
  --modern-panel-surface: var(--modern-surface);
  min-height: calc(100vh - 64px);
  padding-top: 28px;
  color: var(--modern-text);
  background: var(--modern-bg);
}

.artwork-modern--accent-blue {
  --modern-soft-pink: #eaf6ff;
  --modern-pink: #0096fa;
  --modern-pink-strong: #087fc4;
}

.artwork-modern--panel-pixiv-gray {
  --modern-panel-surface: #f0f1f3;
}

.modern-shell {
  grid-template-columns:
    min(
      var(--modern-content-width, 740px),
      calc(100vw - var(--modern-sidebar-width, 620px) - 96px)
    )
    var(--modern-sidebar-width, 620px);
  align-items: start;
  width: auto;
  margin-right: 20px;
  margin-left: max(24px, calc((100% - 1440px) / 2));
}

.media-panel,
.info-panel,
.comments-panel,
.sidebar-card {
  background: var(--modern-surface);
  border: 1px solid var(--modern-line);
  border-radius: 18px;
  box-shadow: var(--modern-shadow);
}

.media-panel,
.info-panel,
.comments-panel {
  background: var(--modern-panel-surface);
}

.media-panel {
  gap: 16px;
  padding: 16px;
  background: var(--modern-panel-surface);
}

.modern-image-link {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
}

.modern-image {
  width: auto;
  max-width: 100%;
  max-height: var(--modern-artwork-max-height, 760px);
  object-fit: contain;
  border-radius: 16px;
}

.page-pill {
  top: 14px;
  right: 14px;
  background: rgb(44 35 43 / 68%);
  box-shadow: 0 2px 10px rgb(0 0 0 / 12%);
  backdrop-filter: blur(8px);
}

.info-panel,
.comments-panel {
  padding: 24px;
}

.comments-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 10px;
}

.comments-toggle {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  color: var(--modern-pink-strong);
  background: var(--modern-soft-pink);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 700;

  svg {
    width: 16px;
    height: 16px;
  }

  &:focus-visible {
    outline: 2px solid var(--modern-pink);
    outline-offset: 2px;
  }
}

.title-copy h1 {
  color: var(--modern-text);
  font-size: clamp(1.4rem, 2.2vw, 1.75rem);
  line-height: 1.25;
}

.publish-time,
.description,
.meta-row {
  color: var(--modern-muted);
}

.description {
  color: var(--modern-text-soft);
}

.action {
  min-height: 40px;
  justify-content: center;
  padding: 0 10px;
  color: var(--modern-text-soft);
  background: transparent;
  border: 0;
  border-radius: 10px;
  box-shadow: none;
  font-size: 0.86rem;
  font-weight: 700;

  &.active {
    color: var(--modern-pink);
    background: transparent;
  }

  &:hover:not(:disabled):not([aria-disabled='true']) {
    background: var(--modern-soft-panel);
  }

  &:focus-visible {
    outline: 2px solid var(--modern-pink);
    outline-offset: 2px;
  }

  &:disabled {
    opacity: 1;
  }

  svg {
    width: 25px;
    height: 25px;
    stroke-width: 1.8;
  }
}

.action--like {
  gap: 7px;
  min-width: 74px;
}

.action--icon {
  width: 44px;
  min-width: 44px;
  padding: 0;
}

.action--bookmark {
  svg {
    width: 29px;
    height: 29px;
  }

  &.active {
    color: #ff4060;
  }
}

.action--more[aria-disabled='true'] {
  cursor: default;
}

.tag-list {
  gap: 6px;

  :deep(.fnb-tag) {
    padding: 6px 11px;
    color: var(--modern-pink-strong);
    background: var(--modern-soft-pink);
    border: 0;
    border-radius: 999px;
    box-shadow: none;
    font-family: var(--pf-font-sans);
    font-size: 0.88rem;
    font-weight: 600;
    line-height: 1.45;
    transform: none;
  }

  :deep(.artwork-tag__translation) {
    color: var(--modern-muted);
  }
}

.status-tag {
  color: var(--modern-pink-strong);
  background: var(--modern-soft-pink);

  &.original {
    color: var(--modern-pink-strong);
    background: var(--modern-soft-pink);
  }
}

.meta-row {
  padding-top: 2px;

  :deep(.fnb-button) {
    color: var(--modern-text-soft);
    background: var(--modern-soft-panel);
    border: 0;
    border-radius: 10px;
    box-shadow: none;
    transform: none;
  }
}

.comments-panel h2,
.modern-recommend h2 {
  display: inline-block;
  margin: 0;
  color: var(--modern-text);
  background: transparent;
  box-shadow: none;
  font-size: 1.2rem;
}

.comments-panel {
  :deep(.stats) {
    display: block;
    margin: 10px 0 16px;
    color: var(--modern-muted);
    font-size: 0.8rem;
    font-style: normal;
  }

  :deep(.comments-list) {
    margin: 0;
  }

  :deep(.comment-block) {
    padding: 10px 0;
    color: var(--modern-text-soft);

    .comment-author {
      color: var(--modern-text);
    }

    .tag {
      color: var(--modern-pink-strong);
      background: var(--modern-soft-pink);
      border-radius: 999px;
    }
  }

  :deep(.show-more .fnb-button) {
    justify-content: center;
    width: min(520px, 82%);
    min-width: 180px;
    padding: 8px 20px;
    color: var(--modern-text-soft);
    background: var(--modern-soft-panel);
    border: 0;
    border-radius: 999px;
    box-shadow: none;
    text-align: center;
    transform: none;

    &:hover {
      color: var(--modern-text);
      background: color-mix(
        in srgb,
        var(--modern-soft-panel) 82%,
        var(--modern-pink)
      );
    }
  }
}

.modern-sidebar {
  gap: 18px;
}

.sidebar-card {
  padding: 20px;
}

.sidebar-directory-shell {
  display: grid;
  gap: 36px;

  :deep(.modern-author-card) {
    width: 100%;
    padding-top: 28px;
    border-top: 1px solid var(--modern-line);
  }
}

.directory-debug-controls {
  display: grid;
  gap: 12px;
  color: var(--pf-text);
}

.directory-debug-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8rem;

  button {
    padding: 4px 9px;
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-size: 0.7rem;
  }
}

.directory-debug-control {
  display: grid;
  grid-template-columns: 66px minmax(80px, 1fr) 50px;
  align-items: center;
  gap: 9px;
  color: var(--pf-muted);
  font-size: 0.72rem;

  input {
    width: 100%;
    accent-color: var(--pf-pink);
    cursor: ew-resize;
  }

  output {
    color: var(--pf-text);
    font-family: var(--pf-font-mono);
    text-align: right;
  }
}

.directory-debug-control--choice {
  grid-template-columns: 82px minmax(120px, 1fr);

  select {
    width: 100%;
    min-height: 30px;
    padding: 4px 8px;
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    border-radius: 7px;
    font: inherit;
  }
}

.modern-recommend {
  width: min(1840px, calc(100% - 96px));
  margin: 30px auto 0;
  padding: 26px 0 34px;
  background: transparent;
  border: 0;

  :deep(.artworks-list) {
    gap: 16px 14px;
  }

  :deep(.fnb-media-card__media) {
    border-color: var(--modern-line);
    border-radius: 14px;
    box-shadow: 0 4px 14px rgb(94 59 80 / 7%);
  }

  :deep(.fnb-media-card__title) {
    color: var(--modern-text);
  }

  :deep(.fnb-media-card__author) {
    color: var(--modern-muted);
  }

  :deep(.recommend-more .fnb-button) {
    color: #fff;
    background: var(--modern-pink);
    border: 0;
    border-radius: 10px;
    box-shadow: none;
    transform: none;
  }
}

@media (max-width: 920px) {
  .modern-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .modern-sidebar {
    grid-row: 2;
  }

  .sidebar-directory-shell {
    width: 100%;
  }
}

@media (max-width: 680px) {
  .artwork-modern {
    padding-top: 14px;
  }

  .modern-shell {
    margin-right: 12px;
    margin-left: 12px;
  }

  .media-panel,
  .info-panel,
  .comments-panel,
  .sidebar-card {
    border-radius: 14px;
  }

  .media-panel {
    padding: 8px;
  }

  .title-row {
    display: grid;
  }

  .primary-actions {
    justify-content: flex-start;
  }

  .modern-recommend {
    width: calc(100% - 24px);
  }
}
</style>

<style lang="scss">
html.dark .artwork-modern {
  --modern-bg: #17151a;
  --modern-surface: #242027;
  --modern-card-tint: #2b2229;
  --modern-soft-panel: #302830;
  --modern-soft-pink: #432a3a;
  --modern-pink: #f06aae;
  --modern-pink-strong: #ff80bb;
  --modern-text: #f4eef3;
  --modern-text-soft: #d8cdd6;
  --modern-muted: #aea1ad;
  --modern-line: #3c343d;
  --modern-skeleton: #342f35;
  --modern-shadow: 0 8px 24px rgb(0 0 0 / 22%);
}

html.dark .artwork-modern--accent-blue {
  --modern-soft-pink: #173249;
  --modern-pink: #00a5f5;
  --modern-pink-strong: #62c5ff;
}

html.dark .artwork-modern--panel-pixiv-gray {
  --modern-panel-surface: #1f1f1f;
}
</style>
