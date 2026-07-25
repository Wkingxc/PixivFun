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
  .artwork-card.fnb-media-card(v-else-if='item')
    .artwork-image.fnb-media-card__media
      .side-tags
        .page-count(
          :title='"共 " + item.pageCount + " 张"'
          v-if='item.pageCount > 1'
        )
          ITablerCopy(aria-hidden='true')
          | {{ item.pageCount }}
        button.bookmark(
          :aria-label='item.bookmarkData ? "取消收藏" : "添加收藏"',
          :class='{ bookmarked: item.bookmarkData, disabled: loadingBookmark }',
          :title='item.bookmarkData ? "取消收藏" : "添加收藏"'
          @click.stop.prevent='handleBookmark'
        )
          IFasHeart(aria-hidden='true')
      RouterLink(:to='workLink')
        DeferLoad.img(
          :alt='item.alt',
          :src='item.url',
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
        RouterLink(:style='titleStyle', :to='workLink') {{ item.title }}
      .author.fnb-media-card__author(:title='item.userName')
        RouterLink(:to='"/users/" + item.userId')
          img.avatar(:src='item.profileImageUrl' lazyload)
          | {{ item.userName }}
</template>

<script lang="ts" setup>
import DeferLoad from '../DeferLoad.vue'
import { IllustType } from '~/utils/constants'
import { toRef } from 'vue'
import IFasHeart from '~icons/fa-solid/heart'
import IPlayCircle from '~icons/fa-solid/play-circle'
import { IconCopyFilled as ITablerCopy } from '@tabler/icons-vue'
import type { ArtworkInfo } from '~/types'

import { useArtworkStore } from '~/stores/artwork'

const props = defineProps<{
  item?: ArtworkInfo
  loading?: boolean
  imageZoom?: boolean
  markerDisabled?: boolean
}>()

const item = toRef(props, 'item')
const loading = toRef(props, 'loading')

const artworkStore = useArtworkStore()
const { markTitle, titleStyle } = useArtworkViewedState(
  () => item.value?.id,
  () => !!props.markerDisabled || item.value?.type === 'novel'
)
const workLink = computed(() =>
  item.value?.type === 'novel'
    ? `/novels/${item.value.id}`
    : `/artworks/${item.value?.id}`
)

const loadingBookmark = ref(false)
async function handleBookmark() {
  if (loadingBookmark.value) return
  loadingBookmark.value = true
  const it = item.value!
  try {
    if (it.bookmarkData) {
      await artworkStore.removeBookmark(it.bookmarkData.id)
      if (item.value) item.value.bookmarkData = null
    } else {
      const data = await artworkStore.addBookmark(it.id)
      if (data.last_bookmark_id && item.value) {
        item.value.bookmarkData = { id: data.last_bookmark_id, private: false }
      }
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
    border-radius: var(--fnb-radius-sm);
    &:hover {
      background-color: rgba(255, 100, 100, 0.2);
    }
    &:focus-visible {
      outline: 2px solid var(--fnb-brand);
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
    box-shadow: 0 0 0 2px var(--fnb-divider);

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

  .bookmark {
    bottom: 0.4rem;
    right: 0.4rem;
    font-size: 1.2rem;
    color: #fff;

    &.bookmarked {
      color: var(--fnb-bookmark);
    }
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
