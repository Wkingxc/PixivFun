<template lang="pug">
Teleport(to='body')
  Transition(name='reader-cover')
    section.artwork-waterfall-reader(
      :style='readerShellStyle'
      @click='handleReaderBackgroundClick'
      @scroll.passive='scheduleCurrentPageUpdate'
      aria-label='瀑布阅读'
      aria-modal='true'
      ref='readerRef'
      role='dialog'
      tabindex='-1'
      v-if='active'
    )
      header.reader-heading(@click='handleHeadingClick')
        .reader-heading__copy
          strong {{ title }}
          span {{ currentPageIndex + 1 }} / {{ pages.length }}
        .reader-heading__aside
          span.reader-heading__preload(
            :class='{ complete: loadedOriginalCount === pages.length }'
            v-if='preloadOriginals'
          ) 原图预载 {{ loadedOriginalCount }} / {{ pages.length }}
          span.reader-heading__hint Esc 或点击顶栏空白处退出 · 拖动花朵可调整位置
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
              span {{ downloadLabel }}
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
      :class='{ "reader-lightbox--cursor-nav": viewerPointer.direction }'
      @click='handleViewerClick'
      @pointerleave='clearViewerPointer'
      @pointermove='handleViewerPointerMove'
      aria-label='原图查看器'
      aria-modal='true'
      ref='lightboxRef'
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
            @load='handleViewerImageLoad(entry.index)'
          )
      .reader-lightbox__cursor-nav(
        :class='`reader-lightbox__cursor-nav--${viewerPointer.direction === -1 ? "prev" : "next"}`',
        :style='viewerCursorStyle'
        aria-hidden='true'
        v-if='viewerPointer.direction'
      )
        ITablerChevronLeft(v-if='viewerPointer.direction === -1')
        ITablerChevronRight(v-else)

  .reader-floating(
    :class='{ "is-dragging": readerFloatingDragging, "reader-floating--toolbox-above": readerToolboxAbove, "reader-floating--toolbox-align-left": readerToolboxAlignLeft }',
    :style='readerFloatingStyle'
    @pointerenter='cancelMenuCollapse'
    @pointerleave='scheduleMenuCollapse'
    ref='readerFloatingRef'
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
          span 界面宽度
          .reader-width-control
            input.reader-width-slider(
              :max='READER_WIDTH_LIMITS.max',
              :min='READER_WIDTH_LIMITS.min',
              :step='READER_WIDTH_LIMITS.step'
              aria-label='阅读界面宽度'
              type='range'
              v-model.number='readerWidth'
            )
            output {{ readerWidth }}

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

        .reader-toolbox__group
          span 并发线程
          .reader-column-control
            button(
              :disabled='threads <= READER_THREAD_LIMITS.min'
              @click='adjustThreads(-1)'
              aria-label='减少并发线程'
              type='button'
            )
              ITablerMinus(aria-hidden='true')
            input.reader-thread-input(
              :max='READER_THREAD_LIMITS.max',
              :min='READER_THREAD_LIMITS.min'
              @blur='commitThreads'
              @change='commitThreads'
              @focus='selectThreadInput'
              @keyup.enter='commitThreads'
              aria-label='并发线程数'
              inputmode='numeric'
              step='1'
              type='number'
              v-model='threadsInput'
            )
            button(
              :disabled='threads >= READER_THREAD_LIMITS.max'
              @click='adjustThreads(1)'
              aria-label='增加并发线程'
              type='button'
            )
              ITablerPlus(aria-hidden='true')

        p.reader-toolbox__note 预载与下载共用线程；下载会立即接管未完成的原图，不必等预载跑完。

    button.reader-trigger(
      :aria-expanded='active ? menuOpen : undefined',
      :aria-label='active ? "打开阅读工具" : "进入瀑布阅读"',
      :class='{ active }',
      :title='active ? "阅读工具（可拖动）" : "进入瀑布阅读（可拖动）"'
      @click='handleFloatingTrigger'
      @pointerdown='startFloatingDrag'
      type='button'
    )
      INotoCherryBlossom(aria-hidden='true')
      span 阅读
</template>

<script lang="ts" setup>
import type { ArtworkGallery } from '~/types'
import {
  ARTWORK_READER_FLOATING_POSITION_KEY,
  clampArtworkReaderFloatingPosition,
  parseArtworkReaderFloatingPosition,
  serializeArtworkReaderFloatingPosition,
  type ArtworkReaderFloatingPosition,
} from '~/utils/artworkReaderFloatingPosition'
import {
  clampReaderColumns,
  clampReaderWidth,
  DEFAULT_READER_WIDTH,
  getArtworkDownloadFilename,
  getArtworkPageFilename,
  getOriginalImageExtension,
  getReaderAlignedRows,
  getReaderImageSource,
  getViewerSpreadIndices,
  getViewerStepIndex,
  READER_WIDTH_LIMITS,
  shouldOpenArtworkReaderFromKey,
  type ReaderImageQuality,
} from '~/utils/artworkWaterfallReader'
import {
  clampReaderThreads,
  DEFAULT_READER_THREADS,
  READER_THREAD_LIMITS,
} from '~/utils/readerOriginalLoader'
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
const threads = ref(DEFAULT_READER_THREADS)
const threadsInput = ref<string | number>(DEFAULT_READER_THREADS)
const readerWidth = ref(DEFAULT_READER_WIDTH)
const doublePageMode = ref(false)
type ReaderLayoutMode = 'masonry' | 'aligned'
const layoutMode = ref<ReaderLayoutMode>('masonry')
const readerViewportWidth = ref(1200)
const readerViewportHeight = ref(800)
const downloading = ref(false)
const localPersistenceStore = useLocalPersistenceStore()
const settingsReady = ref(false)
const downloadCompletedCount = ref(0)
const downloadError = ref('')
const originals = useReaderOriginals({
  pages: () => props.pages,
  threads: () => threads.value,
})
// Aliased to top-level bindings: the template only auto-unwraps refs that are
// setup bindings, not properties reached through an object.
const preloadStates = originals.states
const loadedOriginalCount = originals.loadedCount
const currentPageIndex = ref(0)
const viewerIndex = ref(0)
const readerRef = ref<HTMLElement | null>(null)
const readerFloatingRef = ref<HTMLElement | null>(null)
const readerFloatingPosition = ref<ArtworkReaderFloatingPosition | null>(null)
const readerFloatingDragging = ref(false)
const lightboxRef = ref<HTMLElement | null>(null)
const waterfallRef = ref<{ renderer?: () => void } | null>(null)
const viewerImageBounds = reactive({ left: 88, right: 1112 })
const viewerPointer = reactive<{
  direction: -1 | 1 | null
  x: number
  y: number
}>({ direction: null, x: 0, y: 0 })
const viewerTransitioning = ref(false)
let previousBodyOverflow = ''
let scrollFrame = 0
let menuCollapseTimer = 0
let columnLayoutTimer = 0
let downloadRun = 0
let viewerStepGeneration = 0
let floatingDragStartX = 0
let floatingDragStartY = 0
let floatingDragOriginLeft = 0
let floatingDragOriginTop = 0
let suppressFloatingTrigger = false

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
const readerShellStyle = computed(() => ({
  '--reader-width': `${readerWidth.value}px`,
}))
const { contentWidth: artworkContentWidth, sidebarWidth: artworkSidebarWidth } =
  useArtworkDirectoryTuning()
const readerFloatingStyle = computed(() => ({
  '--reader-artwork-content-width': `${artworkContentWidth.value}px`,
  '--reader-artwork-sidebar-width': `${artworkSidebarWidth.value}px`,
  ...(readerFloatingPosition.value
    ? {
        left: `${readerFloatingPosition.value.left}px`,
        top: `${readerFloatingPosition.value.top}px`,
        right: 'auto',
        bottom: 'auto',
      }
    : {}),
}))
const readerToolboxAbove = computed(
  () =>
    !!readerFloatingPosition.value &&
    readerFloatingPosition.value.top > readerViewportHeight.value / 2
)
const readerToolboxAlignLeft = computed(
  () =>
    !!readerFloatingPosition.value && readerFloatingPosition.value.left < 300
)
const downloadLabel = computed(() => {
  if (!downloading.value) return '下载作品'
  if (downloadCompletedCount.value < props.pages.length) {
    return `下载 ${downloadCompletedCount.value}/${props.pages.length}`
  }
  return props.pages.length > 1 ? '打包中…' : '保存中…'
})
const readerBreakpoints = computed(() => ({
  9999: { rowPerView: layoutColumns.value },
  760: { rowPerView: 1 },
}))
const viewerCursorStyle = computed(() => ({
  left: `${viewerPointer.x}px`,
  top: `${viewerPointer.y}px`,
}))

function handleTrigger() {
  cancelMenuCollapse()
  if (!active.value) {
    openReader()
    return
  }
  menuOpen.value = !menuOpen.value
}

function clampFloatingPosition(
  position: ArtworkReaderFloatingPosition
): ArtworkReaderFloatingPosition {
  const floating = readerFloatingRef.value
  if (!floating) return position

  return clampArtworkReaderFloatingPosition(
    position,
    { width: window.innerWidth, height: window.innerHeight },
    { width: floating.offsetWidth, height: floating.offsetHeight }
  )
}

function persistFloatingPosition() {
  if (!readerFloatingPosition.value) return
  try {
    localStorage.setItem(
      ARTWORK_READER_FLOATING_POSITION_KEY,
      serializeArtworkReaderFloatingPosition(readerFloatingPosition.value)
    )
  } catch {
    // Dragging remains usable when browser storage is unavailable.
  }
}

function moveFloatingDrag(event: PointerEvent) {
  const deltaX = event.clientX - floatingDragStartX
  const deltaY = event.clientY - floatingDragStartY
  if (!readerFloatingDragging.value && Math.hypot(deltaX, deltaY) < 4) return

  readerFloatingDragging.value = true
  menuOpen.value = false
  readerFloatingPosition.value = clampFloatingPosition({
    left: floatingDragOriginLeft + deltaX,
    top: floatingDragOriginTop + deltaY,
  })
  event.preventDefault()
}

function stopFloatingDrag() {
  window.removeEventListener('pointermove', moveFloatingDrag)
  window.removeEventListener('pointerup', stopFloatingDrag)
  window.removeEventListener('pointercancel', stopFloatingDrag)
  if (!readerFloatingDragging.value) return

  readerFloatingDragging.value = false
  suppressFloatingTrigger = true
  persistFloatingPosition()
}

function startFloatingDrag(event: PointerEvent) {
  if (event.button !== 0 || !readerFloatingRef.value) return

  const rect = readerFloatingRef.value.getBoundingClientRect()
  floatingDragStartX = event.clientX
  floatingDragStartY = event.clientY
  floatingDragOriginLeft = rect.left
  floatingDragOriginTop = rect.top
  window.addEventListener('pointermove', moveFloatingDrag, { passive: false })
  window.addEventListener('pointerup', stopFloatingDrag)
  window.addEventListener('pointercancel', stopFloatingDrag)
}

function handleFloatingTrigger(event: MouseEvent) {
  if (suppressFloatingTrigger) {
    suppressFloatingTrigger = false
    event.preventDefault()
    return
  }
  handleTrigger()
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
  if (preloadOriginals.value) originals.preload(0)
}

function closeReader() {
  originals.stop()
  cancelMenuCollapse()
  cancelDownload()
  viewerStepGeneration++
  viewerTransitioning.value = false
  clearViewerPointer()
  active.value = false
  menuOpen.value = false
  viewerOpen.value = false
  document.body.style.overflow = previousBodyOverflow
}

async function openViewer(index: number) {
  viewerIndex.value = index
  viewerOpen.value = true
  menuOpen.value = false
  await nextTick()
  updateViewerNavBounds()
  if (preloadOriginals.value) originals.preload(index)
}

function closeViewer() {
  viewerStepGeneration++
  viewerTransitioning.value = false
  clearViewerPointer()
  viewerOpen.value = false
}

async function stepViewer(step: number) {
  if (viewerTransitioning.value) return
  const nextIndex = getViewerStepIndex(
    props.pages.length,
    viewerIndex.value,
    step,
    doublePageMode.value
  )
  if (nextIndex === viewerIndex.value) return
  const generation = ++viewerStepGeneration
  const targetIndices = getViewerSpreadIndices(
    props.pages.length,
    nextIndex,
    doublePageMode.value
  )
  viewerTransitioning.value = true
  await Promise.all(targetIndices.map(prepareViewerImage))
  if (
    generation !== viewerStepGeneration ||
    !viewerOpen.value ||
    !active.value
  ) {
    return
  }
  viewerIndex.value = nextIndex
  await nextTick()
  updateViewerNavBounds()
  updateViewerPointerDirection()
  viewerTransitioning.value = false
  if (preloadOriginals.value) originals.preload(viewerIndex.value)
}

async function prepareViewerImage(index: number): Promise<void> {
  const page = props.pages[index]
  if (!page) return

  // Pull the bytes through the shared loader first — with priority, so the page
  // being flipped to jumps ahead of the background sweep — then let the browser
  // decode them straight out of its cache.
  await originals.ensure(index, true).catch(() => {})

  return new Promise((resolve) => {
    const image = new Image()
    const finish = () => {
      image.onload = null
      image.onerror = null
      void image
        .decode()
        .catch(() => {})
        .finally(resolve)
    }
    image.onload = finish
    image.onerror = resolve
    image.src = page.urls.original
    if (image.complete) finish()
  })
}

function getGridFallback(page: ArtworkGallery): string {
  if (imageQuality.value === 'original') return page.urls.regular
  if (imageQuality.value === 'regular') return page.urls.small
  return page.urls.thumb_mini
}

async function handleViewerImageLoad(index: number) {
  originals.markLoaded(index)
  await nextTick()
  updateViewerNavBounds()
}

function handleGridImageLoad(index: number) {
  if (imageQuality.value === 'original') originals.markLoaded(index)
}

function adjustThreads(step: number) {
  threads.value = clampReaderThreads(threads.value + step)
}

function commitThreads() {
  // `type="number"` makes v-model hand back a number, so normalise before trim.
  const raw = String(threadsInput.value ?? '').trim()
  const parsed = Number(raw)
  const next =
    raw && Number.isFinite(parsed) ? clampReaderThreads(parsed) : threads.value
  threads.value = next
  threadsInput.value = next
}

function selectThreadInput(event: FocusEvent) {
  ;(event.target as HTMLInputElement).select()
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
  readerViewportHeight.value = window.innerHeight
  if (readerFloatingPosition.value) {
    readerFloatingPosition.value = clampFloatingPosition(
      readerFloatingPosition.value
    )
    persistFloatingPosition()
  }
  if (viewerOpen.value) updateViewerNavBounds()
}

function updateViewerNavBounds() {
  const lightbox = lightboxRef.value
  const viewportWidth = window.innerWidth
  const images = lightbox
    ? Array.from(
        lightbox.querySelectorAll<HTMLImageElement>(
          '.reader-lightbox__page img'
        )
      )
    : []
  const rects = images
    .map((image) => image.getBoundingClientRect())
    .filter((rect) => rect.width > 0 && rect.height > 0)

  viewerImageBounds.left = rects.length
    ? Math.max(0, Math.min(...rects.map((rect) => rect.left)))
    : Math.min(88, viewportWidth / 2)
  viewerImageBounds.right = rects.length
    ? Math.min(viewportWidth, Math.max(...rects.map((rect) => rect.right)))
    : Math.max(viewportWidth - 88, viewportWidth / 2)
}

function getViewerPointerDirection(clientX: number): -1 | 1 | null {
  if (clientX < viewerImageBounds.left && viewerCanGoPrevious.value) return -1
  if (clientX > viewerImageBounds.right && viewerCanGoNext.value) return 1
  return null
}

function updateViewerPointerDirection() {
  viewerPointer.direction = getViewerPointerDirection(viewerPointer.x)
}

function handleViewerPointerMove(event: PointerEvent) {
  viewerPointer.x = event.clientX
  viewerPointer.y = event.clientY
  const target = event.target as Element
  viewerPointer.direction = target.closest('button, img')
    ? null
    : getViewerPointerDirection(event.clientX)
}

function clearViewerPointer() {
  viewerPointer.direction = null
}

function handleViewerClick(event: MouseEvent) {
  const target = event.target as Element
  if (target.closest('button, img')) return
  const direction = getViewerPointerDirection(event.clientX)
  if (direction) {
    void stepViewer(direction)
    return
  }
  closeViewer()
}

function handleReaderBackgroundClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  // A handler that runs earlier in the same click can re-render and detach the
  // node that was clicked, and closest() on a detached node matches nothing.
  // Without this the download button used to close the reader on its own click.
  if (!target.isConnected) return
  if (
    target.closest(
      '.reader-heading, .reader-page, .reader-lightbox, .reader-toolbox, .reader-trigger'
    )
  ) {
    return
  }
  closeReader()
}

