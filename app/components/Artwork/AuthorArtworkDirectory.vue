<template lang="pug">
section.author-artwork-directory
  .directory-heading
    .directory-status
      span.directory-badge.directory-badge--position(title='当前作品在作者作品中的位置')
        ITablerPosition(aria-hidden='true')
        strong {{ currentPositionLabel }} / {{ totalArtworkCount }}
      span.directory-badge.directory-badge--page(
        :title='mode === "page" ? "当前目录页" : "已载入目录页"'
      )
        ITablerPages(aria-hidden='true')
        span {{ mode === 'page' ? '页码' : '已载入' }}
        strong {{ mode === 'page' ? currentPage : scrollPage }} / {{ totalPages }}
    .directory-tools
      button.locate-current(
        :disabled='!currentArtworkPosition'
        @click='locateCurrentArtwork'
        aria-label='定位当前作品'
        title='定位当前作品'
        type='button'
      )
        ITablerLocate(aria-hidden='true')
      .browse-switch(aria-label='目录浏览模式')
        button(
          :class='{ active: mode === "scroll" }'
          @click='setMode("scroll")'
          type='button'
        )
          ITablerMouse(aria-hidden='true')
          | 滚动
        button(
          :class='{ active: mode === "page" }'
          @click='setMode("page")'
          type='button'
        )
          ITablerBook(aria-hidden='true')
          | 翻页

  .directory-state(v-if='initialLoading')
    .directory-grid
      .directory-card.directory-card--loading(
        :key='index'
        v-for='index in pageSize'
      )
        FnbSkeleton(block height='100%' width='100%')
  .directory-state.directory-state--error(v-else-if='error') {{ error }}
  .directory-state.directory-state--empty(v-else-if='!entries.length') 作者暂时没有可展示作品
  template(v-else)
    .directory-viewport(
      :class='{ "is-page": mode === "page", "is-scroll": mode === "scroll" }'
      @scroll.passive='handleScroll'
      @wheel='handleWheel'
      ref='viewportRef'
    )
      .directory-grid
        RouterLink.directory-card(
          :aria-current='artwork.id === currentArtworkId ? "page" : undefined',
          :class='{ "is-current": artwork.id === currentArtworkId }',
          :data-current-artwork='artwork.id === currentArtworkId ? "true" : undefined',
          :key='artwork.id',
          :to='artworkRoute(artwork.id)'
          @mousedown='rememberArtworkScroll($event, artwork.id)'
          v-for='artwork in displayedArtworks'
        )
          .directory-cover
            DeferLoad(
              :alt='artwork.alt || artwork.title',
              :src='artwork.url'
              lazyload
            )
            ArtworkViewedOverlay(:artwork-id='artwork.id')
            span.directory-page-count(
              :aria-label='`${artwork.pageCount} 张图片`'
              v-if='artwork.pageCount > 1'
            )
              ITablerPageCount(aria-hidden='true')
              | {{ artwork.pageCount }}
</template>

<script lang="ts" setup>
import DeferLoad from '~/components/DeferLoad.vue'
import type { ArtworkInfo } from '~/types'
import {
  buildAuthorArtworkEntries,
  getAuthorArtworkPage,
  getAuthorArtworkPositionPage,
  getWheelPageTarget,
  orderAuthorArtworkPage,
  type AuthorArtworkEntry,
} from '~/utils/refineModernArtwork'
import {
  IconBook2 as ITablerBook,
  IconCurrentLocation as ITablerPosition,
  IconCopy as ITablerPageCount,
  IconFiles as ITablerPages,
  IconMouse as ITablerMouse,
  IconTargetArrow as ITablerLocate,
} from '@tabler/icons-vue'
import {
  artworkDirectoryScrollKey,
  serializeArtworkDirectoryScroll,
} from '~/utils/artworkDirectoryNavigation'
import { useLocalPersistenceStore } from '~/stores/local-persistence'

const props = defineProps<{
  userId: string
  currentArtworkId: string
}>()

const pageSize = 6
const pixivClient = usePixivClient()
const localPersistence = useLocalPersistenceStore()
const entries = ref<AuthorArtworkEntry[]>([])
const currentArtworkPosition = ref<number | null>(null)
const totalArtworkCount = ref(0)
const pageCache = ref<Record<number, ArtworkInfo[]>>({})
const currentPage = ref(1)
const scrollPage = ref(1)
const mode = ref<'scroll' | 'page'>('page')
const initialLoading = ref(false)
const error = ref('')
const viewportRef = ref<HTMLElement | null>(null)
const pageLoads = new Map<number, Promise<void>>()
let wheelLocked = false
let wheelTimer: ReturnType<typeof setTimeout> | undefined
let directoryRequestId = 0

