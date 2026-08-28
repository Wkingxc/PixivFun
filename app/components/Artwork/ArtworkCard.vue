<template lang="pug">
.artwork-card-container
  .artwork-card.fnb-media-card.placeholder(v-if='loading')
    .artwork-image.fnb-media-card__media(
      :class='{ "artwork-image--zoom": imageZoom }'
    )
      FnbSkeleton(block height='100%' width='100%')
    .artwork-info.fnb-media-card__body
      .title.fnb-media-card__title: a: FnbSkeleton(height='1.4em' text width='8em')
      .author.fnb-media-card__author: a
        FnbSkeleton.avatar(circle height='1.5em' text width='1.5em')
        FnbSkeleton(text width='4em')
  .artwork-card.fnb-media-card(
    :class='{ "artwork-card--selectable": selectable, "artwork-card--selected": selected }'
    @click.capture='handleCardClick'
    @pointerdown.capture='handleSelectionPointerDown'
    @pointerenter='handleSelectionPointerEnter'
    v-else-if='item'
  )
    .artwork-image.fnb-media-card__media
      .side-tags
        button.batch-select(
          :aria-label='selected ? "取消选择作品" : "选择作品"',
          :aria-pressed='selected',
          :class='{ selected }'
          @click.stop.prevent='$emit("toggle-selection", item)'
          type='button'
          v-if='selectable'
        )
          ITablerCheck(aria-hidden='true' v-if='selected')
          span(aria-hidden='true' v-else)
        .page-count(
          :title='"共 " + item.pageCount + " 张"'
          v-if='item.pageCount > 1'
        )
          ITablerCopy(aria-hidden='true')
          | {{ item.pageCount }}
        button.bookmark(
          :aria-label='item.bookmarkData ? "编辑收藏设置" : "添加收藏"',
          :class='{ bookmarked: item.bookmarkData, disabled: loadingBookmark }',
          :title='item.bookmarkData ? "编辑收藏设置" : "添加收藏"'
          @click.stop.prevent='handleBookmark'
        )
          IFasHeart(aria-hidden='true')
      RouterLink(:to='workLink' @mousedown='handleOpenGesture')
        DeferLoad.img(
          :alt='item.alt',
          :src='cardImageUrl',
          :title='item.alt'
          lazyload
        )
        ArtworkViewedOverlay(
          :artwork-id='item.id',
          :disabled='markerDisabled || item.type === "novel"'
        )
        .type-ugoira(
          v-if='item.type !== "novel" && item.illustType === IllustType.UGOIRA'
        ): IPlayCircle
    .artwork-info.fnb-media-card__body
      .title.fnb-media-card__title(:class='{ "is-viewed": markTitle }')
        RouterLink(
          :style='titleStyle',
          :to='workLink'
          @mousedown='handleOpenGesture'
        ) {{ item.title }}
      .author.fnb-media-card__author
        ArtworkAuthorPopover(
          :profile-image-url='item.profileImageUrl',
          :user-id='item.userId',
          :user-name='item.userName',
          :viewed='markAuthorName',
          :viewed-style='authorStyle'
        )
</template>

<script lang="ts" setup>
import DeferLoad from '../DeferLoad.vue'
import ArtworkAuthorPopover from './ArtworkAuthorPopover.vue'
import { IllustType } from '~/utils/constants'
import { toRef } from 'vue'
import IFasHeart from '~icons/fa-solid/heart'
import IPlayCircle from '~icons/fa-solid/play-circle'
import {
  IconCheck as ITablerCheck,
  IconCopyFilled as ITablerCopy,
} from '@tabler/icons-vue'
import type { ArtworkInfo } from '~/types'
import {
  getArtworkCardImageUrl,
  type ArtworkCardImageQuality,
} from '~/utils/artworkLayout'
import { shouldRecordArtworkVisitGesture } from '~/utils/linkGestures'

import { useArtworkStore } from '~/stores/artwork'
import { useLocalPersistenceStore } from '~/stores/local-persistence'

const props = defineProps<{
  item?: ArtworkInfo
  loading?: boolean
  imageZoom?: boolean
  markerDisabled?: boolean
  imageQuality?: ArtworkCardImageQuality
  selectable?: boolean
  selected?: boolean
}>()

const emit = defineEmits<{
  'toggle-selection': [item: ArtworkInfo]
  'selection-drag-start': [item: ArtworkInfo]
  'selection-drag-enter': [item: ArtworkInfo]
}>()

const item = toRef(props, 'item')
const loading = toRef(props, 'loading')

const artworkStore = useArtworkStore()
const localPersistence = useLocalPersistenceStore()
const { markBookmarkChanged, openBookmarkEditor } = useBookmarkEditor()
const { markTitle, titleStyle } = useArtworkViewedState(
  () => item.value?.id,
  () => !!props.markerDisabled || item.value?.type === 'novel'
)
const { authorStyle, markName: markAuthorName } = useAuthorViewedState(
  () => item.value?.userId,
  () => !!props.markerDisabled
)
const workLink = computed(() =>
  item.value?.type === 'novel'
    ? `/novels/${item.value.id}`
    : `/artworks/${item.value?.id}`
)
const cardImageUrl = computed(() => {
  if (!item.value || item.value.type === 'novel') return item.value?.url || ''
  if (!props.imageQuality) return item.value.url
  return getArtworkCardImageUrl(item.value.url, props.imageQuality)
})

const loadingBookmark = ref(false)
let suppressSelectionClick = false

// Record on pointer-down so both same-tab and new-tab navigation update the
// marker immediately; the artwork page repeats this as a route-level fallback.
function handleOpenGesture(event: MouseEvent) {
  const current = item.value
  if (!current || props.markerDisabled || current.type === 'novel') return
  if (!shouldRecordArtworkVisitGesture(event)) return
  void localPersistence.recordArtworkVisit(current.id).catch(() => {})
}