function handleHeadingClick(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.isConnected) return
  // The title stays clickable-through so it can still be selected and copied.
  if (target.closest('button, input, a, .reader-heading__copy strong')) return
  closeReader()
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

function cancelDownload() {
  downloadRun++
  downloading.value = false
  downloadCompletedCount.value = 0
}

async function downloadArtwork() {
  if (downloading.value || !props.pages.length) return
  cancelMenuCollapse()
  menuOpen.value = false
  downloading.value = true
  downloadCompletedCount.value = 0
  downloadError.value = ''
  const run = ++downloadRun

  try {
    // Queue every page at once and let the shared gate decide how many run in
    // parallel. Pages the preloader already cached resolve without a request,
    // which is why downloading no longer has to wait for the sweep to finish.
    let fetched = 0
    const requests = props.pages.map((_, index) =>
      originals.ensure(index).then((blob) => {
        if (run === downloadRun) downloadCompletedCount.value = ++fetched
        return blob
      })
    )
    // Each request is awaited below; this only stops the siblings from being
    // reported as unhandled rejections while they wait their turn.
    for (const request of requests) request.catch(() => {})

    if (props.pages.length === 1) {
      const page = props.pages[0]!
      const blob = await requests[0]!
      if (!blob || run !== downloadRun) return
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
      const blob = await requests[index]!
      if (!blob || run !== downloadRun) return
      await zipWriter.add(
        getArtworkPageFilename(props.illustId, index, page.urls.original),
        new BlobReader(blob)
      )
    }
    const archive = await zipWriter.close()
    if (run !== downloadRun) return
    saveDownload(
      archive,
      getArtworkDownloadFilename(props.title, props.illustId, true)
    )
  } catch (error) {
    if (run !== downloadRun) return
    if (error instanceof DOMException && error.name === 'AbortError') return
    downloadError.value =
      error instanceof Error ? error.message : '作品下载失败，请稍后重试'
  } finally {
    if (run === downloadRun) downloading.value = false
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
  try {
    readerFloatingPosition.value = parseArtworkReaderFloatingPosition(
      localStorage.getItem(ARTWORK_READER_FLOATING_POSITION_KEY)
    )
  } catch {
    readerFloatingPosition.value = null
  }
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('resize', syncReaderViewport)
  syncReaderViewport()
  await localPersistenceStore.init().catch(() => {})
  const saved = localPersistenceStore.preferences.artworkReader
  columns.value = clampReaderColumns(saved.columns)
  layoutColumns.value = columns.value
  imageQuality.value = saved.imageQuality
  preloadOriginals.value = saved.preloadOriginals
  doublePageMode.value = saved.doublePageMode
  layoutMode.value = saved.layoutMode
  threads.value = clampReaderThreads(saved.threads)
  threadsInput.value = threads.value
  readerWidth.value = clampReaderWidth(saved.width)
  await nextTick()
  settingsReady.value = true
})

