<template lang="pug">
.ranking-carousel(@mouseenter='pause' @mouseleave='resume')
  .featured-heading
    strong
      ITablerSparkles(aria-hidden='true')
      | 今日推荐
  .slides
    RouterLink.slide(
      :class='{ active: i === current }',
      :key='artwork.id',
      :to='"/artworks/" + artwork.id'
      v-for='(artwork, i) in artworks'
    )
      DeferLoad.slide-bg(:src='getImageUrl(artwork)')
      ArtworkViewedOverlay(:artwork-id='artwork.id')
      .slide-overlay
      .slide-content
        .slide-title(:style='titleStyle(artwork.id)') {{ artwork.title }}
        .slide-meta
          span.author by {{ artwork.userName }}
          span.views
            ITablerEye
            | {{ formatCount(artwork.viewCount) }}
  .controls
    button.arrow.prev(@click='prev' aria-label='上一张')
      ITablerChevronLeft
    .dots
      button.dot(
        :aria-label='"第 " + (i + 1) + " 张"',
        :class='{ active: i === current }',
        :key='i'
        @click='goTo(i)'
        v-for='(_, i) in artworks'
      )
    button.arrow.next(@click='next' aria-label='下一张')
      ITablerChevronRight
</template>

<script lang="ts" setup>
import DeferLoad from '~/components/DeferLoad.vue'
import { toRegularUrl } from '~/utils/pximg'
import {
  IconChevronLeft as ITablerChevronLeft,
  IconChevronRight as ITablerChevronRight,
  IconEye as ITablerEye,
  IconSparkles as ITablerSparkles,
} from '@tabler/icons-vue'
import type { RankedArtworkInfo } from '~/types'
import { useLocalPersistenceStore } from '~/stores/local-persistence'

const props = defineProps<{ artworks: RankedArtworkInfo[] }>()
const localPersistence = useLocalPersistenceStore()

const current = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

function getImageUrl(artwork: RankedArtworkInfo): string {
  return toRegularUrl(artwork.url)
}

function titleStyle(id: string | number) {
  if (
    !localPersistence.isArtworkViewed(id) ||
    !localPersistence.viewedMarker.markArtworkTitle
  ) {
    return undefined
  }
  const { r, g, b, a } = localPersistence.viewedMarker.artworkVisitedColor
  return { color: `rgb(${r} ${g} ${b} / ${a})` }
}

watch(
  () => props.artworks,
  (items) => {
    void localPersistence
      .ensureArtworkVisits(items.map((item) => item.id))
      .catch(() => {})
  },
  { immediate: true }
)

function next() {
  if (!props.artworks.length) return
  current.value = (current.value + 1) % props.artworks.length
}

function prev() {
  if (!props.artworks.length) return
  current.value =
    (current.value - 1 + props.artworks.length) % props.artworks.length
}

function goTo(i: number) {
  current.value = i
}

function startTimer() {
  timer = setInterval(next, 5000)
}

function pause() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function resume() {
  if (!timer) startTimer()
}

function formatCount(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return String(n)
}

onMounted(startTimer)
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped lang="scss">
.ranking-carousel {
  position: relative;
  overflow: hidden;
  height: 360px;
  color: var(--pf-text);
  background: #dfeaf7;
  border: 1px solid var(--pf-line);
  border-radius: 20px;
  box-shadow: var(--pf-card-shadow);
  max-width: 100%;
  box-sizing: border-box;
}

.featured-heading {
  position: absolute;
  z-index: 4;
  top: 20px;
  left: 20px;
  display: block;
  max-width: calc(100% - 40px);
  text-shadow: 0 1px 12px rgb(255 255 255 / 80%);

  strong {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 1.125rem;
    font-weight: 700;

    svg {
      width: 18px;
      height: 18px;
      color: var(--pf-pink);
    }
  }
}

.slides {
  position: relative;
  width: 100%;
  height: 100%;
}

.slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.5s ease;
  display: flex;
  align-items: flex-end;
  text-decoration: none;
  color: #fff;

  &.active {
    opacity: 1;
    z-index: 1;
  }
}

.slide-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.slide :deep(.artwork-viewed-overlay) {
  z-index: 1;
}

.slide-overlay {
  position: absolute;
  inset: 0;
  background: rgb(19 31 44 / 12%);
  z-index: 1;
}

.slide-content {
  position: relative;
  z-index: 2;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 12px 18px;
  width: 100%;
  color: #fff;
  background: linear-gradient(
    to top,
    rgb(10 13 20 / 78%),
    rgb(10 13 20 / 42%),
    transparent
  );

  .slide-title {
    min-width: 0;
    font-size: 1rem;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slide-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    color: rgb(255 255 255 / 82%);
    font-size: 0.75rem;

    .views {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
  }
}

.controls {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  pointer-events: none;
  transform: translateY(-50%);
}

.arrow {
  width: 38px;
  height: 38px;
  padding: 0;
  color: #765c78;
  background: rgb(255 255 255 / 84%);
  border: 1px solid rgb(255 255 255 / 90%);
  border-radius: 999px;
  box-shadow: 0 4px 18px rgb(67 41 68 / 12%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  pointer-events: auto;
  transition:
    background 150ms ease,
    transform 150ms ease;

  &:hover {
    color: #fff;
    background: var(--pf-pink);
    transform: scale(1.04);
  }
}

.dots {
  position: absolute;
  top: 112px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 7px;
  pointer-events: auto;
  transform: translateX(-50%);
}

.dot {
  width: 7px;
  height: 7px;
  border: 0;
  border-radius: 999px;
  background: rgb(255 255 255 / 70%);
  padding: 0;
  cursor: pointer;
  box-shadow: none;
  transition:
    background 150ms ease,
    transform 150ms ease;

  &.active {
    width: 9px;
    height: 9px;
    background: var(--pf-pink);
  }

  &:hover {
    background: #fff;
    transform: scale(1.15);
  }
}

@media (max-width: 720px) {
  .ranking-carousel {
    height: 320px;
  }

  .featured-heading {
    top: 16px;
    left: 16px;
  }

  .slide-content {
    gap: 10px;
    padding: 10px 14px;

    .slide-meta .author {
      display: none;
    }
  }
}
</style>
