export type PixivResourceType = 'artwork' | 'author'

export interface PixivResource {
  type: PixivResourceType
  id: string
  key: `${PixivResourceType}:${string}`
}

const LOCALE_SEGMENTS = new Set([
  'en',
  'ja',
  'ko',
  'zh',
  'zh-cn',
  'zh-hans',
  'zh-hant',
  'zh-tw',
])

const ARTWORK_ROUTES = new Set(['artworks', 'illust', 'i'])
const AUTHOR_ROUTES = new Set(['users', 'user', 'u'])
const PIXIV_ID_PATTERN = /^\d+$/

export function normalizePixivId(value: unknown): string | null {
  const id =
    typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : typeof value === 'string'
        ? value.trim()
        : ''
  return PIXIV_ID_PATTERN.test(id) ? id : null
}

export function parsePixivResource(
  input: string,
  base = 'http://localhost'
): PixivResource | null {
  let url: URL
  try {
    url = new URL(input, base)
  } catch {
    return null
  }

  const segments = url.pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => decodeURIComponent(segment).toLowerCase())
  if (segments[0] && LOCALE_SEGMENTS.has(segments[0])) segments.shift()
  if (segments.length !== 2) return null

  const id = normalizePixivId(segments[1])
  if (!id) return null
  if (ARTWORK_ROUTES.has(segments[0]!)) {
    return { type: 'artwork', id, key: `artwork:${id}` }
  }
  if (AUTHOR_ROUTES.has(segments[0]!)) {
    return { type: 'author', id, key: `author:${id}` }
  }
  return null
}