watch(threads, (value) => {
  threadsInput.value = value
})

watch(
  [
    columns,
    imageQuality,
    preloadOriginals,
    doublePageMode,
    layoutMode,
    threads,
    readerWidth,
  ],
  (
    [
      nextColumns,
      nextQuality,
      nextPreload,
      nextDoublePage,
      nextLayoutMode,
      nextThreads,
      nextWidth,
    ],
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
          threads: nextThreads,
          width: nextWidth,
        },
      })
      .catch(() => {})
    if (!previous || nextPreload === previous[2] || !active.value) return
    if (nextPreload) {
      originals.preload(currentPageIndex.value)
    } else if (!downloading.value) {
      // Stopping the sweep would also drop the queued download requests.
      originals.stop()
    }
  }
)

watch(layoutMode, async (nextMode) => {
  if (!active.value || nextMode !== 'masonry') return
  await nextTick()
  waterfallRef.value?.renderer?.()
})

watch([viewerOpen, viewerPageIndices], async ([open]) => {
  if (!open) return
  await nextTick()
  updateViewerNavBounds()
})

watch(
  () => props.illustId,
  () => {
    if (active.value) closeReader()
    originals.reset()
  }
)

onBeforeUnmount(() => {
  stopFloatingDrag()
  cancelMenuCollapse()
  if (columnLayoutTimer) window.clearTimeout(columnLayoutTimer)
  cancelDownload()
  originals.reset()
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
  overflow-x: hidden;
  overflow-y: scroll;
  color: var(--pf-text);
  background:
    radial-gradient(
      circle at 10% 0%,
      color-mix(in srgb, var(--pf-pink) 12%, transparent),
      transparent 30rem
    ),
    var(--pf-bg);
  overscroll-behavior: contain;
  // Reading is click-heavy (page flips, opening the viewer). Without this a
  // fast double click lands on a label like "双页" or a page number and leaves
  // a text selection behind, which browsers and extensions then act on.
  user-select: none;
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
  // Keeps the header lined up with the content column below.
  padding: 12px max(12px, calc((100vw - var(--reader-width, 2200px)) / 2));
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
    // The one string worth copying out of the reader; it sits in the header,
    // away from the click targets.
    user-select: text;
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
  right: max(16px, calc((100vw - var(--reader-width, 2200px)) / 2));
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
  // The reader is a full-screen modal with nothing beside it, so it gets a far
  // wider ceiling than the browsing grids and only a slim gutter. The ceiling
  // itself is the 界面宽度 slider in the reading tools.
  width: min(var(--reader-width, 2200px), calc(100% - 24px));
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
  // Same reason as the reader shell: the whole surface is a click target for
  // flipping pages, so nothing here should be selectable.
  user-select: none;
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

.reader-lightbox--cursor-nav {
  cursor: none;

  button,
  img {
    cursor: pointer;
  }
}

.reader-lightbox__cursor-nav {
  position: fixed;
  z-index: 5;
  display: grid;
  width: 44px;
  height: 44px;
  color: var(--pf-pink);
  background: rgb(255 255 255 / 92%);
  border: 1px solid color-mix(in srgb, var(--pf-pink) 45%, transparent);
  border-radius: 999px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 30%);
  pointer-events: none;
  place-items: center;
  transform: translate(-50%, -50%);
  will-change: left, top;

  svg {
    width: 24px;
    height: 24px;
  }
}

.reader-lightbox__cursor-nav--prev {
  color: color-mix(in srgb, var(--pf-pink) 84%, #6d5cff);
}

.reader-floating {
  position: fixed;
  top: 82px;
  left: min(
    calc(100vw - 96px),
    calc(
      max(24px, (100vw - 1440px) / 2) +
        min(
          var(--reader-artwork-content-width),
          calc(100vw - var(--reader-artwork-sidebar-width) - 96px)
        ) +
        28px + var(--reader-artwork-sidebar-width) + 16px
    )
  );
  z-index: 1250;

  &.is-dragging .reader-trigger {
    cursor: grabbing;
  }
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
  cursor: grab;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 750;
  touch-action: none;
  user-select: none;

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
  top: calc(100% + 12px);
  right: 0;
  width: min(300px, calc(100vw - 36px));
  padding: 14px;
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-surface) 94%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  box-shadow: 0 16px 50px rgb(0 0 0 / 24%);
  backdrop-filter: blur(16px);
}

.reader-floating--toolbox-above .reader-toolbox {
  top: auto;
  bottom: calc(100% + 12px);
}

.reader-floating--toolbox-align-left .reader-toolbox {
  right: auto;
  left: 0;
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

  input {
    min-width: 0;
    padding: 0 4px;
    color: var(--pf-text);
    background: transparent;
    border: 0;
    border-radius: 7px;
    text-align: center;
    font: inherit;
    font-size: 0.76rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    appearance: textfield;

    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      margin: 0;
      appearance: none;
    }

    &:focus-visible {
      outline: 2px solid var(--pf-pink);
      outline-offset: -2px;
    }
  }
}

