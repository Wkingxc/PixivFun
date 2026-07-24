const ARTWORK_DIRECTORY_SCROLL_PREFIX = 'pixivfun:directory-scroll:'
const ARTWORK_DIRECTORY_SCROLL_MAX_AGE = 30_000

interface ArtworkDirectoryScrollPayload {
  scrollTop: number
  savedAt: number
}

export function artworkDirectoryScrollKey(artworkId: string): string {
  return `${ARTWORK_DIRECTORY_SCROLL_PREFIX}${artworkId}`
}

export function serializeArtworkDirectoryScroll(
  scrollTop: number,
  savedAt = Date.now()
): string {
  return JSON.stringify({
    scrollTop: Math.max(0, scrollTop),
    savedAt,
  } satisfies ArtworkDirectoryScrollPayload)
}

export function parseArtworkDirectoryScroll(
  value: string | null,
  now = Date.now()
): number | null {
  if (!value) return null

  try {
    const payload = JSON.parse(value) as Partial<ArtworkDirectoryScrollPayload>
    if (
      typeof payload.scrollTop !== 'number' ||
      !Number.isFinite(payload.scrollTop) ||
      payload.scrollTop < 0 ||
      typeof payload.savedAt !== 'number' ||
      !Number.isFinite(payload.savedAt) ||
      now - payload.savedAt > ARTWORK_DIRECTORY_SCROLL_MAX_AGE ||
      payload.savedAt > now
    ) {
      return null
    }

    return payload.scrollTop
  } catch {
    return null
  }
}
