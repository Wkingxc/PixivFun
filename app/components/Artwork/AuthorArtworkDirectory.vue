<template lang="pug">
section.author-artwork-directory
  .directory-heading
    .directory-status
      span.directory-badge.directory-badge--position(title='当前作品在作者作品中的位置')
        ITablerPosition(aria-hidden='true')
        strong {{ currentPositionLabel }} / {{ totalArtworkCount }}
      span.directory-badge.directory-badge--page(
        :title='mode === "scroll" ? "当前滚动位置" : "当前目录页"'
      )
        ITablerPages(aria-hidden='true')
        span {{ mode === 'scroll' ? '位置' : mode === 'quick-page' ? '目标' : '页码' }}
        strong {{ displayedDirectoryPage }} / {{ totalPages }}
    .directory-tools
      button.locate-current(
        :disabled='!currentDirectoryPosition'
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
        button(
          :class='{ active: mode === "quick-page" }'
          @click='setMode("quick-page")'
          aria-label='快速翻页'
          title='快速翻页：连续滚轮可累计跨页'
          type='button'
        )
          ITablerQuick(aria-hidden='true')
          | 快速

  .directory-batch-controls(
    v-if='mode === "scroll" && !initialLoading && !filterIndexing && !error && totalPages > scrollBatchSize'
  )
    button(
      :disabled='scrollBatchStartPage <= 1'
      @click='showPreviousScrollBatch'
      type='button'
    ) 上一批
    span 第 {{ scrollBatchStartPage }}–{{ scrollBatchEndPage }} 页
    button(
      :disabled='scrollBatchEndPage >= totalPages'
      @click='showNextScrollBatch'
      type='button'
    ) 下一批

  .directory-state(v-if='initialLoading')
    .directory-grid
      .directory-card.directory-card--loading(
        :key='index'
        v-for='index in pageSize'
      )
        FnbSkeleton(block height='100%' width='100%')
  .directory-state.directory-state--indexing(v-else-if='filterIndexing')
    div
      strong 正在建立筛选目录
      span {{ filterProgressLabel }}
  .directory-state.directory-state--error(v-else-if='error') {{ error }}
  .directory-state.directory-state--empty(v-else-if='!entries.length') 作者暂时没有可展示作品
  .directory-state.directory-state--empty(v-else-if='!directoryEntries.length')
    | 没有符合“过滤页数”条件的作品
  template(v-else)
    .directory-scroll-shell(:class='{ "is-scroll": mode === "scroll" }')
      .directory-viewport(
        :class='{ "is-page": mode !== "scroll", "is-scroll": mode === "scroll" }'
        @scroll.passive='handleScroll'
        @wheel='handleWheel'
        ref='viewportRef'
      )
        .directory-grid
          RouterLink.directory-card(
            :aria-current='item.entry.id === currentArtworkId ? "page" : undefined',
            :aria-label='item.artwork?.title || `作品 ${item.entry.id}`',
            :class='{ "is-current": item.entry.id === currentArtworkId, "directory-card--placeholder": !item.artwork }',
            :data-current-artwork='item.entry.id === currentArtworkId ? "true" : undefined',
            :key='item.entry.id',
            :to='artworkRoute(item.entry.id)'
            @mousedown='handleArtworkPointerDown($event, item.entry.id)'
            v-for='item in displayedDirectoryItems'
          )
            .directory-cover(
              :class='{ "directory-cover--pending": !item.artwork }'
            )
              DeferLoad(
                :alt='item.artwork?.alt || item.artwork?.title || ""',
                :src='item.artwork?.url || ""'
                lazyload
                v-if='item.artwork'
              )
              ArtworkViewedOverlay(
                :artwork-id='item.entry.id',
                :disabled='item.entry.id === currentArtworkId'
                v-if='item.artwork'
              )
              span.directory-ugoira(
                aria-label='动图'
                title='动图'
                v-if='item.artwork?.illustType === IllustType.UGOIRA'
              )
                IPlayCircle(aria-hidden='true')
              span.directory-page-count(
                :aria-label='`${item.artwork.pageCount} 张图片`'
                v-if='item.artwork && item.artwork.pageCount > 1'
              )
                ITablerPageCount(aria-hidden='true')
                | {{ item.artwork.pageCount }}
      .directory-scroll-control(
        @pointerdown='handleScrollTrackPointerDown'
        ref='scrollTrackRef'
        v-if='mode === "scroll"'
      )
        button.directory-scroll-thumb(
          :aria-valuemax='scrollBatchEndPage',
          :aria-valuemin='scrollBatchStartPage',
          :aria-valuenow='scrollPage',
          :aria-valuetext='`第 ${scrollPage} 页`',
          :class='{ "is-dragging": scrollThumbDragging }',
          :style='{ "--directory-scroll-position": `${scrollThumbRatio * 100}%`, "--directory-scroll-shift": `${scrollThumbRatio * -100}%` }'
          @keydown='handleScrollThumbKeydown'
          @pointercancel='finishScrollThumbDrag'
          @pointerdown.stop='startScrollThumbDrag'
          @pointermove='moveScrollThumbDrag'
          @pointerup='finishScrollThumbDrag'
          aria-label='拖动定位作品页'
          aria-orientation='vertical'
          role='slider'
          title='拖动定位作品页'
          type='button'
        )
</template>

<script lang="ts" setup>
import DeferLoad from '~/components/DeferLoad.vue'
import type { ArtworkInfo } from '~/types'
import { IllustType } from '~/utils/constants'
import IPlayCircle from '~icons/fa-solid/play-circle'
import {
  buildAuthorArtworkEntries,
  getAuthorArtworkPage,
  getAuthorArtworkPositionPage,
  getWheelPageTarget,
  type AuthorArtworkEntry,
} from '~/utils/refineModernArtwork'
import {
  IconBook2 as ITablerBook,
  IconBolt as ITablerQuick,
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
import { shouldRecordArtworkVisitGesture } from '~/utils/linkGestures'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import { filterArtworksByPageCount } from '~/utils/artworkLayout'
import {
  ARTWORK_DIRECTORY_DEFAULT_MODE,
  ARTWORK_DIRECTORY_MODE_STORAGE_KEY,
  ARTWORK_DIRECTORY_SCROLL_BATCH_PAGES,
  chunkArtworkDirectoryEntries,
  getArtworkDirectoryBatchEndPage,
  getArtworkDirectoryBatchStartPage,
  getArtworkDirectoryPageScrollTop,
  getArtworkDirectoryPointerRatio,
  getArtworkDirectoryScrollPage,
  normalizeArtworkDirectoryMode,
  type ArtworkDirectoryMode,
} from '~/utils/artworkDirectoryBrowse'

const props = defineProps<{
  userId: string
  currentArtworkId: string
}>()

const pageSize = 6
const pixivClient = usePixivClient()
const localPersistence = useLocalPersistenceStore()
const { normalizedMinPageCount } = useArtworkLayoutSettings()
const entries = ref<AuthorArtworkEntry[]>([])
const currentArtworkPosition = ref<number | null>(null)
const totalArtworkCount = ref(0)
const artworkCache = ref<Record<string, ArtworkInfo>>({})
const currentPage = ref(1)
const scrollPage = ref(1)
const scrollBatchStartPage = ref(1)
const scrollBatchSize = ARTWORK_DIRECTORY_SCROLL_BATCH_PAGES
const storedMode = useLocalStorage<string>(
  ARTWORK_DIRECTORY_MODE_STORAGE_KEY,
  ARTWORK_DIRECTORY_DEFAULT_MODE
)
const mode = computed<ArtworkDirectoryMode>({
  get: () => normalizeArtworkDirectoryMode(storedMode.value),
  set: (value) => {
    storedMode.value = value
  },
})
const initialLoading = ref(false)
const filterIndexing = ref(false)
const filterResolvedCount = ref(0)
const error = ref('')
const viewportRef = ref<HTMLElement | null>(null)
const scrollTrackRef = ref<HTMLElement | null>(null)
const scrollThumbRatio = ref(0)
const scrollThumbDragging = ref(false)
const scrollThumbSize = 48
const metadataLoads = new Map<string, Promise<void>>()
const resolvedMetadataIds = new Set<string>()
const quickPageTarget = ref(1)
let wheelLocked = false
let wheelTimer: ReturnType<typeof setTimeout> | undefined
let quickPageTimer: ReturnType<typeof setTimeout> | undefined
let scrollLoadFrame = 0
let queuedScrollPage: number | null = null
let scrollLoadRunning = false
let scrollBatchTransitioning = false
let scrollThumbPointerId: number | null = null
let scrollThumbPointerOffset = 0
let directoryRequestId = 0
let filterRequestId = 0

const directoryEntries = computed(() => {
  if (normalizedMinPageCount.value <= 0) return entries.value
  const artworks = entries.value.flatMap((entry) => {
    const artwork = artworkCache.value[entry.id]
    return artwork ? [artwork] : []
  })
  const visibleIds = new Set(
    filterArtworksByPageCount(artworks, normalizedMinPageCount.value).map(
      (artwork) => artwork.id
    )
  )
  return entries.value.filter((entry) => visibleIds.has(entry.id))
})

const totalPages = computed(() =>
  Math.max(1, Math.ceil(directoryEntries.value.length / pageSize))
)
const scrollBatchEndPage = computed(() =>
  getArtworkDirectoryBatchEndPage(
    scrollBatchStartPage.value,
    totalPages.value,
    scrollBatchSize
  )
)
const scrollBatchPageCount = computed(
  () => scrollBatchEndPage.value - scrollBatchStartPage.value + 1
)
const scrollBatchEntries = computed(() =>
  directoryEntries.value.slice(
    (scrollBatchStartPage.value - 1) * pageSize,
    scrollBatchEndPage.value * pageSize
  )
)
const currentPositionLabel = computed(
  () => currentArtworkPosition.value?.toString() || '—'
)
const currentArtworkPage = computed(() =>
  getAuthorArtworkPositionPage(currentDirectoryPosition.value, pageSize)
)
const currentDirectoryPosition = computed(() => {
  const index = directoryEntries.value.findIndex(
    (entry) => entry.id === props.currentArtworkId
  )
  return index >= 0 ? index + 1 : null
})
const displayedDirectoryPage = computed(() => {
  if (mode.value === 'scroll') return scrollPage.value
  if (mode.value === 'quick-page') return quickPageTarget.value
  return currentPage.value
})
const displayedEntries = computed(() => {
  if (mode.value === 'scroll') return scrollBatchEntries.value
  return getAuthorArtworkPage(
    directoryEntries.value,
    currentPage.value,
    pageSize
  )
})
const displayedDirectoryItems = computed(() =>
  displayedEntries.value.map((entry) => ({
    entry,
    artwork: artworkCache.value[entry.id],
  }))
)
const displayedArtworks = computed(() =>
  displayedDirectoryItems.value.flatMap((item) =>
    item.artwork ? [item.artwork] : []
  )
)
const filterProgressLabel = computed(
  () =>
    `${Math.min(filterResolvedCount.value, entries.value.length)} / ${entries.value.length}`
)

watch(
  displayedArtworks,
  (artworks) => {
    void localPersistence
      .ensureArtworkVisits(artworks.map((artwork) => artwork.id))
      .catch(() => {})
  },
  { immediate: true }
)

async function loadEntries(
  requestedEntries: readonly AuthorArtworkEntry[],
  requestId = directoryRequestId
): Promise<void> {
  const uniqueEntries = requestedEntries.filter(
    (entry, index, list) =>
      list.findIndex((item) => item.id === entry.id) === index
  )
  const pending = uniqueEntries.flatMap((entry) => {
    const request = metadataLoads.get(entry.id)
    return request ? [request] : []
  })
  const missing = uniqueEntries.filter(
    (entry) =>
      !resolvedMetadataIds.has(entry.id) && !metadataLoads.has(entry.id)
  )

  let request: Promise<void> | undefined
  if (missing.length) {
    request = (async () => {
      const grouped = missing.reduce(
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

      artworkCache.value = {
        ...artworkCache.value,
        ...illusts,
        ...mangas,
      }
      for (const entry of missing) resolvedMetadataIds.add(entry.id)
      filterResolvedCount.value = resolvedMetadataIds.size
    })()
    for (const entry of missing) metadataLoads.set(entry.id, request)
  }

  try {
    await Promise.all([...new Set([...pending, ...(request ? [request] : [])])])
  } finally {
    if (request) {
      for (const entry of missing) {
        if (metadataLoads.get(entry.id) === request) {
          metadataLoads.delete(entry.id)
        }
      }
    }
  }
}

async function loadPage(page: number, requestId = directoryRequestId) {
  if (page < 1 || page > totalPages.value) return
  await loadEntries(
    getAuthorArtworkPage(directoryEntries.value, page, pageSize),
    requestId
  )
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
  ++filterRequestId
  metadataLoads.clear()
  resolvedMetadataIds.clear()
  entries.value = []
  currentArtworkPosition.value = null
  totalArtworkCount.value = 0
  artworkCache.value = {}
  currentPage.value = 1
  quickPageTarget.value = 1
  filterResolvedCount.value = 0
  filterIndexing.value = false
  wheelLocked = false
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = undefined
  if (quickPageTimer) clearTimeout(quickPageTimer)
  quickPageTimer = undefined
  if (scrollLoadFrame) cancelAnimationFrame(scrollLoadFrame)
  scrollLoadFrame = 0
  queuedScrollPage = null
  scrollPage.value = 1
  scrollBatchStartPage.value = 1
  scrollBatchTransitioning = false
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
    quickPageTarget.value = initialPage
    await loadEntries(
      getAuthorArtworkPage(entries.value, initialPage, pageSize),
      requestId
    )
    if (requestId !== directoryRequestId) return

    initialLoading.value = false
    if (normalizedMinPageCount.value > 0) {
      await preparePageCountFilter(requestId)
      if (requestId !== directoryRequestId) return
    }

    const targetPage = currentArtworkPage.value
    currentPage.value = targetPage
    quickPageTarget.value = targetPage
    if (mode.value === 'scroll') {
      await nextTick()
      await scrollDirectoryToPage(targetPage)
    } else {
      await loadPage(targetPage, requestId)
      void preloadAdjacentPages(targetPage, requestId)
    }
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

async function preparePageCountFilter(
  requestId = directoryRequestId
): Promise<void> {
  if (normalizedMinPageCount.value <= 0 || !entries.value.length) return

  const runId = ++filterRequestId
  filterIndexing.value = true
  error.value = ''
  const chunks = chunkArtworkDirectoryEntries(
    entries.value.filter((entry) => !resolvedMetadataIds.has(entry.id)),
    48
  )
  let nextChunk = 0

  async function worker() {
    while (nextChunk < chunks.length) {
      const chunk = chunks[nextChunk++]
      await loadEntries(chunk, requestId)
      if (requestId !== directoryRequestId || runId !== filterRequestId) return
    }
  }

  try {
    await Promise.all([worker(), worker()])
  } catch {
    if (requestId === directoryRequestId && runId === filterRequestId) {
      error.value = '作品筛选目录加载失败，请稍后重试'
    }
    throw new Error('Artwork directory filter metadata failed to load')
  } finally {
    if (requestId === directoryRequestId && runId === filterRequestId) {
      filterIndexing.value = false
    }
  }
}

async function syncCurrentArtwork(): Promise<void> {
  if (!entries.value.length) return

  const currentIndex = entries.value.findIndex(
    (entry) => entry.id === props.currentArtworkId
  )
  currentArtworkPosition.value = currentIndex >= 0 ? currentIndex + 1 : null
  if (!currentDirectoryPosition.value) return

  const targetPage = currentArtworkPage.value
  if (mode.value === 'scroll') {
    await loadPage(targetPage)
    return
  }

  quickPageTarget.value = targetPage
  if (targetPage !== currentPage.value) {
    await changePage(targetPage)
  }
}

async function changePage(
  page: number,
  expectedQuickTarget?: number
): Promise<void> {
  const requestId = directoryRequestId
  const target = Math.min(Math.max(page, 1), totalPages.value)
  try {
    await loadPage(target, requestId)
  } catch {
    return
  }
  if (requestId !== directoryRequestId) return
  if (
    expectedQuickTarget !== undefined &&
    (mode.value !== 'quick-page' ||
      quickPageTarget.value !== expectedQuickTarget)
  ) {
    return
  }

  currentPage.value = target
  quickPageTarget.value = target
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

function handleArtworkPointerDown(event: MouseEvent, artworkId: string): void {
  rememberArtworkScroll(event, artworkId)

  // Mark both ordinary and new-view navigation immediately. The destination
  // page records again as a route-level fallback, and the store deduplicates it.
  if (shouldRecordArtworkVisitGesture(event)) {
    void localPersistence.recordArtworkVisit(artworkId).catch(() => {})
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
  if (!currentDirectoryPosition.value) return

  const targetPage = currentArtworkPage.value
  if (mode.value !== 'scroll') {
    quickPageTarget.value = targetPage
    await changePage(targetPage)
    return
  }

  await scrollDirectoryToPage(targetPage)
  await loadScrollWindow(targetPage)
  await nextTick()
  const currentCard = viewportRef.value?.querySelector<HTMLElement>(
    '[data-current-artwork="true"]'
  )
  if (!currentCard) return

  viewportRef.value?.scrollTo({
    top: Math.max(currentCard.offsetTop - 8, 0),
    behavior: 'smooth',
  })
  scrollPage.value = targetPage
}

async function scrollDirectoryToPage(
  page: number,
  behavior: ScrollBehavior = 'auto'
): Promise<void> {
  const target = Math.min(Math.max(1, page), totalPages.value)
  const batchStart = getArtworkDirectoryBatchStartPage(
    target,
    totalPages.value,
    scrollBatchSize
  )
  if (scrollBatchStartPage.value !== batchStart) {
    scrollBatchStartPage.value = batchStart
    await nextTick()
  }

  const viewport = viewportRef.value
  if (!viewport) return
  const localPage = target - scrollBatchStartPage.value + 1
  scrollPage.value = target
  scrollBatchTransitioning = true
  viewport.scrollTo({
    top: getArtworkDirectoryPageScrollTop(
      localPage,
      scrollBatchPageCount.value,
      viewport.scrollHeight,
      viewport.clientHeight
    ),
    behavior,
  })
  void loadScrollWindow(target)
  requestAnimationFrame(() => {
    scrollBatchTransitioning = false
  })
}

async function setMode(nextMode: ArtworkDirectoryMode): Promise<void> {
  if (mode.value === nextMode) return
  if (mode.value === 'scroll') {
    currentPage.value = scrollPage.value
  }
  mode.value = nextMode
  wheelLocked = false
  if (wheelTimer) clearTimeout(wheelTimer)
  wheelTimer = undefined
  if (quickPageTimer) clearTimeout(quickPageTimer)
  quickPageTimer = undefined
  if (scrollLoadFrame) cancelAnimationFrame(scrollLoadFrame)
  scrollLoadFrame = 0
  queuedScrollPage = null

  if (nextMode === 'scroll') {
    const target = Math.min(totalPages.value, Math.max(1, currentPage.value))
    await nextTick()
    await scrollDirectoryToPage(target)
  } else {
    try {
      const target = Math.min(totalPages.value, Math.max(1, currentPage.value))
      currentPage.value = target
      await loadPage(target)
      void preloadAdjacentPages(target)
      quickPageTarget.value = currentPage.value
    } catch {
      return
    }
    await nextTick()
    viewportRef.value?.scrollTo({ top: 0 })
  }
}

async function loadScrollWindow(page: number): Promise<void> {
  const pages = Array.from(
    { length: 5 },
    (_, index) => page + index - 2
  ).filter((item) => item >= 1 && item <= totalPages.value)
  await Promise.allSettled(pages.map((item) => loadPage(item)))
}

async function drainLiveScrollLoads(): Promise<void> {
  if (scrollLoadRunning) return
  scrollLoadRunning = true
  const requestId = directoryRequestId
  let lastLoadedPage: number | null = null

  try {
    while (
      requestId === directoryRequestId &&
      mode.value === 'scroll' &&
      queuedScrollPage !== null
    ) {
      const targetPage = queuedScrollPage
      queuedScrollPage = null
      lastLoadedPage = targetPage
      try {
        await loadPage(targetPage)
      } catch {
        // Keep following the latest thumb position even if one request fails.
      }
    }
  } finally {
    scrollLoadRunning = false
  }

  if (mode.value === 'scroll' && queuedScrollPage !== null) {
    void drainLiveScrollLoads()
    return
  }
  if (
    mode.value === 'scroll' &&
    lastLoadedPage !== null &&
    lastLoadedPage === scrollPage.value
  ) {
    void preloadAdjacentPages(lastLoadedPage)
  }
}

function scheduleLiveScrollLoad(page: number): void {
  queuedScrollPage = page
  if (scrollLoadFrame || scrollLoadRunning) return

  scrollLoadFrame = requestAnimationFrame(() => {
    scrollLoadFrame = 0
    void drainLiveScrollLoads()
  })
}

async function changeScrollBatch(page: number): Promise<void> {
  if (scrollBatchTransitioning) return
  const nextStart = getArtworkDirectoryBatchStartPage(
    page,
    totalPages.value,
    scrollBatchSize
  )
  if (nextStart === scrollBatchStartPage.value) return

  scrollBatchTransitioning = true
  scrollBatchStartPage.value = nextStart
  scrollPage.value = nextStart
  scrollThumbRatio.value = 0
  queuedScrollPage = nextStart
  await nextTick()
  viewportRef.value?.scrollTo({ top: 0, behavior: 'auto' })
  scheduleLiveScrollLoad(nextStart)
  requestAnimationFrame(() => {
    scrollBatchTransitioning = false
  })
}

function showPreviousScrollBatch(): void {
  void changeScrollBatch(scrollBatchStartPage.value - scrollBatchSize)
}

function showNextScrollBatch(): void {
  void changeScrollBatch(scrollBatchEndPage.value + 1)
}

function updateScrollFromPointer(pointerY: number, pointerOffset = 0): void {
  const track = scrollTrackRef.value
  const viewport = viewportRef.value
  if (!track || !viewport) return

  const trackBounds = track.getBoundingClientRect()
  const ratio = getArtworkDirectoryPointerRatio(
    pointerY,
    trackBounds.top,
    trackBounds.height,
    scrollThumbSize,
    pointerOffset
  )
  scrollThumbRatio.value = ratio
  viewport.scrollTop =
    ratio * Math.max(0, viewport.scrollHeight - viewport.clientHeight)
}

function handleScrollTrackPointerDown(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  updateScrollFromPointer(event.clientY)
}

function startScrollThumbDrag(event: PointerEvent): void {
  if (event.button !== 0) return
  event.preventDefault()
  const thumb = event.currentTarget as HTMLElement
  const thumbBounds = thumb.getBoundingClientRect()
  scrollThumbPointerOffset =
    event.clientY - (thumbBounds.top + thumbBounds.height / 2)
  scrollThumbPointerId = event.pointerId
  scrollThumbDragging.value = true
  thumb.setPointerCapture(event.pointerId)
}

function moveScrollThumbDrag(event: PointerEvent): void {
  if (!scrollThumbDragging.value || event.pointerId !== scrollThumbPointerId) {
    return
  }
  event.preventDefault()
  updateScrollFromPointer(event.clientY, scrollThumbPointerOffset)
}

function finishScrollThumbDrag(event: PointerEvent): void {
  if (event.pointerId !== scrollThumbPointerId) return
  const thumb = event.currentTarget as HTMLElement
  if (thumb.hasPointerCapture(event.pointerId)) {
    thumb.releasePointerCapture(event.pointerId)
  }
  scrollThumbPointerId = null
  scrollThumbPointerOffset = 0
  scrollThumbDragging.value = false
}

function handleScrollThumbKeydown(event: KeyboardEvent): void {
  const viewport = viewportRef.value
  if (!viewport) return

  const maxScroll = Math.max(0, viewport.scrollHeight - viewport.clientHeight)
  const smallStep = Math.max(80, viewport.clientHeight * 0.2)
  const pageStep = Math.max(160, viewport.clientHeight * 0.85)
  let nextScrollTop: number | null = null

  if (event.key === 'ArrowUp') {
    nextScrollTop = viewport.scrollTop - smallStep
  } else if (event.key === 'ArrowDown') {
    nextScrollTop = viewport.scrollTop + smallStep
  } else if (event.key === 'PageUp') {
    nextScrollTop = viewport.scrollTop - pageStep
  } else if (event.key === 'PageDown') {
    nextScrollTop = viewport.scrollTop + pageStep
  } else if (event.key === 'Home') {
    nextScrollTop = 0
  } else if (event.key === 'End') {
    nextScrollTop = maxScroll
  }

  if (nextScrollTop === null) return
  event.preventDefault()
  viewport.scrollTop = Math.min(maxScroll, Math.max(0, nextScrollTop))
}

function handleScroll(event: Event): void {
  if (mode.value !== 'scroll') return
  const target = event.currentTarget as HTMLElement
  const maxScroll = Math.max(0, target.scrollHeight - target.clientHeight)
  scrollThumbRatio.value = maxScroll
    ? Math.min(1, Math.max(0, target.scrollTop / maxScroll))
    : 0
  const localPage = getArtworkDirectoryScrollPage(
    target.scrollTop,
    target.scrollHeight,
    target.clientHeight,
    scrollBatchPageCount.value
  )
  scrollPage.value = Math.min(
    totalPages.value,
    scrollBatchStartPage.value + localPage - 1
  )
  scheduleLiveScrollLoad(scrollPage.value)

  const reachedBatchEnd =
    target.scrollTop + target.clientHeight >= target.scrollHeight - 2
  if (
    reachedBatchEnd &&
    !scrollBatchTransitioning &&
    scrollBatchEndPage.value < totalPages.value
  ) {
    showNextScrollBatch()
  }
}

async function refreshDirectoryForPageCountFilter(): Promise<void> {
  if (!entries.value.length || initialLoading.value) return

  const requestId = directoryRequestId
  ++filterRequestId
  filterIndexing.value = false
  error.value = ''
  if (normalizedMinPageCount.value > 0) {
    try {
      await preparePageCountFilter(requestId)
    } catch {
      return
    }
  }
  if (requestId !== directoryRequestId) return

  const target = currentDirectoryPosition.value
    ? currentArtworkPage.value
    : Math.min(currentPage.value, totalPages.value)
  currentPage.value = target
  quickPageTarget.value = target
  if (mode.value === 'scroll') {
    await nextTick()
    await scrollDirectoryToPage(target)
  } else {
    await loadPage(target, requestId)
    void preloadAdjacentPages(target, requestId)
  }
}

function scheduleQuickPageCommit(): void {
  if (quickPageTimer) clearTimeout(quickPageTimer)
  quickPageTimer = setTimeout(() => {
    quickPageTimer = undefined
    const target = quickPageTarget.value
    if (mode.value === 'quick-page' && target !== currentPage.value) {
      void changePage(target, target)
    }
  }, 180)
}

async function handleWheel(event: WheelEvent): Promise<void> {
  if (mode.value === 'scroll') return
  event.preventDefault()
  event.stopPropagation()

  if (mode.value === 'page') {
    const target = getWheelPageTarget(
      currentPage.value,
      totalPages.value,
      event.deltaY
    )
    if (target === currentPage.value || wheelLocked) return

    wheelLocked = true
    await changePage(target)
    wheelTimer = setTimeout(() => {
      wheelLocked = false
      wheelTimer = undefined
    }, 360)
    return
  }

  quickPageTarget.value = getWheelPageTarget(
    quickPageTarget.value,
    totalPages.value,
    event.deltaY
  )
  scheduleQuickPageCommit()
}

watch(() => props.userId, initializeDirectory, {
  immediate: true,
})
watch(() => props.currentArtworkId, syncCurrentArtwork)
watch(normalizedMinPageCount, refreshDirectoryForPageCountFilter)

onBeforeUnmount(() => {
  ++directoryRequestId
  ++filterRequestId
  if (wheelTimer) clearTimeout(wheelTimer)
  if (quickPageTimer) clearTimeout(quickPageTimer)
  if (scrollLoadFrame) cancelAnimationFrame(scrollLoadFrame)
  queuedScrollPage = null
  scrollThumbPointerId = null
  scrollThumbDragging.value = false
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
  flex-wrap: wrap;
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
  gap: 6px;
  min-height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 0.78rem;
  font-weight: 650;

  svg {
    width: 16px;
    height: 16px;
    flex: 0 0 auto;
  }

  span {
    opacity: 0.78;
  }

  strong {
    // The mono face (Space Grotesk) renders these counters harshly at small
    // sizes; the body font with tabular figures keeps the columns aligned
    // while reading much softer.
    font-size: 0.86rem;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
    letter-spacing: 0.01em;
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

.directory-batch-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  min-height: 28px;
  color: var(--modern-muted);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;

  button {
    min-height: 26px;
    padding: 0 10px;
    color: var(--modern-pink-strong);
    background: var(--modern-soft-pink);
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-weight: 700;

    &:hover,
    &:focus-visible {
      color: #fff;
      background: var(--modern-pink);
      outline: 0;
    }

    &:disabled {
      cursor: default;
      opacity: 0.38;
    }
  }
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

.directory-scroll-shell {
  position: relative;
  min-width: 0;
}

.directory-viewport {
  min-width: 0;

  &.is-scroll {
    max-height: var(--directory-grid-height, 740px);
    overflow-y: scroll;
    overscroll-behavior: contain;
    scrollbar-width: none;

    &::-webkit-scrollbar {
      display: none;
      width: 0;
      height: 0;
    }
  }

  &.is-page {
    overflow: hidden;
  }
}

.directory-scroll-control {
  position: absolute;
  top: 0;
  right: -35px;
  bottom: 0;
  width: 44px;
  cursor: pointer;
  touch-action: none;
  user-select: none;
  z-index: 8;

  &::before {
    position: absolute;
    top: 8px;
    bottom: 8px;
    left: 50%;
    width: 6px;
    background: color-mix(in srgb, var(--modern-pink) 28%, transparent);
    border: 1px solid color-mix(in srgb, var(--modern-pink) 35%, transparent);
    border-radius: 999px;
    box-shadow: inset 0 1px 3px rgb(75 34 60 / 18%);
    content: '';
    pointer-events: none;
    transform: translateX(-50%);
  }
}

.directory-scroll-thumb {
  --directory-scroll-position: 0%;
  --directory-scroll-shift: 0%;

  position: absolute;
  top: var(--directory-scroll-position);
  left: 50%;
  display: grid;
  width: 16px;
  height: 48px;
  padding: 0;
  background: var(--modern-pink);
  border: 2px solid color-mix(in srgb, var(--modern-pink) 55%, #fff);
  border-radius: 999px;
  box-shadow:
    0 8px 20px rgb(152 57 99 / 30%),
    inset 0 1px 0 rgb(255 255 255 / 32%);
  cursor: grab;
  place-items: center;
  touch-action: none;
  transform: translate(-50%, var(--directory-scroll-shift));
  transition:
    box-shadow 150ms ease,
    filter 150ms ease;

  &:hover,
  &:focus-visible,
  &.is-dragging {
    box-shadow:
      0 10px 24px rgb(214 80 145 / 40%),
      0 0 0 4px color-mix(in srgb, var(--modern-pink) 22%, transparent),
      inset 0 1px 0 rgb(255 255 255 / 38%);
    filter: brightness(1.08);
    outline: 0;
  }

  &.is-dragging {
    cursor: grabbing;
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

  // Scroll mode keeps the complete directory in the layout so the scrollbar
  // stays stable. Chromium can skip off-screen card painting until needed.
  content-visibility: auto;
  contain-intrinsic-size: var(--directory-card-size, 240px);

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

  &--placeholder {
    box-shadow: none;

    &:hover,
    &:focus-visible {
      transform: none;
    }
  }
}

.directory-cover {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 12px;
  background: var(--modern-skeleton);

  &--pending {
    background:
      linear-gradient(135deg, rgb(255 255 255 / 3%), transparent 55%),
      var(--modern-skeleton);
  }

  :deep(img),
  :deep(svg) {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.directory-card.is-current .directory-cover::after {
  position: absolute;
  background: color-mix(in srgb, var(--modern-pink) 24%, transparent);
  content: '';
  inset: 0;
  pointer-events: none;
  z-index: 4;
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

.directory-ugoira {
  position: absolute;
  top: 50%;
  left: 50%;
  display: grid;
  color: #fff;
  filter: drop-shadow(0 2px 8px rgb(0 0 0 / 42%));
  font-size: 2.25rem;
  opacity: 0.82;
  pointer-events: none;
  transform: translate(-50%, -50%);
  z-index: 5;
}

.directory-state {
  min-height: 180px;
  color: var(--modern-muted);
  font-size: 0.82rem;
  text-align: center;

  &--error,
  &--empty,
  &--indexing {
    display: grid;
    place-items: center;
  }

  &--indexing > div {
    display: grid;
    gap: 8px;
  }

  &--indexing span {
    color: var(--modern-pink-strong);
    font-variant-numeric: tabular-nums;
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

  .directory-scroll-control {
    right: -28px;
  }
}
</style>
