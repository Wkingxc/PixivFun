interface ReaderImagePage {
  urls: {
    small: string
    regular: string
    original: string
  }
}

export type ReaderImageQuality = 'small' | 'regular' | 'original'

const INVALID_FILENAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/g
const INTERACTIVE_SHORTCUT_TAGS = new Set([
  'A',
  'BUTTON',
  'INPUT',
  'SELECT',
  'SUMMARY',
  'TEXTAREA',
])

interface ArtworkReaderShortcutTarget {
  tagName?: string
  isContentEditable?: boolean
  closest?: (selectors: string) => unknown
}

interface ArtworkReaderShortcutEvent {
  key: string
  repeat?: boolean
  isComposing?: boolean
  target?: EventTarget | ArtworkReaderShortcutTarget | null
}

export function shouldOpenArtworkReaderFromKey(
  event: ArtworkReaderShortcutEvent
): boolean {
  if (event.key !== 'Enter' || event.repeat || event.isComposing) return false

  const target = event.target as ArtworkReaderShortcutTarget | null | undefined
  if (!target) return true
  if (
    target.isContentEditable ||
    (target.tagName &&
      INTERACTIVE_SHORTCUT_TAGS.has(target.tagName.toUpperCase()))
  ) {
    return false
  }
  return !target.closest?.(
    'a[href], button, input, select, summary, textarea, [contenteditable="true"], [role="button"], [role="link"], [role="menuitem"]'
  )
}

export function getReaderImageSource(
  page: ReaderImagePage,
  quality: ReaderImageQuality
): string {
  return page.urls[quality]
}

export function clampReaderColumns(columns: number): number {
  return Math.min(12, Math.max(1, Math.round(columns)))
}

/** Content-column width of the reader, in CSS pixels. */
export const READER_WIDTH_LIMITS = { min: 900, max: 3200, step: 20 } as const
export const DEFAULT_READER_WIDTH = 2200

export function clampReaderWidth(value: unknown): number {
  // Blank input means "unset", not zero, so it falls back instead of clamping.
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').trim() || NaN)
  if (!Number.isFinite(parsed)) return DEFAULT_READER_WIDTH
  const stepped =
    Math.round(parsed / READER_WIDTH_LIMITS.step) * READER_WIDTH_LIMITS.step
  return Math.min(
    READER_WIDTH_LIMITS.max,
    Math.max(READER_WIDTH_LIMITS.min, stepped)
  )
}

interface ReaderSizedPage {
  width: number
  height: number
}

export function getReaderAlignedRows(
  pages: ReaderSizedPage[],
  maximumItems: number
): number[][] {
  const rowLimit = clampReaderColumns(maximumItems)
  return Array.from(
    { length: Math.ceil(pages.length / rowLimit) },
    (_, rowIndex) => {
      const start = rowIndex * rowLimit
      return pages
        .slice(start, start + rowLimit)
        .map((_, offset) => start + offset)
    }
  )
}

export function getViewerSpreadIndices(
  pageCount: number,
  currentIndex: number,
  doublePage: boolean
): number[] {
  if (pageCount <= 0) return []
  const current = Math.min(pageCount - 1, Math.max(0, currentIndex))
  if (!doublePage || pageCount === 1) return [current]

  if (pageCount % 2 === 1 && current === pageCount - 1) {
    return [current - 1, current]
  }
  const start = current - (current % 2)
  return [start, start + 1].filter((index) => index < pageCount)
}

export function getViewerStepIndex(
  pageCount: number,
  currentIndex: number,
  direction: number,
  doublePage: boolean
): number {
  if (pageCount <= 0) return 0
  const current = Math.min(pageCount - 1, Math.max(0, currentIndex))
  if (!doublePage) {
    return Math.min(pageCount - 1, Math.max(0, current + Math.sign(direction)))
  }

  const spread = getViewerSpreadIndices(pageCount, current, true)
  const first = spread[0] ?? current
  const last = spread.at(-1) ?? current
  if (direction > 0) {
    return last >= pageCount - 1 ? current : Math.min(first + 2, pageCount - 1)
  }
  if (direction < 0) {
    if (first <= 0) return current
    if (pageCount % 2 === 1 && current === pageCount - 1) {
      return Math.max(0, current - 2)
    }
    return Math.max(0, first - 2)
  }
  return current
}

export const VIEWER_BROWSE_PRELOAD_BEFORE = 3
export const VIEWER_BROWSE_PRELOAD_AFTER = 5

/**
 * Nearby pages to prepare when full original preloading is disabled. The
 * nearest forward page is queued first, then the nearest previous page, so
 * both navigation directions stay responsive without starting a full sweep.
 */
export function getViewerBrowsePreloadIndices(
  pageCount: number,
  currentIndex: number,
  before = VIEWER_BROWSE_PRELOAD_BEFORE,
  after = VIEWER_BROWSE_PRELOAD_AFTER
): number[] {
  if (pageCount <= 0) return []
  const current = Math.min(
    pageCount - 1,
    Math.max(0, Math.trunc(currentIndex) || 0)
  )
  const previousCount = Math.max(0, Math.trunc(before) || 0)
  const nextCount = Math.max(0, Math.trunc(after) || 0)
  const indices: number[] = []

  for (
    let distance = 1;
    distance <= Math.max(previousCount, nextCount);
    distance++
  ) {
    const next = current + distance
    if (distance <= nextCount && next < pageCount) indices.push(next)
    const previous = current - distance
    if (distance <= previousCount && previous >= 0) indices.push(previous)
  }
  return indices
}

export function getOriginalImageExtension(url: string): string {
  const pathname = url.split(/[?#]/, 1)[0] || ''
  const extension = pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase()
  return extension &&
    ['avif', 'gif', 'jpeg', 'jpg', 'png', 'webp'].includes(extension)
    ? extension
    : 'jpg'
}

export function getArtworkPageFilename(
  illustId: string,
  index: number,
  originalUrl: string
): string {
  return `${illustId}_p${index}.${getOriginalImageExtension(originalUrl)}`
}

export function getArtworkDownloadFilename(
  title: string,
  illustId: string,
  archived: boolean,
  extension = 'jpg'
): string {
  const safeTitle =
    title
      .replace(INVALID_FILENAME_CHARACTERS, '_')
      .replace(/[.\s]+$/g, '')
      .trim()
      .slice(0, 120) || 'pixiv-artwork'
  return `${safeTitle}-${illustId}.${archived ? 'zip' : extension}`
}
