import type {
  ArtworkInfo,
  NovelInfo,
  UserFeaturedArtwork,
  UserFeaturedNovel,
  UserFeaturedWork,
} from '~/types'

export const USER_FEATURED_WORK_LIMIT = 3

type RawPickupItem = Record<string, unknown>

interface FeaturedWorkAuthor {
  userId: `${number}`
  userName: string
  profileImageUrl: string
}

function numericId(value: unknown): `${number}` | null {
  const id = typeof value === 'number' ? String(value) : value
  return typeof id === 'string' && /^\d+$/.test(id) ? (id as `${number}`) : null
}

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeXRestrict(value: unknown): 0 | 1 | 2 {
  return value === 1 || value === 2 ? value : 0
}

function normalizeBookmarkData(value: unknown): ArtworkInfo['bookmarkData'] {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  const id = numericId(record.id)
  if (!id) return null
  return {
    id,
    private: Boolean(record.private),
    ...(Array.isArray(record.tags)
      ? {
          tags: record.tags.filter(
            (tag): tag is string => typeof tag === 'string'
          ),
        }
      : {}),
  }
}

function normalizeTranslation(
  value: unknown
): ArtworkInfo['titleCaptionTranslation'] {
  const record =
    value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  return {
    workTitle: typeof record.workTitle === 'string' ? record.workTitle : null,
    workCaption:
      typeof record.workCaption === 'string' ? record.workCaption : null,
  }
}

function normalizeCommon(item: RawPickupItem, author: FeaturedWorkAuthor) {
  const id = numericId(item.id)
  const url = text(item.url)
  if (!id || !url) return null

  return {
    id,
    title: text(item.title),
    description: text(item.description),
    createDate: text(item.createDate),
    updateDate: text(item.updateDate, text(item.createDate)),
    restrict: 0 as const,
    xRestrict: normalizeXRestrict(item.xRestrict),
    userId: numericId(item.userId) ?? author.userId,
    userName: text(item.userName, author.userName),
    isBookmarkable:
      typeof item.isBookmarkable === 'boolean' ? item.isBookmarkable : true,
    bookmarkData: normalizeBookmarkData(item.bookmarkData),
    titleCaptionTranslation: normalizeTranslation(item.titleCaptionTranslation),
    isUnlisted: Boolean(item.isUnlisted),
    aiType: numberValue(item.aiType, 0),
    url,
    tags: Array.isArray(item.tags)
      ? item.tags.filter((tag): tag is string => typeof tag === 'string')
      : [],
    profileImageUrl: text(item.profileImageUrl, author.profileImageUrl),
  }
}

function normalizePickupItem(
  item: RawPickupItem,
  author: FeaturedWorkAuthor
): UserFeaturedWork | null {
  const common = normalizeCommon(item, author)
  if (!common) return null

  if (item.type === 'illust') {
    const artwork: UserFeaturedArtwork = {
      ...common,
      type: 'illust',
      illustType: numberValue(item.illustType, 0) as 0 | 1 | 2,
      sl: numberValue(item.sl),
      alt: text(item.alt, common.title),
      width: numberValue(item.width),
      height: numberValue(item.height),
      pageCount: numberValue(item.pageCount, 1),
    }
    return artwork
  }

  if (item.type === 'novel') {
    const novel: UserFeaturedNovel = {
      ...common,
      type: 'novel',
      genre: text(item.genre) || undefined,
      textCount: optionalNumber(item.textCount),
      wordCount: optionalNumber(item.wordCount),
      readingTime: optionalNumber(item.readingTime),
      pageCount: optionalNumber(item.pageCount),
      bookmarkCount: optionalNumber(item.bookmarkCount),
    }
    return novel
  }

  return null
}

/**
 * Converts Pixiv's `/profile/all` pickup payload into local work-card data.
 * The slice happens before filtering so unsupported pickup types cannot make
 * later entries appear outside Pixiv's creator-defined three-item selection.
 */
export function normalizeUserFeaturedWorks(
  pickup: unknown,
  author: FeaturedWorkAuthor
): UserFeaturedWork[] {
  if (!Array.isArray(pickup)) return []
  return pickup.slice(0, USER_FEATURED_WORK_LIMIT).flatMap((value) => {
    if (!value || typeof value !== 'object') return []
    const item = normalizePickupItem(value as RawPickupItem, author)
    return item ? [item] : []
  })
}
