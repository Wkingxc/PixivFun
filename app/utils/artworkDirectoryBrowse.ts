export type ArtworkDirectoryMode = 'scroll' | 'page' | 'quick-page'

export const ARTWORK_DIRECTORY_DEFAULT_MODE: ArtworkDirectoryMode = 'page'
export const ARTWORK_DIRECTORY_MODE_STORAGE_KEY =
  'pixivfun:artwork-directory-mode'
export const ARTWORK_DIRECTORY_SCROLL_BATCH_PAGES = 50

export function normalizeArtworkDirectoryMode(
  value: unknown
): ArtworkDirectoryMode {
  return value === 'scroll' || value === 'quick-page' ? value : 'page'
}

export function getArtworkDirectoryScrollPage(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  totalPages: number
): number {
  const safeTotal = Math.max(1, Math.floor(totalPages))
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  if (maxScroll <= 0 || safeTotal === 1) return 1

  const ratio = Math.min(1, Math.max(0, scrollTop / maxScroll))
  return Math.min(safeTotal, Math.floor(ratio * safeTotal) + 1)
}

export function getArtworkDirectoryPageScrollTop(
  page: number,
  totalPages: number,
  scrollHeight: number,
  clientHeight: number
): number {
  const safeTotal = Math.max(1, Math.floor(totalPages))
  const safePage = Math.min(Math.max(1, Math.floor(page)), safeTotal)
  const maxScroll = Math.max(0, scrollHeight - clientHeight)
  if (maxScroll <= 0 || safeTotal === 1) return 0

  return ((safePage - 1) / (safeTotal - 1)) * maxScroll
}

export function getArtworkDirectoryPointerRatio(
  pointerY: number,
  trackTop: number,
  trackHeight: number,
  thumbSize: number,
  pointerOffset = 0
): number {
  const safeTrackHeight = Math.max(0, trackHeight)
  const safeThumbSize = Math.min(Math.max(0, thumbSize), safeTrackHeight)
  const travel = Math.max(1, safeTrackHeight - safeThumbSize)
  const thumbTop = pointerY - trackTop - safeThumbSize / 2 - pointerOffset
  return Math.min(1, Math.max(0, thumbTop / travel))
}

export function getArtworkDirectoryBatchStartPage(
  page: number,
  totalPages: number,
  batchSize = ARTWORK_DIRECTORY_SCROLL_BATCH_PAGES
): number {
  const safeTotal = Math.max(1, Math.floor(totalPages))
  const safeBatchSize = Math.max(1, Math.floor(batchSize))
  const safePage = Math.min(Math.max(1, Math.floor(page)), safeTotal)
  return Math.floor((safePage - 1) / safeBatchSize) * safeBatchSize + 1
}

export function getArtworkDirectoryBatchEndPage(
  startPage: number,
  totalPages: number,
  batchSize = ARTWORK_DIRECTORY_SCROLL_BATCH_PAGES
): number {
  const safeTotal = Math.max(1, Math.floor(totalPages))
  const safeBatchSize = Math.max(1, Math.floor(batchSize))
  const safeStart = getArtworkDirectoryBatchStartPage(
    startPage,
    safeTotal,
    safeBatchSize
  )
  return Math.min(safeTotal, safeStart + safeBatchSize - 1)
}

export function chunkArtworkDirectoryEntries<T>(
  entries: readonly T[],
  size: number
): T[][] {
  const chunkSize = Math.max(1, Math.floor(size))
  const chunks: T[][] = []
  for (let index = 0; index < entries.length; index += chunkSize) {
    chunks.push(entries.slice(index, index + chunkSize))
  }
  return chunks
}