const totalPages = computed(() =>
  Math.max(1, Math.ceil(entries.value.length / pageSize))
)
const currentPositionLabel = computed(
  () => currentArtworkPosition.value?.toString() || '—'
)
const currentArtworkPage = computed(() =>
  getAuthorArtworkPositionPage(currentArtworkPosition.value, pageSize)
)
const displayedArtworks = computed(() => {
  if (mode.value === 'page') {
    return pageCache.value[currentPage.value] || []
  }

  return Array.from({ length: scrollPage.value }, (_, index) => index + 1)
    .flatMap((page) => pageCache.value[page] || [])
    .filter(
      (artwork, index, list) =>
        list.findIndex((item) => item.id === artwork.id) === index
    )
})

watch(
  displayedArtworks,
  (artworks) => {
    void localPersistence
      .ensureArtworkVisits(artworks.map((artwork) => artwork.id))
      .catch(() => {})
  },
  { immediate: true }
)

function preloadArtworkCovers(artworks: ArtworkInfo[]) {
  if (!import.meta.client) return

  for (const artwork of artworks) {
    if (!artwork.url) continue
    const image = new Image()
    image.decoding = 'async'
    image.src = artwork.url
  }
}

async function loadPage(
  page: number,
  requestId = directoryRequestId
): Promise<void> {
  if (page < 1 || page > totalPages.value || pageCache.value[page]) {
    return
  }

  const pending = pageLoads.get(page)
  if (pending) return pending

  const pageEntries = getAuthorArtworkPage(entries.value, page, pageSize)
  if (!pageEntries.length) return

  const request = (async () => {
    const grouped = pageEntries.reduce(
      (result, entry) => {
        result[entry.category].push(entry.id)
        return result
      },
      { illust: [] as string[], manga: [] as string[] }
    )
    const [illusts, mangas] = await Promise.all([
      grouped.illust.length
        ? pixivClient.getUserIllusts(props.userId, grouped.illust, 'illust')
        : Promise.resolve({}),
      grouped.manga.length
        ? pixivClient.getUserIllusts(props.userId, grouped.manga, 'manga')
        : Promise.resolve({}),
    ])
    if (requestId !== directoryRequestId) return

    const artworks = orderAuthorArtworkPage(pageEntries, {
      ...illusts,
      ...mangas,
    })
    pageCache.value = {
      ...pageCache.value,
      [page]: artworks,
    }
    preloadArtworkCovers(artworks)
  })()

  pageLoads.set(page, request)
  try {
    await request
  } finally {
    if (pageLoads.get(page) === request) {
      pageLoads.delete(page)
    }
  }
}

async function preloadAdjacentPages(
  page: number,
  requestId = directoryRequestId
) {
  const adjacentPages = [page - 1, page + 1].filter(
    (item) => item >= 1 && item <= totalPages.value
  )
  await Promise.allSettled(
    adjacentPages.map((item) => loadPage(item, requestId))
  )
}

async function initializeDirectory(): Promise<void> {
  const requestId = ++directoryRequestId
  pageLoads.clear()
  entries.value = []
  currentArtworkPosition.value = null
  totalArtworkCount.value = 0
  pageCache.value = {}
  currentPage.value = 1
  scrollPage.value = 1
  mode.value = 'page'
  error.value = ''
  initialLoading.value = true

  try {
    const profile = await pixivClient.getUserProfileAll(props.userId)
    if (requestId !== directoryRequestId) return

    const allEntries = buildAuthorArtworkEntries(profile)
    totalArtworkCount.value = allEntries.length
    const currentIndex = allEntries.findIndex(
      (entry) => entry.id === props.currentArtworkId
    )
    currentArtworkPosition.value = currentIndex >= 0 ? currentIndex + 1 : null
    entries.value = allEntries
    const initialPage = getAuthorArtworkPositionPage(
      currentArtworkPosition.value,
      pageSize
    )
    currentPage.value = initialPage
    await loadPage(initialPage, requestId)
    if (requestId !== directoryRequestId) return
    void preloadAdjacentPages(initialPage, requestId)
  } catch {
    if (requestId === directoryRequestId) {
      error.value = '作者作品加载失败，请稍后重试'
    }
  } finally {
    if (requestId === directoryRequestId) {
      initialLoading.value = false
    }
  }
}

