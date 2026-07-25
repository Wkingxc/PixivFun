<template lang="pug">
Teleport(to='body')
  Transition(name='reader-fade')
    section.artwork-waterfall-reader(
      @scroll.passive='scheduleCurrentPageUpdate'
      aria-label='瀑布阅读'
      aria-modal='true'
      ref='readerRef'
      role='dialog'
      tabindex='-1'
      v-if='active'
    )
      header.reader-heading
        .reader-heading__copy
          strong {{ title }}
          span {{ currentPageIndex + 1 }} / {{ pages.length }}
        .reader-heading__aside
          span.reader-heading__preload(
            :class='{ complete: loadedOriginalCount === pages.length }'
            v-if='preloadOriginals'
          ) 原图预载 {{ loadedOriginalCount }} / {{ pages.length }}
          span.reader-heading__hint Esc 退出 · 点击左下角花朵调整
          .reader-heading__actions
            button.reader-heading__action(
              @click='scrollReaderToTop'
              aria-label='回到顶部'
              title='回到顶部'
              type='button'
            )
              ITablerArrowUp(aria-hidden='true')
              span 回到顶部
            button.reader-heading__action(
              :disabled='downloading'
              @click='downloadArtwork'
              aria-label='下载作品'
              title='下载作品'
              type='button'
            )
              ITablerDownload(aria-hidden='true')
              span(v-if='downloading') 下载 {{ downloadCompletedCount }}/{{ pages.length }}
              span(v-else) 下载作品
            button.reader-heading__action.reader-heading__exit(
              @click='closeReader'
              aria-label='退出阅读模式'
              title='退出阅读模式'
              type='button'
            )
              ITablerDoorExit(aria-hidden='true')
              span 退出
          small.reader-heading__download-error(
            aria-live='polite'
            v-if='downloadError'
          ) {{ downloadError }}

      Waterfall.reader-waterfall(
        :breakpoints='readerBreakpoints',
        :delay='24',
        :gutter='READER_GUTTER',
        :has-around-gutter='false',
        :list='pages'
        ref='waterfallRef'
        v-if='layoutMode === "masonry"'
      )
        template(#default='{ item, index }')
          figure.reader-page(
            :class='`preload-${preloadStates[index] || "idle"}`',
            :data-reader-index='index',
            :key='`${illustId}-${index}`',
            :style='{ aspectRatio: `${item.width} / ${item.height}` }'
          )
            button.reader-page__open(
              :title='`查看第 ${index + 1} 页原图`'
              @click='openViewer(index)'
              type='button'
            )
              img(
                :alt='`${title} 第 ${index + 1} 页`',
                :decoding='index < 2 ? "sync" : "async"',
                :fetchpriority='index < 2 ? "high" : "auto"',
                :height='item.height',
                :loading='index < 2 ? "eager" : "lazy"',
                :src='getReaderImageSource(item, imageQuality)',
                :width='item.width'
                @error='handleImageError($event, getGridFallback(item))'
                @load='handleGridImageLoad(index)'
              )
            figcaption(aria-hidden='true') {{ index + 1 }}

      section.reader-aligned(v-else)
        .reader-aligned__row(:key='row.key' v-for='row in alignedRows')
          figure.reader-page.reader-page--aligned(
            :class='`preload-${preloadStates[entry.index] || "idle"}`',
            :data-reader-index='entry.index',
            :key='`${illustId}-${entry.index}`',
            :style='{ aspectRatio: `${entry.page.width} / ${entry.page.height}`, flexGrow: entry.ratio }'
            v-for='entry in row.entries'
          )
            button.reader-page__open(
              :title='`查看第 ${entry.index + 1} 页原图`'
              @click='openViewer(entry.index)'
              type='button'
            )
              img(
                :alt='`${title} 第 ${entry.index + 1} 页`',
                :decoding='entry.index < 2 ? "sync" : "async"',
                :fetchpriority='entry.index < 2 ? "high" : "auto"',
                :height='entry.page.height',
                :loading='entry.index < 2 ? "eager" : "lazy"',
                :src='getReaderImageSource(entry.page, imageQuality)',
                :width='entry.page.width'
                @error='handleImageError($event, getGridFallback(entry.page))'
                @load='handleGridImageLoad(entry.index)'
              )
            figcaption(aria-hidden='true') {{ entry.index + 1 }}
          span.reader-aligned__filler(
            :style='{ flexGrow: row.fillerGrow }'
            aria-hidden='true'
            v-if='row.fillerGrow'
          )

  Transition(name='reader-fade')
    section.reader-lightbox(
      @click.self='closeViewer'
      aria-label='原图查看器'
      aria-modal='true'
      role='dialog'
      v-if='active && viewerOpen'
    )
      .reader-lightbox__status
        .reader-lightbox__progress
          strong {{ viewerProgressLabel }}
          span / {{ pages.length }}
        button.reader-lightbox__spread-toggle(
          :aria-checked='doublePageMode',
          :aria-label='`双页模式：${doublePageMode ? "开启" : "关闭"}`',
          :class='{ active: doublePageMode }',
          :disabled='pages.length <= 1'
          @click.stop='doublePageMode = !doublePageMode'
          role='switch'
          type='button'
        )
          span 双页
      button.reader-lightbox__close(
        @click='closeViewer'
        aria-label='关闭原图'
        title='关闭原图'
        type='button'
      )
        ITablerX(aria-hidden='true')
      button.reader-lightbox__nav.reader-lightbox__nav--prev(
        @click.stop='stepViewer(-1)'
        aria-label='查看上一张原图'
        title='上一张'
        type='button'
        v-if='viewerCanGoPrevious'
      )
        ITablerChevronLeft(aria-hidden='true')
      .reader-lightbox__stage(
        :class='{ "reader-lightbox__stage--spread": viewerEntries.length > 1 }'
        @click.stop
      )
        .reader-lightbox__page(
          :key='entry.page.urls.original'
          v-for='entry in viewerEntries'
        )
          img(
            :alt='`${title} 第 ${entry.index + 1} 页原图`',
            :height='entry.page.height',
            :src='entry.page.urls.original',
            :width='entry.page.width'
            @error='handleImageError($event, entry.page.urls.regular)'
            @load='markOriginalLoaded(entry.index)'
          )
      button.reader-lightbox__nav.reader-lightbox__nav--next(
        @click.stop='stepViewer(1)'
        aria-label='查看下一张原图'
        title='下一张'
        type='button'
        v-if='viewerCanGoNext'
      )
        ITablerChevronRight(aria-hidden='true')

  .reader-floating(
    @pointerenter='cancelMenuCollapse'
    @pointerleave='scheduleMenuCollapse'
    v-if='!viewerOpen'
  )
    Transition(name='reader-menu')
      aside.reader-toolbox(
        aria-label='阅读设置'
        role='menu'
        v-if='active && menuOpen'
      )
        .reader-toolbox__heading
          strong 阅读设置
          button.reader-toolbox__close(
            @click='menuOpen = false'
            aria-label='关闭阅读工具'
            title='关闭工具'
            type='button'
          )
            ITablerX(aria-hidden='true')

        .reader-toolbox__group
          span 排版列数
          .reader-column-control
            button(
              :disabled='columns <= 1'
              @click='adjustColumns(-1)'
              aria-label='减少一列'
              type='button'
            )
              ITablerMinus(aria-hidden='true')
            output(aria-live='polite') {{ columns }} 列
            button(
              :disabled='columns >= 12'
              @click='adjustColumns(1)'
              aria-label='增加一列'
              type='button'
            )
              ITablerPlus(aria-hidden='true')

        .reader-toolbox__group
          span 排版方式
          .reader-segments
            button(
              :aria-pressed='layoutMode === option.value',
              :class='{ active: layoutMode === option.value }',
              :key='option.value'
              @click='layoutMode = option.value'
              type='button'
              v-for='option in layoutOptions'
            ) {{ option.label }}

        .reader-toolbox__group
          span 缩略画质
          .reader-segments
            button(
              :class='{ active: imageQuality === option.value }',
              :key='option.value'
              @click='imageQuality = option.value'
              type='button'
              v-for='option in qualityOptions'
            ) {{ option.label }}

        .reader-toolbox__group
          span 原图预载
          button.reader-preload-toggle(
            :aria-checked='preloadOriginals',
            :class='{ active: preloadOriginals }'
            @click='preloadOriginals = !preloadOriginals'
            role='switch'
            type='button'
          )
            span {{ preloadOriginals ? '开启' : '关闭' }}
            small {{ loadedOriginalCount }}/{{ pages.length }}

    button.reader-trigger(
      :aria-expanded='active ? menuOpen : undefined',
      :aria-label='active ? "打开阅读工具" : "进入瀑布阅读"',
      :class='{ active }',
      :title='active ? "阅读工具" : "进入瀑布阅读"'
      @click='handleTrigger'
      type='button'
    )
      INotoCherryBlossom(aria-hidden='true')
      span 阅读
</template>

<script lang="ts" setup>
import type { ArtworkGallery } from '~/types'
import {
  clampReaderColumns,
  getArtworkDownloadFilename,
  getArtworkPageFilename,
  getOriginalImageExtension,
  getReaderAlignedRows,
  getReaderImageSource,
  getViewerSpreadIndices,
  getViewerStepIndex,
  shouldOpenArtworkReaderFromKey,
  type ReaderImageQuality,
} from '~/utils/artworkWaterfallReader'
import {
  IconArrowUp as ITablerArrowUp,
  IconChevronLeft as ITablerChevronLeft,
  IconChevronRight as ITablerChevronRight,
  IconDoorExit as ITablerDoorExit,
  IconDownload as ITablerDownload,
  IconMinus as ITablerMinus,
  IconPlus as ITablerPlus,
  IconX as ITablerX,
} from '@tabler/icons-vue'
import INotoCherryBlossom from '~icons/noto-v1/cherry-blossom'
import { Waterfall } from 'vue-waterfall-plugin-next'
import 'vue-waterfall-plugin-next/dist/style.css'
import { useLocalPersistenceStore } from '~/stores/local-persistence'

const props = defineProps<{
  illustId: string
  pages: ArtworkGallery[]
  title: string
}>()

const READER_GUTTER = 14
const MOBILE_BREAKPOINT = 760
const COLUMN_ANIMATION_MS = 360
const COLUMN_ANIMATION_EASING = 'cubic-bezier(0.22, 1, 0.36, 1)'
const active = ref(false)
const menuOpen = ref(false)
const viewerOpen = ref(false)
const columns = ref(3)
const layoutColumns = ref(3)
const imageQuality = ref<ReaderImageQuality>('small')
const preloadOriginals = ref(true)
const doublePageMode = ref(false)
type ReaderLayoutMode = 'masonry' | 'aligned'
const layoutMode = ref<ReaderLayoutMode>('masonry')
const readerViewportWidth = ref(1200)
const downloading = ref(false)
const localPersistenceStore = useLocalPersistenceStore()
const settingsReady = ref(false)
const downloadCompletedCount = ref(0)
const downloadError = ref('')
type PreloadState = 'idle' | 'loading' | 'loaded' | 'failed'
const preloadStates = ref<PreloadState[]>([])
const currentPageIndex = ref(0)
const viewerIndex = ref(0)
const readerRef = ref<HTMLElement | null>(null)
const waterfallRef = ref<{ renderer?: () => void } | null>(null)
let previousBodyOverflow = ''
let scrollFrame = 0
let preloadGeneration = 0
let activePreloadImage: HTMLImageElement | null = null
let resolveActivePreload: ((loaded: boolean) => void) | null = null
let menuCollapseTimer = 0
let columnLayoutTimer = 0
let downloadController: AbortController | null = null

const qualityOptions: { label: string; value: ReaderImageQuality }[] = [
  { label: '小图', value: 'small' },
  { label: '高清', value: 'regular' },
  { label: '原图', value: 'original' },
]
const layoutOptions: { label: string; value: ReaderLayoutMode }[] = [
  { label: '瀑布', value: 'masonry' },
  { label: '行对齐', value: 'aligned' },
]

const effectiveLayoutColumns = computed(() =>
  readerViewportWidth.value <= MOBILE_BREAKPOINT ? 1 : columns.value
)
const alignedRows = computed(() =>
  getReaderAlignedRows(props.pages, effectiveLayoutColumns.value).map(
    (indices) => ({
      key: indices.join('-'),
      entries: indices.flatMap((index) => {
        const page = props.pages[index]
        return page
          ? [
              {
                index,
                page,
                ratio: Math.max(0.08, page.width / page.height),
              },
            ]
          : []
      }),
      fillerGrow: Math.max(0, effectiveLayoutColumns.value - indices.length),
    })
  )
)

const viewerPageIndices = computed(() =>
  getViewerSpreadIndices(
    props.pages.length,
    viewerIndex.value,
    doublePageMode.value
  )
)
const viewerEntries = computed(() =>
  viewerPageIndices.value.flatMap((index) => {
    const page = props.pages[index]
    return page ? [{ index, page }] : []
  })
)
const viewerProgressLabel = computed(() =>
  viewerPageIndices.value.length > 1
    ? `${viewerPageIndices.value[0]! + 1}–${viewerPageIndices.value.at(-1)! + 1}`
    : `${(viewerPageIndices.value[0] ?? 0) + 1}`
)
const previousViewerIndex = computed(() =>
  getViewerStepIndex(
    props.pages.length,
    viewerIndex.value,
    -1,
    doublePageMode.value
  )
)
const nextViewerIndex = computed(() =>
  getViewerStepIndex(
    props.pages.length,
    viewerIndex.value,
    1,
    doublePageMode.value
  )
)
const viewerCanGoPrevious = computed(
  () => previousViewerIndex.value !== viewerIndex.value
)
const viewerCanGoNext = computed(
  () => nextViewerIndex.value !== viewerIndex.value
)
const loadedOriginalCount = computed(
  () => preloadStates.value.filter((state) => state === 'loaded').length
)
const readerBreakpoints = computed(() => ({
  9999: { rowPerView: layoutColumns.value },
  760: { rowPerView: 1 },
}))

function handleTrigger() {
  cancelMenuCollapse()
  if (!active.value) {
    openReader()
    return
  }
  menuOpen.value = !menuOpen.value
}

async function openReader() {
  syncReaderViewport()
  active.value = true
  menuOpen.value = false
  viewerOpen.value = false
  currentPageIndex.value = 0
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  await nextTick()
  readerRef.value?.focus({ preventScroll: true })
  waterfallRef.value?.renderer?.()
  if (preloadOriginals.value) void startOriginalPreload(0)
}

function closeReader() {
  stopOriginalPreload()
  cancelMenuCollapse()
  downloadController?.abort()
  active.value = false
  menuOpen.value = false
  viewerOpen.value = false
  document.body.style.overflow = previousBodyOverflow
}

function openViewer(index: number) {
  viewerIndex.value = index
  viewerOpen.value = true
  menuOpen.value = false
  if (preloadOriginals.value) void startOriginalPreload(index)
}

function closeViewer() {
  viewerOpen.value = false
}

function stepViewer(step: number) {
  const nextIndex = getViewerStepIndex(
    props.pages.length,
    viewerIndex.value,
    step,
    doublePageMode.value
  )
  if (nextIndex === viewerIndex.value) return
  viewerIndex.value = nextIndex
  if (preloadOriginals.value) void startOriginalPreload(viewerIndex.value)
}

function getGridFallback(page: ArtworkGallery): string {
  if (imageQuality.value === 'original') return page.urls.regular
  if (imageQuality.value === 'regular') return page.urls.small
  return page.urls.thumb_mini
}

function ensurePreloadStates() {
  if (preloadStates.value.length === props.pages.length) return
  preloadStates.value = props.pages.map(
    (_, index) => preloadStates.value[index] || 'idle'
  )
}

function markOriginalLoaded(index: number) {
  ensurePreloadStates()
  preloadStates.value[index] = 'loaded'
}

function handleGridImageLoad(index: number) {
  if (imageQuality.value === 'original') markOriginalLoaded(index)
}

function waitForPreloadTurn(generation: number, delay = 320): Promise<boolean> {
  return new Promise((resolve) => {
    const check = () => {
      if (
        generation !== preloadGeneration ||
        !active.value ||
        !preloadOriginals.value
      ) {
        resolve(false)
        return
      }
      if (document.hidden) {
        window.setTimeout(check, 500)
        return
      }
      window.setTimeout(() => resolve(generation === preloadGeneration), delay)
    }
    check()
  })
}

function preloadOriginal(index: number, generation: number): Promise<boolean> {
  const page = props.pages[index]
  if (!page) return Promise.resolve(false)

  ensurePreloadStates()
  preloadStates.value[index] = 'loading'

  return new Promise((resolve) => {
    const image = new Image()
    activePreloadImage = image
    resolveActivePreload = resolve
    image.decoding = 'async'
    image.onload = () => {
      if (generation === preloadGeneration) markOriginalLoaded(index)
      if (activePreloadImage === image) activePreloadImage = null
      if (resolveActivePreload === resolve) resolveActivePreload = null
      resolve(true)
    }
    image.onerror = () => {
      if (generation === preloadGeneration) {
        preloadStates.value[index] = 'failed'
      }
      if (activePreloadImage === image) activePreloadImage = null
      if (resolveActivePreload === resolve) resolveActivePreload = null
      resolve(false)
    }
    image.src = page.urls.original
  })
}

async function startOriginalPreload(startIndex: number) {
  if (!active.value || !preloadOriginals.value || !props.pages.length) return
  stopOriginalPreload()
  ensurePreloadStates()
  const generation = ++preloadGeneration
  const fixedStart = Math.min(props.pages.length - 1, Math.max(0, startIndex))
  const order = [
    ...props.pages.slice(fixedStart).map((_, index) => fixedStart + index),
    ...props.pages.slice(0, fixedStart).map((_, index) => index),
  ]

  for (const index of order) {
    if (generation !== preloadGeneration) return
    if (preloadStates.value[index] === 'loaded') continue
    const canContinue = await waitForPreloadTurn(generation)
    if (!canContinue) return
    await preloadOriginal(index, generation)
  }
}

function stopOriginalPreload() {
  preloadGeneration++
  if (activePreloadImage) {
    activePreloadImage.onload = null
    activePreloadImage.onerror = null
    activePreloadImage.src = ''
    activePreloadImage = null
  }
  resolveActivePreload?.(false)
  resolveActivePreload = null
  preloadStates.value = preloadStates.value.map((state) =>
    state === 'loading' ? 'idle' : state
  )
}

function scrollReaderToTop() {
  readerRef.value?.scrollTo({ top: 0, behavior: 'smooth' })
  menuOpen.value = false
}

function adjustColumns(step: number) {
  const nextColumns = clampReaderColumns(columns.value + step)
  if (nextColumns === columns.value) return
  if (layoutMode.value === 'aligned') {
    columns.value = nextColumns
    layoutColumns.value = nextColumns
    return
  }
  const animated = animateWaterfallColumns(nextColumns)
  columns.value = nextColumns
  if (!animated) {
    layoutColumns.value = nextColumns
    return
  }
  if (columnLayoutTimer) window.clearTimeout(columnLayoutTimer)
  columnLayoutTimer = window.setTimeout(() => {
    layoutColumns.value = nextColumns
    columnLayoutTimer = 0
  }, COLUMN_ANIMATION_MS + 24)
}

function syncReaderViewport() {
  readerViewportWidth.value = window.innerWidth
}

function animateWaterfallColumns(nextColumns: number): boolean {
  const wrapper =
    readerRef.value?.querySelector<HTMLElement>('.reader-waterfall')
  if (!wrapper) return false
  const items = Array.from(wrapper.children).filter(
    (item): item is HTMLElement =>
      item instanceof HTMLElement && item.classList.contains('waterfall-item')
  )
  if (!items.length) return false

  const wrapperWidth = wrapper.getBoundingClientRect().width
  const visibleColumns = wrapperWidth <= MOBILE_BREAKPOINT ? 1 : nextColumns
  const itemWidth = Math.floor(
    (wrapperWidth - (visibleColumns - 1) * READER_GUTTER) / visibleColumns
  )
  const contentWidth =
    visibleColumns * (itemWidth + READER_GUTTER) - READER_GUTTER
  const offsetX = (wrapperWidth - contentWidth) / 2
  const columnHeights = new Array(visibleColumns).fill(0) as number[]
  const transition = [
    `transform ${COLUMN_ANIMATION_MS}ms ${COLUMN_ANIMATION_EASING}`,
    `width ${COLUMN_ANIMATION_MS}ms ${COLUMN_ANIMATION_EASING}`,
  ].join(', ')

  // Read current layout before any writes so every card starts together.
  items.forEach((item) => void item.offsetWidth)
  items.forEach((item, index) => {
    const page = props.pages[index]
    if (!page) return
    let columnIndex = 0
    for (let column = 1; column < columnHeights.length; column++) {
      if (columnHeights[column]! < columnHeights[columnIndex]!) {
        columnIndex = column
      }
    }
    const x = Math.floor(offsetX + columnIndex * (itemWidth + READER_GUTTER))
    const y = Math.floor(columnHeights[columnIndex]!)
    const itemHeight = Math.round((itemWidth * page.height) / page.width)

    item.style.transition = transition
    item.style.width = `${itemWidth}px`
    item.style.transform = `translate3d(${x}px,${y}px,0)`
    columnHeights[columnIndex] = y + itemHeight + READER_GUTTER
  })
  const wrapperHeight = Math.max(...columnHeights)
  wrapper.style.transition = `height ${COLUMN_ANIMATION_MS}ms ${COLUMN_ANIMATION_EASING}`
  wrapper.style.height = `${wrapperHeight}px`

  return true
}

function cancelMenuCollapse() {
  if (!menuCollapseTimer) return
  window.clearTimeout(menuCollapseTimer)
  menuCollapseTimer = 0
}

function scheduleMenuCollapse() {
  cancelMenuCollapse()
  if (!menuOpen.value) return
  menuCollapseTimer = window.setTimeout(() => {
    menuOpen.value = false
    menuCollapseTimer = 0
  }, 520)
}

function saveDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function fetchOriginalForDownload(
  index: number,
  signal: AbortSignal
): Promise<Blob> {
  const page = props.pages[index]
  if (!page) throw new Error('作品图片不存在')
  ensurePreloadStates()
  preloadStates.value[index] = 'loading'
  try {
    const response = await fetch(page.urls.original, {
      cache: 'force-cache',
      signal,
    })
    if (!response.ok) throw new Error(`第 ${index + 1} 页请求失败`)
    const blob = await response.blob()
    markOriginalLoaded(index)
    return blob
  } catch (error) {
    if (!signal.aborted) preloadStates.value[index] = 'failed'
    throw error
  }
}

async function downloadArtwork() {
  if (downloading.value || !props.pages.length) return
  cancelMenuCollapse()
  menuOpen.value = false
  stopOriginalPreload()
  downloading.value = true
  downloadCompletedCount.value = 0
  downloadError.value = ''
  const controller = new AbortController()
  downloadController = controller

  try {
    if (props.pages.length === 1) {
      const page = props.pages[0]!
      const blob = await fetchOriginalForDownload(0, controller.signal)
      downloadCompletedCount.value = 1
      saveDownload(
        blob,
        getArtworkDownloadFilename(
          props.title,
          props.illustId,
          false,
          getOriginalImageExtension(page.urls.original)
        )
      )
      return
    }

    const { BlobReader, BlobWriter, ZipWriter } = await import('@zip.js/zip.js')
    const zipWriter = new ZipWriter(new BlobWriter('application/zip'))
    for (const [index, page] of props.pages.entries()) {
      const blob = await fetchOriginalForDownload(index, controller.signal)
      await zipWriter.add(
        getArtworkPageFilename(props.illustId, index, page.urls.original),
        new BlobReader(blob)
      )
      downloadCompletedCount.value = index + 1
    }
    const archive = await zipWriter.close()
    saveDownload(
      archive,
      getArtworkDownloadFilename(props.title, props.illustId, true)
    )
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return
    downloadError.value =
      error instanceof Error ? error.message : '作品下载失败，请稍后重试'
  } finally {
    if (downloadController === controller) downloadController = null
    downloading.value = false
  }
}

function updateCurrentPage() {
  scrollFrame = 0
  const reader = readerRef.value
  if (!reader) return

  const headingOffset = reader.getBoundingClientRect().top + 92
  const pages = Array.from(
    reader.querySelectorAll<HTMLElement>('[data-reader-index]')
  )
  let nearestIndex = currentPageIndex.value
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const page of pages) {
    const distance = Math.abs(page.getBoundingClientRect().top - headingOffset)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestIndex = Number(page.dataset.readerIndex)
    }
  }

  if (Number.isFinite(nearestIndex)) currentPageIndex.value = nearestIndex
}