.reader-width-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 52px;
  min-height: 39px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  background: var(--pf-bg);
  border-radius: 10px;

  output {
    color: var(--pf-text);
    text-align: right;
    font-size: 0.72rem;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
}

.reader-width-slider {
  width: 100%;
  height: 4px;
  background: var(--pf-line);
  border-radius: 999px;
  cursor: pointer;
  appearance: none;

  &::-webkit-slider-thumb {
    width: 15px;
    height: 15px;
    background: var(--pf-pink);
    border: 0;
    border-radius: 999px;
    cursor: grab;
    appearance: none;
  }

  &::-moz-range-thumb {
    width: 15px;
    height: 15px;
    background: var(--pf-pink);
    border: 0;
    border-radius: 999px;
    cursor: grab;
  }

  &:focus-visible {
    outline: 2px solid var(--pf-pink);
    outline-offset: 4px;
  }
}

.reader-toolbox__note {
  margin: 10px 0 0;
  color: var(--pf-muted);
  font-size: 0.66rem;
  line-height: 1.55;
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
  .reader-floating {
    right: 12px;
    left: auto;
  }

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
    width: calc(100% - 16px);
    margin-top: 16px;
  }

  .reader-page {
    margin-bottom: 12px;
    border-radius: 12px;
  }

  .reader-lightbox__stage {
    padding: 64px 12px 80px;
  }

  .reader-lightbox__cursor-nav {
    display: none;
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
