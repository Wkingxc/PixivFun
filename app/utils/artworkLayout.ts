import { toOriginalUrl, toRegularUrl, toSmallUrl } from './pximg.ts'

export const ARTWORK_LAYOUT_DEFAULTS = {
  width: 1840,
  columns: 6,
  imageQuality: 'small',
  /** 0 disables the page-count filter — every artwork stays visible. */
  minPageCount: 0,
} as const

export const ARTWORK_LAYOUT_LIMITS = {
  width: { min: 720, max: 2000, step: 20 },
  columns: { min: 2, max: 10, step: 1 },
  minPageCount: { min: 0, max: 30, step: 1 },
} as const

export type ArtworkLayoutViewport = 'wide' | 'narrow' | 'tablet' | 'compact'
export type ArtworkCardImageQuality = 'small' | 'regular' | 'original'

export function normalizeArtworkLayoutValue(
  value: unknown,
  fallback: number,
  limits: { min: number; max: number }
): number {
  const numeric = Number(value)
  const normalized = Number.isFinite(numeric) ? numeric : fallback
  return Math.min(limits.max, Math.max(limits.min, Math.round(normalized)))
}

export function getEffectiveArtworkColumns(
  columns: number,
  viewport: ArtworkLayoutViewport
): number {
  if (viewport === 'compact') return Math.min(2, columns)
  if (viewport === 'tablet') return Math.min(3, columns)
  if (viewport === 'narrow') return Math.min(4, columns)
  return columns
}

export function resolveArtworkCardImageQuality(
  value: unknown
): ArtworkCardImageQuality {
  return value === 'regular' || value === 'original' ? value : 'small'
}

/**
 * Keep only artworks with strictly more than `minPageCount` pages. Entries
 * without a usable page count are treated as single page works, and a
 * threshold of 0 (the default) is a no-op that returns the original list.
 */
export function filterArtworksByPageCount<T>(
  items: readonly T[],
  minPageCount: number
): T[] {
  const threshold = normalizeArtworkLayoutValue(
    minPageCount,
    ARTWORK_LAYOUT_DEFAULTS.minPageCount,
    ARTWORK_LAYOUT_LIMITS.minPageCount
  )
  if (threshold <= 0) return items as T[]
  return items.filter((item) => {
    const pageCount = Number((item as { pageCount?: unknown })?.pageCount)
    return (Number.isFinite(pageCount) ? pageCount : 1) > threshold
  })
}

export function getArtworkCardImageUrl(
  imageUrl: string,
  quality: ArtworkCardImageQuality
): string {
  if (quality === 'small') return toSmallUrl(imageUrl)
  if (quality === 'regular') return toRegularUrl(imageUrl)
  if (quality === 'original') return toOriginalUrl(imageUrl)
  return toSmallUrl(imageUrl)
}