function scheduleCurrentPageUpdate() {
  if (scrollFrame) return
  scrollFrame = requestAnimationFrame(updateCurrentPage)
}

function handleImageError(event: Event, fallback: string) {
  const image = event.currentTarget as HTMLImageElement
  if (image.getAttribute('src') !== fallback) image.src = fallback
}

function handleKeydown(event: KeyboardEvent) {
  if (!active.value) {
    if (!shouldOpenArtworkReaderFromKey(event)) return
    event.preventDefault()
    void openReader()
    return
  }
  if (viewerOpen.value) {
    if (event.key === 'Escape') closeViewer()
    if (event.key === 'ArrowLeft') stepViewer(-1)
    if (event.key === 'ArrowRight') stepViewer(1)
    if (['Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault()
    }
    return
  }
  if (event.key !== 'Escape') return
  if (menuOpen.value) {
    menuOpen.value = false
  } else {
    closeReader()
  }
}

onMounted(async () => {
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', syncReaderViewport)
  syncReaderViewport()
  ensurePreloadStates()
  await localPersistenceStore.init().catch(() => {})
  const saved = localPersistenceStore.preferences.artworkReader
  columns.value = clampReaderColumns(saved.columns)
  layoutColumns.value = columns.value
  imageQuality.value = saved.imageQuality
  preloadOriginals.value = saved.preloadOriginals
  doublePageMode.value = saved.doublePageMode
  layoutMode.value = saved.layoutMode
  await nextTick()
  settingsReady.value = true
})

watch(
  [columns, imageQuality, preloadOriginals, doublePageMode, layoutMode],
  (
    [nextColumns, nextQuality, nextPreload, nextDoublePage, nextLayoutMode],
    previous
  ) => {
    if (!settingsReady.value) return
    void localPersistenceStore
      .patchPreferences({
        artworkReader: {
          columns: nextColumns,
          imageQuality: nextQuality,
          preloadOriginals: nextPreload,
          doublePageMode: nextDoublePage,
          layoutMode: nextLayoutMode,
        },
      })
      .catch(() => {})
    if (!previous || nextPreload === previous[2] || !active.value) return
    if (nextPreload) {
      void startOriginalPreload(currentPageIndex.value)
    } else {
      stopOriginalPreload()
    }
  }
)

watch(layoutMode, async (nextMode) => {
  if (!active.value || nextMode !== 'masonry') return
  await nextTick()
  waterfallRef.value?.renderer?.()
})

watch(
  () => props.illustId,
  () => {
    if (active.value) closeReader()
    preloadStates.value = props.pages.map(() => 'idle')
  }
)

onBeforeUnmount(() => {
  stopOriginalPreload()
  cancelMenuCollapse()
  if (columnLayoutTimer) window.clearTimeout(columnLayoutTimer)
  downloadController?.abort()
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('resize', syncReaderViewport)
  if (scrollFrame) cancelAnimationFrame(scrollFrame)
  if (active.value) document.body.style.overflow = previousBodyOverflow
})
</script>

<style scoped lang="scss">
.artwork-waterfall-reader {
  position: fixed;
  inset: 0;
  z-index: 1100;
  overflow: auto;
  color: var(--pf-text);
  background:
    radial-gradient(
      circle at 10% 0%,
      color-mix(in srgb, var(--pf-pink) 12%, transparent),
      transparent 30rem
    ),
    var(--pf-bg);
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.reader-heading {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  min-height: 64px;
  padding: 12px max(24px, calc((100vw - 1500px) / 2));
  background: color-mix(in srgb, var(--pf-surface) 88%, transparent);
  border-bottom: 1px solid var(--pf-line);
  backdrop-filter: blur(14px);
}

.reader-heading__copy {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 12px;

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  span {
    flex: 0 0 auto;
    color: var(--pf-pink);
    font-size: 0.78rem;
    font-weight: 750;
  }
}

.reader-heading__hint {
  flex: 0 0 auto;
  color: var(--pf-muted);
  font-size: 0.72rem;
}

.reader-heading__aside {
  display: flex;
  align-items: center;
  gap: 14px;
}

.reader-heading__preload {
  color: #199654;
  font-size: 0.72rem;
  font-weight: 750;

  &.complete {
    color: #0fbd62;
  }
}

.reader-heading__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
}

.reader-heading__action {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 7px 11px;
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-surface) 76%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  font-size: 0.74rem;
  font-weight: 750;
  cursor: pointer;
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;

  &:hover,
  &:focus-visible {
    color: var(--pf-pink);
    background: color-mix(in srgb, var(--pf-pink) 10%, var(--pf-surface));
    border-color: color-mix(in srgb, var(--pf-pink) 52%, var(--pf-line));
  }

  &:disabled {
    cursor: wait;
    opacity: 0.58;
  }
}

