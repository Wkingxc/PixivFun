import type { ArtworkInfo } from '~/types'

export type BookmarkCollectionViewMode = 'artwork-tags' | 'authors'
export type BookmarkAuthorSort = 'count' | 'recent'

export interface BookmarkAuthorGroup {
  authorId: string
  authorName: string
  profileImageUrl: string
  latestBookmarkIndex: number
  works: ArtworkInfo[]
}

/**
 * Bookmark pages arrive newest-first. Keeping the first position for each
 * author gives us a stable "recently bookmarked" sort without pretending the
 * artwork publication date is the bookmark date.
 */
export function groupBookmarkWorksByAuthor(
  works: ArtworkInfo[],
  sort: BookmarkAuthorSort
): BookmarkAuthorGroup[] {
  const groups = new Map<string, BookmarkAuthorGroup>()

  works.forEach((work, index) => {
    const authorId = String(work.userId || '')
    const key = authorId || `unknown:${work.userName || 'author'}`
    const existing = groups.get(key)
    if (existing) {
      existing.works.push(work)
      return
    }

    groups.set(key, {
      authorId,
      authorName: work.userName || '未知作者',
      profileImageUrl: work.profileImageUrl || '',
      latestBookmarkIndex: index,
      works: [work],
    })
  })

  return [...groups.values()].sort((left, right) => {
    if (sort === 'count') {
      const countOrder = right.works.length - left.works.length
      if (countOrder) return countOrder
    }
    return (
      left.latestBookmarkIndex - right.latestBookmarkIndex ||
      left.authorName.localeCompare(right.authorName, 'zh-Hans-CN')
    )
  })
}

export function paginateBookmarkAuthorGroups<T>(
  groups: T[],
  page: number,
  pageSize: number
): T[] {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const safePageSize = Math.max(1, Math.floor(pageSize) || 1)
  const start = (safePage - 1) * safePageSize
  return groups.slice(start, start + safePageSize)
}