function handleCardClick(event: MouseEvent) {
  if (!props.selectable || !item.value) return
  const target = event.target as Element | null
  if (target?.closest('.batch-select, .bookmark')) return
  event.preventDefault()
  event.stopPropagation()
  if (suppressSelectionClick) {
    suppressSelectionClick = false
    return
  }
  emit('toggle-selection', item.value)
}

function handleSelectionPointerDown(event: PointerEvent) {
  if (
    !props.selectable ||
    !item.value ||
    event.pointerType !== 'mouse' ||
    event.button !== 0
  ) {
    return
  }
  const target = event.target as Element | null
  if (target?.closest('.bookmark, .batch-select')) return
  suppressSelectionClick = true
  event.preventDefault()
  event.stopPropagation()
  emit('selection-drag-start', item.value)
}

function handleSelectionPointerEnter(event: PointerEvent) {
  if (
    !props.selectable ||
    !item.value ||
    event.pointerType !== 'mouse' ||
    !(event.buttons & 1)
  ) {
    return
  }
  event.preventDefault()
  emit('selection-drag-enter', item.value)
}

async function handleBookmark() {
  if (loadingBookmark.value) return
  const it = item.value!
  if (it.bookmarkData) {
    openBookmarkEditor(it)
    return
  }

  loadingBookmark.value = true
  try {
    const data = await artworkStore.addBookmark(it.id)
    if (data.last_bookmark_id && item.value) {
      item.value.bookmarkData = { id: data.last_bookmark_id, private: false }
      markBookmarkChanged()
    }
  } catch (e) {
    console.warn('handleBookmark', e)
  } finally {
    loadingBookmark.value = false
  }
}
</script>

<style lang="scss">
.artwork-image {
  animation: imgProgress 0.6s ease infinite alternate;

  a {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;

    &::before {
      content: '';
      position: absolute;
      z-index: 1;
      inset: 0;
      display: block;
      pointer-events: none;
      transition: all 0.4s ease-in-out;
    }
  }

  .img {
    position: relative;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: all 0.25s ease-in-out;
  }

  .bookmark {
    border: none;
    background: none;
    padding: 4px;
    font: inherit;
    color: inherit;
    cursor: pointer;
    border-radius: 999px;
    &:hover {
      background-color: rgba(255, 100, 100, 0.2);
    }
    &:focus-visible {
      outline: 2px solid var(--pf-pink);
      outline-offset: 2px;
    }
    &.disabled {
      opacity: 0.7;
      pointer-events: none;
    }
  }

  .type-ugoira {
    position: absolute;
    pointer-events: none;
    top: 50%;
    left: 50%;
    font-size: 2.5rem;
    color: #fff;
    opacity: 0.75;
    transform: translate(-50%, -50%);
  }

  &:hover a,
  & a.router-link-active {
    &::before {
      background-color: rgba(0, 0, 0, 0.2);
    }
  }

  &.artwork-image--zoom {
    &:hover a,
    & a.router-link-active {
      img {
        transform: scale(1.2);
      }
    }
  }

  .router-link-active {
    cursor: default;
    box-shadow: 0 0 0 2px var(--pf-line);

    & + .cover {
      background-color: rgba(100, 100, 100, 0.6) !important;
    }
  }

  .side-tags > * {
    position: absolute;
    z-index: 10;
  }

  .page-count {
    top: 8px;
    right: 8px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 3px;
    min-width: 36px;
    height: 24px;
    padding: 0 7px;
    color: #fff;
    background: rgb(18 28 31 / 72%);
    border: 0;
    border-radius: 9px;
    box-shadow: 0 2px 8px rgb(0 0 0 / 14%);
    backdrop-filter: blur(6px);
    font-size: 0.75rem;
    font-weight: 650;
    line-height: 1;

    svg {
      width: 14px;
      height: 14px;
    }
  }

  .batch-select {
    top: 8px;
    left: 8px;
    display: grid;
    width: 30px;
    height: 30px;
    place-items: center;
    padding: 0;
    color: var(--pf-muted);
    background: color-mix(in srgb, var(--pf-surface) 88%, transparent);
    border: 1px solid color-mix(in srgb, var(--pf-line) 82%, transparent);
    border-radius: 10px;
    box-shadow: 0 3px 12px rgb(35 20 29 / 18%);
    cursor: pointer;
    backdrop-filter: blur(8px);

    span {
      width: 13px;
      height: 13px;
      border: 1.5px solid currentcolor;
      border-radius: 4px;
    }

    svg {
      width: 17px;
      height: 17px;
    }

    &.selected {
      color: #fff;
      background: var(--pf-pink);
      border-color: var(--pf-pink);
    }
  }

  .bookmark {
    bottom: 0.4rem;
    right: 0.4rem;
    font-size: 1.2rem;
    color: #fff;

    &.bookmarked {
      color: var(--pf-pink);
    }
  }
}

.artwork-card--selected {
  .artwork-image {
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-pink) 72%, transparent);
  }
}

.artwork-card--selectable {
  cursor: pointer;

  .artwork-image a,
  .artwork-info a {
    cursor: pointer;
  }
}

.artwork-info {
  .author {
    .avatar {
      display: inline-block;
      flex: 0 0 auto;
      width: 22px;
      height: 22px;
      margin-right: 7px;
      object-fit: cover;
      border: 0;
      border-radius: 999px;
    }

    a {
      display: inline-flex;
      align-items: center;
      max-width: 100%;
    }
  }
}
</style>