.reader-heading__exit {
  color: var(--pf-pink);
}

.reader-heading__download-error {
  position: absolute;
  top: calc(100% + 8px);
  right: max(16px, calc((100vw - 1500px) / 2));
  max-width: min(420px, calc(100vw - 32px));
  padding: 8px 10px;
  color: #e85c6b;
  background: color-mix(in srgb, var(--pf-surface) 96%, transparent);
  border: 1px solid color-mix(in srgb, #e85c6b 46%, var(--pf-line));
  border-radius: 10px;
  box-shadow: var(--pf-card-shadow);
  font-size: 0.7rem;
  line-height: 1.4;
}

.reader-waterfall,
.reader-aligned {
  width: min(1500px, calc(100% - 48px));
  margin: 28px auto 0;
  padding: 0 0 120px;
}

.reader-waterfall {
  overflow: visible !important;
  background: transparent !important;
}

.reader-aligned {
  display: grid;
  gap: 14px;
}

.reader-aligned__row {
  display: flex;
  width: 100%;
  align-items: flex-start;
  gap: 14px;
}

.reader-page--aligned,
.reader-aligned__filler {
  min-width: 0;
  flex-basis: 0;
}

.reader-aligned__filler {
  align-self: stretch;
  pointer-events: none;
}

.reader-page {
  position: relative;
  box-sizing: border-box;
  margin: 0;
  overflow: hidden;
  background: var(--pf-surface);
  border: 0;
  border-radius: 16px;
  box-shadow:
    inset 0 0 0 1px var(--pf-line),
    var(--pf-card-shadow);
  break-inside: avoid;
  transition: box-shadow 180ms ease;

  &.preload-loading {
    box-shadow:
      inset 0 0 0 2px #f0b84c,
      var(--pf-card-shadow);
  }

  &.preload-loaded {
    box-shadow:
      inset 0 0 0 2px #36d879,
      0 0 0 1px rgb(54 216 121 / 32%),
      var(--pf-card-shadow);
  }

  &.preload-failed {
    box-shadow:
      inset 0 0 0 1px #e85c6b,
      var(--pf-card-shadow);
  }

  .reader-page__open,
  img {
    display: block;
    width: 100%;
  }

  .reader-page__open {
    height: 100%;
    padding: 0;
    background: transparent;
    border: 0;
    cursor: zoom-in;
  }

  img {
    height: auto;
    min-height: 100%;
    background: color-mix(in srgb, var(--pf-surface) 78%, var(--pf-bg));
  }

  figcaption {
    position: absolute;
    top: 10px;
    left: 10px;
    padding: 5px 9px;
    color: #fff;
    background: rgb(20 22 28 / 68%);
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 750;
    line-height: 1;
    opacity: 0;
    pointer-events: none;
    transform: translateY(-4px);
    transition:
      opacity 140ms ease,
      transform 140ms ease;
    backdrop-filter: blur(6px);
  }

  &:hover figcaption,
  &:focus-within figcaption {
    opacity: 1;
    transform: translateY(0);
  }
}

.reader-lightbox {
  position: fixed;
  inset: 0;
  z-index: 1180;
  display: grid;
  color: #fff;
  background: rgb(8 9 13 / 94%);
  place-items: center;
  backdrop-filter: blur(14px);
}

.reader-lightbox__stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  padding: 56px 88px 32px;
  overflow: hidden;
  pointer-events: none;
  place-items: center;
}