async function changePage(page: number): Promise<void> {
  const requestId = directoryRequestId
  const target = Math.min(Math.max(page, 1), totalPages.value)
  try {
    await loadPage(target, requestId)
  } catch {
    return
  }
  if (requestId !== directoryRequestId || !pageCache.value[target]) return

  currentPage.value = target
  viewportRef.value?.scrollTo({ top: 0 })
  void preloadAdjacentPages(target, requestId)
}

function artworkRoute(id: string) {
  return {
    path: `/artworks/${id}`,
    state: {
      preserveArtworkScroll: true,
    },
  }
}

function rememberArtworkScroll(event: MouseEvent, artworkId: string): void {
  if (!import.meta.client || (event.button !== 0 && event.button !== 1)) return

  try {
    localStorage.setItem(
      artworkDirectoryScrollKey(artworkId),
      serializeArtworkDirectoryScroll(window.scrollY)
    )
  } catch {
    // Navigation must remain usable when browser storage is unavailable.
  }
}

async function locateCurrentArtwork(): Promise<void> {
  if (!currentArtworkPosition.value) return

  const targetPage = currentArtworkPage.value
  if (mode.value === 'page') {
    await changePage(targetPage)
    return
  }

  const requestId = directoryRequestId
  await Promise.allSettled(
    Array.from({ length: targetPage }, (_, index) => index + 1).map((page) =>
      loadPage(page, requestId)
    )
  )
  if (requestId !== directoryRequestId) return

  scrollPage.value = Math.max(scrollPage.value, targetPage)
  await nextTick()
  const currentCard = viewportRef.value?.querySelector<HTMLElement>(
    '[data-current-artwork="true"]'
  )
  if (!currentCard) return

  viewportRef.value?.scrollTo({
    top: Math.max(currentCard.offsetTop - 8, 0),
    behavior: 'smooth',
  })
}

async function setMode(nextMode: 'scroll' | 'page'): Promise<void> {
  if (mode.value === nextMode) return
  mode.value = nextMode

  if (nextMode === 'scroll') {
    const target = Math.min(
      totalPages.value,
      Math.max(2, scrollPage.value, currentPage.value)
    )
    await Promise.allSettled(
      Array.from({ length: target }, (_, index) => index + 1).map((page) =>
        loadPage(page)
      )
    )
    scrollPage.value = target
  } else {
    try {
      await loadPage(currentPage.value)
      void preloadAdjacentPages(currentPage.value)
    } catch {
      return
    }
  }
  await nextTick()
  viewportRef.value?.scrollTo({ top: 0 })
}

async function handleScroll(event: Event): Promise<void> {
  if (mode.value !== 'scroll') return
  const target = event.currentTarget as HTMLElement
  const isNearEnd =
    target.scrollTop + target.clientHeight >= target.scrollHeight - 80
  if (!isNearEnd || scrollPage.value >= totalPages.value) return

  const nextPage = scrollPage.value + 1
  try {
    await loadPage(nextPage)
  } catch {
    return
  }
  if (!pageCache.value[nextPage]) return

  scrollPage.value = nextPage
  void preloadAdjacentPages(nextPage)
}

async function handleWheel(event: WheelEvent): Promise<void> {
  if (mode.value !== 'page') return
  event.preventDefault()
  event.stopPropagation()

  const target = getWheelPageTarget(
    currentPage.value,
    totalPages.value,
    event.deltaY
  )
  if (target === currentPage.value) return

  if (wheelLocked) return

  wheelLocked = true
  await changePage(target)
  wheelTimer = setTimeout(() => {
    wheelLocked = false
  }, 360)
}

watch(() => [props.userId, props.currentArtworkId], initializeDirectory, {
  immediate: true,
})

onBeforeUnmount(() => {
  if (wheelTimer) clearTimeout(wheelTimer)
})
</script>

<style scoped lang="scss">
.author-artwork-directory {
  display: grid;
  gap: 12px;
}

.directory-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.directory-status {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
}

