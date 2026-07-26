export type BookmarkVisibility = 'public' | 'private'

export interface BookmarkTagItem {
  name: string
  count: number
}

export interface BookmarkTagGroups {
  public: BookmarkTagItem[]
  private: BookmarkTagItem[]
}

export interface ArtworkBookmarkSettings {
  tags: string[]
  private: boolean
}

export const UNCLASSIFIED_BOOKMARK_TAG = '未分類'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function normalizeTagName(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  const record = asRecord(value)
  if (!record) return ''
  const name = record.tag ?? record.name ?? record.value
  return typeof name === 'string' ? name.trim() : ''
}

function normalizeTagCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const count = Number(value)
    if (Number.isFinite(count)) return count
  }
  const record = asRecord(value)
  if (!record) return 0
  return normalizeTagCount(record.count ?? record.cnt ?? record.total)
}

function normalizeTagList(value: unknown): BookmarkTagItem[] {
  const items: BookmarkTagItem[] = []

  if (Array.isArray(value)) {
    for (const entry of value) {
      const name = normalizeTagName(entry)
      if (name) items.push({ name, count: normalizeTagCount(entry) })
    }
  } else {
    const record = asRecord(value)
    if (record) {
      for (const [name, count] of Object.entries(record)) {
        const normalizedName = name.trim()
        if (normalizedName) {
          items.push({ name: normalizedName, count: normalizeTagCount(count) })
        }
      }
    }
  }

  return items
}

export function normalizeBookmarkTagGroups(
  payload: unknown
): BookmarkTagGroups {
  const root = asRecord(payload)
  const body = asRecord(root?.body) ?? root
  const tags = asRecord(body?.tags) ?? body
  return {
    public: normalizeTagList(tags?.public ?? tags?.show),
    private: normalizeTagList(tags?.private ?? tags?.hide),
  }
}

export function normalizeArtworkBookmarkSettings(
  payload: unknown,
  fallbackPrivate = false
): ArtworkBookmarkSettings {
  const root = asRecord(payload)
  const body = asRecord(root?.body) ?? root
  const bookmark = asRecord(body?.bookmarkData) ?? body
  const rawTags =
    bookmark?.tags ??
    bookmark?.bookmarkTags ??
    bookmark?.bookmark_tags ??
    body?.bookmarkTags
  const tags = Array.isArray(rawTags)
    ? [...new Set(rawTags.map(normalizeTagName).filter(Boolean))]
    : []
  const visibility =
    bookmark?.bookmarkRestrict ??
    bookmark?.restrict ??
    bookmark?.private ??
    body?.restrict
  const privateBookmark =
    visibility === true ||
    visibility === 1 ||
    visibility === '1' ||
    visibility === 'private' ||
    visibility === 'hide'

  return {
    tags,
    private:
      visibility === undefined || visibility === null
        ? fallbackPrivate
        : privateBookmark,
  }
}

export function splitBookmarkTagInput(input: string): string[] {
  return [
    ...new Set(
      input
        .split(/[\s,，、]+/u)
        .map((tag) => tag.trim())
        .filter(Boolean)
    ),
  ]
}

export function bookmarkListCacheKey(tag: string, page: number): string {
  return `${tag}::${page}`
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    quot: '"',
  }
  return value.replace(
    /&(?:#(\d+)|#x([\da-f]+)|([a-z]+));/giu,
    (_match, decimal: string, hex: string, name: string) => {
      if (decimal) return String.fromCodePoint(Number(decimal))
      if (hex) return String.fromCodePoint(Number.parseInt(hex, 16))
      return named[name.toLowerCase()] ?? _match
    }
  )
}

export function extractBookmarkTagsFromHtml(html: string): string[] {
  for (const input of html.match(/<input\b[^>]*>/giu) ?? []) {
    const name = input.match(/\bname\s*=\s*(["'])tag\1/iu)
    if (!name) continue
    const value = input.match(/\bvalue\s*=\s*(["'])(.*?)\1/iu)?.[2] ?? ''
    return splitBookmarkTagInput(decodeHtmlEntities(value))
  }
  return []
}

export function prioritizeBookmarkTags(
  items: BookmarkTagItem[],
  selectedTags: string[]
): BookmarkTagItem[] {
  const selectedOrder = new Map(selectedTags.map((tag, index) => [tag, index]))
  const itemMap = new Map(items.map((item) => [item.name, item]))
  for (const name of selectedTags) {
    if (name && !itemMap.has(name)) itemMap.set(name, { name, count: 0 })
  }
  return [...itemMap.values()]
    .filter((item) => item.name && item.name !== UNCLASSIFIED_BOOKMARK_TAG)
    .sort((left, right) => {
      const leftSelected = selectedOrder.get(left.name)
      const rightSelected = selectedOrder.get(right.name)
      if (leftSelected !== undefined || rightSelected !== undefined) {
        if (leftSelected === undefined) return 1
        if (rightSelected === undefined) return -1
        return leftSelected - rightSelected
      }
      return (
        right.count - left.count ||
        left.name.localeCompare(right.name, 'zh-Hans-CN')
      )
    })
}

export function getArtworkRecommendedBookmarkTags(
  artworkTags: string[],
  userTags: BookmarkTagItem[]
): BookmarkTagItem[] {
  const userTagNames = new Set(userTags.map((tag) => tag.name))
  return [...new Set(artworkTags)]
    .filter(
      (name) =>
        name && name !== UNCLASSIFIED_BOOKMARK_TAG && !userTagNames.has(name)
    )
    .map((name) => ({ name, count: 0 }))
}

export function mergeBookmarkTags(
  currentTags: string[],
  addedTags: string[],
  limit = 10
): string[] {
  return [...new Set([...currentTags, ...addedTags])]
    .filter(Boolean)
    .slice(0, Math.max(0, limit))
}