.reader-lightbox__page {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  align-items: center;
  justify-content: center;

  img {
    display: block;
    width: auto;
    max-width: 100%;
    height: auto;
    max-height: calc(100vh - 88px);
    object-fit: contain;
    box-shadow: 0 24px 70px rgb(0 0 0 / 48%);
    pointer-events: auto;
    user-select: none;
  }
}

.reader-lightbox__stage--spread {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(4px, 0.8vw, 14px);

  .reader-lightbox__page:first-child {
    justify-content: flex-end;
  }

  .reader-lightbox__page:last-child {
    justify-content: flex-start;
  }
}

.reader-lightbox__status {
  position: fixed;
  bottom: 18px;
  left: 18px;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8px;
}

.reader-lightbox__progress {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 64px;
  padding: 7px 11px;
  color: #fff;
  background: rgb(25 27 34 / 72%);
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  backdrop-filter: blur(10px);

  strong {
    color: #ffd45c;
    font-size: 1rem;
    font-weight: 850;
  }

  span {
    color: rgb(255 255 255 / 82%);
    font-size: 0.88rem;
    font-weight: 750;
  }
}

.reader-lightbox__spread-toggle {
  display: inline-flex;
  min-height: 37px;
  align-items: center;
  justify-content: center;
  padding: 0 13px;
  color: rgb(255 255 255 / 72%);
  background: rgb(25 27 34 / 72%);
  border: 1px solid rgb(255 255 255 / 12%);
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 800;
  backdrop-filter: blur(10px);
  transition:
    color 160ms ease,
    background 160ms ease,
    border-color 160ms ease;

  &:hover:not(:disabled),
  &:focus-visible {
    color: #fff;
    background: rgb(42 44 53 / 88%);
    border-color: rgb(255 255 255 / 28%);
    outline: 0;
  }

  &.active {
    color: #ffd45c;
    background: rgb(55 48 29 / 82%);
    border-color: rgb(255 212 92 / 52%);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.4;
  }
}