.directory-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 0 9px;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 650;

  svg {
    width: 15px;
    height: 15px;
    flex: 0 0 auto;
  }

  span {
    opacity: 0.78;
  }

  strong {
    font-family: var(--fnb-font-mono);
    font-size: 0.72rem;
    font-weight: 750;
  }

  &--position {
    color: var(--modern-pink-strong);
    background: var(--modern-soft-pink);
  }

  &--page {
    color: var(--modern-text-soft);
    background: var(--modern-soft-panel);
  }
}

.directory-tools {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 0 auto;
}

.locate-current {
  display: grid;
  width: 32px;
  height: 32px;
  padding: 0;
  color: var(--modern-pink-strong);
  background: var(--modern-soft-pink);
  border: 0;
  border-radius: 10px;
  cursor: pointer;
  place-items: center;

  &:hover,
  &:focus-visible {
    color: #fff;
    background: var(--modern-pink);
    outline: 0;
  }

  &:focus-visible {
    box-shadow:
      0 0 0 2px var(--modern-surface),
      0 0 0 4px var(--modern-pink);
  }

  &:disabled {
    cursor: default;
    opacity: 0.45;
  }

  svg {
    width: 17px;
    height: 17px;
  }
}

.directory-viewport {
  min-width: 0;

  &.is-scroll {
    max-height: var(--directory-grid-height, 740px);
    padding-right: 6px;
    overflow-y: scroll;
    overscroll-behavior: contain;
    scrollbar-color: var(--modern-pink) transparent;
    scrollbar-gutter: stable;
    scrollbar-width: thin;

    &::-webkit-scrollbar {
      width: 8px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: color-mix(in srgb, var(--modern-pink) 62%, transparent);
      border-radius: 999px;
    }
  }

  &.is-page {
    overflow: hidden;
  }
}

.directory-grid {
  display: grid;
  grid-template-columns: repeat(
    2,
    min(var(--directory-card-size, 240px), calc((100% - 10px) / 2))
  );
  gap: 10px;
  justify-content: center;
}

.directory-card {
  min-width: 0;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--modern-skeleton);
  border: 2px solid transparent;
  border-radius: 14px;
  box-shadow: 0 3px 12px rgb(94 59 80 / 8%);
  text-decoration: none;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease,
    transform 150ms ease;

  &:hover,
  &:focus-visible {
    border-color: var(--modern-pink);
    box-shadow: 0 6px 18px rgb(214 80 145 / 18%);
    outline: 0;
    transform: translateY(-2px);
  }

  &.is-current {
    border-color: var(--modern-pink);
    box-shadow: 0 0 0 3px var(--modern-soft-pink);
  }

  &--loading {
    border: 0;
    box-shadow: none;
  }
}

.directory-cover {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 12px;
  background: var(--modern-skeleton);

  :deep(img),
  :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.directory-page-count {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-height: 24px;
  padding: 2px 7px;
  color: #fff;
  background: rgb(22 23 28 / 72%);
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 750;
  line-height: 1;
  pointer-events: none;
  z-index: 5;
  backdrop-filter: blur(5px);

  svg {
    width: 13px;
    height: 13px;
  }
}

.directory-state {
  min-height: 180px;
  color: var(--modern-muted);
  font-size: 0.82rem;
  text-align: center;

  &--error,
  &--empty {
    display: grid;
    place-items: center;
  }
}

.browse-switch {
  display: flex;
  align-items: center;
  gap: 4px;
  flex: 0 0 auto;
  padding: 2px;
  background: var(--modern-soft-panel);
  border-radius: 9px;

  button {
    display: inline-flex;
    flex: 1;
    align-items: center;
    justify-content: center;
    gap: 5px;
    min-width: 60px;
    min-height: 28px;
    color: var(--modern-muted);
    background: transparent;
    border: 0;
    border-radius: 7px;
    cursor: pointer;
    font: inherit;
    font-size: 0.75rem;
    font-weight: 650;

    svg {
      width: 15px;
      height: 15px;
    }

    &.active {
      color: #fff;
      background: var(--modern-pink);
    }

    &:focus-visible {
      outline: 2px solid var(--modern-pink);
      outline-offset: 1px;
    }
  }
}

@media (max-width: 520px) {
  .directory-heading {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .directory-status {
    flex-wrap: wrap;
  }

  .directory-tools {
    width: 100%;
    justify-content: flex-end;
  }

  .browse-switch button {
    min-width: 44px;

    svg {
      display: none;
    }
  }
}
</style>
