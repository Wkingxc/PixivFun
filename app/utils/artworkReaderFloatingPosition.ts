export interface ArtworkReaderFloatingPosition {
  left: number
  top: number
}

export interface ArtworkReaderFloatingBounds {
  height: number
  width: number
}

export const ARTWORK_READER_FLOATING_POSITION_KEY =
  'pixivfun:artwork-reader-floating-position'

export function parseArtworkReaderFloatingPosition(
  value: string | null
): ArtworkReaderFloatingPosition | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as Partial<ArtworkReaderFloatingPosition>
    if (!Number.isFinite(parsed.left) || !Number.isFinite(parsed.top)) {
      return null
    }
    return { left: Number(parsed.left), top: Number(parsed.top) }
  } catch {
    return null
  }
}

export function clampArtworkReaderFloatingPosition(
  position: ArtworkReaderFloatingPosition,
  viewport: ArtworkReaderFloatingBounds,
  trigger: ArtworkReaderFloatingBounds,
  margin = 8
): ArtworkReaderFloatingPosition {
  const safeMargin = Math.max(0, margin)
  const maxLeft = Math.max(
    safeMargin,
    viewport.width - trigger.width - safeMargin
  )
  const maxTop = Math.max(
    safeMargin,
    viewport.height - trigger.height - safeMargin
  )
  return {
    left: Math.min(Math.max(position.left, safeMargin), maxLeft),
    top: Math.min(Math.max(position.top, safeMargin), maxTop),
  }
}

export function serializeArtworkReaderFloatingPosition(
  position: ArtworkReaderFloatingPosition
): string {
  return JSON.stringify({
    left: Math.round(position.left),
    top: Math.round(position.top),
  })
}