.reader-lightbox__close {
  position: fixed;
  top: 18px;
  right: 18px;
  z-index: 4;
  display: grid;
  width: 42px;
  height: 42px;
  padding: 0;
  color: #fff;
  background: rgb(25 27 34 / 72%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 999px;
  cursor: pointer;
  place-items: center;

  svg {
    width: 20px;
    height: 20px;
  }
}

.reader-lightbox__nav {
  position: fixed;
  top: 20%;
  bottom: 20%;
  z-index: 2;
  display: flex;
  width: min(18vw, 240px);
  padding: 0 24px;
  color: var(--pf-pink);
  background: transparent;
  border: 0;
  cursor: pointer;
  opacity: 0;
  transition:
    opacity 160ms ease,
    background 160ms ease;

  svg {
    width: 44px;
    height: 44px;
    padding: 9px;
    background: rgb(255 255 255 / 92%);
    border: 1px solid color-mix(in srgb, var(--pf-pink) 45%, transparent);
    border-radius: 999px;
    box-shadow: 0 10px 30px rgb(0 0 0 / 30%);
  }

  &:hover,
  &:focus-visible {
    background: linear-gradient(90deg, rgb(0 0 0 / 26%), transparent);
    opacity: 1;
    outline: 0;
  }
}

.reader-lightbox__nav--prev {
  left: 0;
  align-items: center;
  justify-content: flex-start;
}

.reader-lightbox__nav--next {
  right: 0;
  align-items: center;
  justify-content: flex-end;

  &:hover,
  &:focus-visible {
    background: linear-gradient(270deg, rgb(0 0 0 / 26%), transparent);
  }
}

.reader-floating {
  position: fixed;
  bottom: 18px;
  left: 18px;
  z-index: 1250;
}

.reader-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 15px;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 18%);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 750;

  svg {
    width: 19px;
    height: 19px;
    color: var(--pf-pink);
  }

  &.active {
    color: #fff;
    background: var(--pf-pink);
    border-color: transparent;

    svg {
      color: #fff;
      filter: brightness(0) invert(1);
    }
  }

  &:focus-visible {
    outline: 2px solid var(--pf-pink);
    outline-offset: 3px;
  }
}

.reader-toolbox {
  position: absolute;
  bottom: calc(100% + 64px);
  left: 0;
  width: min(300px, calc(100vw - 36px));
  padding: 14px;
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-surface) 94%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  box-shadow: 0 16px 50px rgb(0 0 0 / 24%);
  backdrop-filter: blur(16px);
}

.reader-toolbox__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.reader-toolbox__close {
  display: grid;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--pf-muted);
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  place-items: center;
}

.reader-toolbox__group {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  font-size: 0.76rem;
  font-weight: 700;
}

.reader-segments {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--pf-bg);
  border-radius: 10px;

  button {
    flex: 1;
    min-height: 31px;
    padding: 0 8px;
    color: var(--pf-muted);
    background: transparent;
    border: 0;
    border-radius: 7px;
    cursor: pointer;
    font: inherit;
    font-size: 0.72rem;
    font-weight: 700;

    &.active {
      color: #fff;
      background: var(--pf-pink);
    }
  }
}

.reader-column-control {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 34px;
  min-height: 39px;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: var(--pf-bg);
  border-radius: 10px;

  button {
    display: grid;
    height: 31px;
    padding: 0;
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    border-radius: 7px;
    cursor: pointer;
    place-items: center;

    &:hover:not(:disabled),
    &:focus-visible {
      color: #fff;
      background: var(--pf-pink);
      border-color: transparent;
      outline: 0;
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.35;
    }

    svg {
      width: 16px;
      height: 16px;
    }
  }

  output {
    color: var(--pf-text);
    text-align: center;
    font-size: 0.76rem;
    font-weight: 800;
  }
}

.reader-preload-toggle {
  display: flex;
  min-height: 39px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  color: var(--pf-muted);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 750;

  small {
    color: inherit;
    font-size: 0.68rem;
  }

  &.active {
    color: #16864c;
    background: color-mix(in srgb, #36d879 12%, var(--pf-surface));
    border-color: color-mix(in srgb, #36d879 58%, var(--pf-line));
  }
}

.reader-fade-enter-active,
.reader-fade-leave-active,
.reader-menu-enter-active,
.reader-menu-leave-active {
  transition:
    opacity 180ms ease,
    transform 180ms ease;
}

.reader-fade-enter-from,
.reader-fade-leave-to {
  opacity: 0;
}

.reader-menu-enter-from,
.reader-menu-leave-to {
  opacity: 0;
  transform: translateY(8px);
}

@media (max-width: 760px) {
  .reader-heading {
    padding: 10px 16px;
  }

  .reader-heading__hint,
  .reader-heading__preload {
    display: none;
  }

  .reader-heading__action {
    padding: 8px;

    span {
      display: none;
    }
  }

  .reader-waterfall,
  .reader-aligned {
    width: calc(100% - 24px);
    margin-top: 16px;
  }

  .reader-page {
    margin-bottom: 12px;
    border-radius: 12px;
  }

  .reader-lightbox__stage {
    padding: 64px 12px 80px;
  }

  .reader-lightbox__nav {
    top: auto;
    bottom: 18px;
    width: 50%;
    height: 54px;
    padding: 0 20px;
    opacity: 1;
  }

  .reader-lightbox__status {
    bottom: 82px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .reader-fade-enter-active,
  .reader-fade-leave-active,
  .reader-menu-enter-active,
  .reader-menu-leave-active {
    transition: none;
  }
}
</style>
