import type { ArtworkInfo } from '~/types'
import { BOOKMARK_PAGE_SIZE } from './refineModernArtwork.ts'

/**
 * Statistics over the tags an artwork carries itself (the author's tags),
 * which are unrelated to the bookmark tags the viewer assigns.
 */
export interface ArtworkTagStat {
  name: string
  count: number
}

/**
 * Pixiv exposes no "artwork tags inside my bookmarks" endpoint, so the index is
 * built by walking bookmark pages. Cap the walk so huge collections cannot fire
 * an unbounded number of requests.
 */
export const BOOKMARK_TAG_SCAN_PAGE_LIMIT = 20

function normalizeArtworkTags(work: ArtworkInfo | undefined): Set<string> {
  const tags = Array.isArray(work?.tags) ? work.tags : []
  const names = new Set<string>()
  for (const tag of tags) {
    const name = typeof tag === 'string' ? tag.trim() : ''
    if (name) names.add(name)
  }
  return names
}

/** Count how many works carry each artwork tag, most used first. */
export function collectArtworkTagStats(works: ArtworkInfo[]): ArtworkTagStat[] {
  const counts = new Map<string, number>()
  for (const work of works) {
    for (const name of normalizeArtworkTags(work)) {
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name, count }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.name.localeCompare(right.name, 'zh-Hans-CN')
    )
}

/** Keep works carrying every selected tag (AND), so filters can be stacked. */
export function filterWorksByArtworkTags(
  works: ArtworkInfo[],
  selectedTags: string[]
): ArtworkInfo[] {
  const wanted = [...new Set(selectedTags.map((tag) => tag.trim()))].filter(
    Boolean
  )
  if (!wanted.length) return works
  return works.filter((work) => {
    const owned = normalizeArtworkTags(work)
    return wanted.every((tag) => owned.has(tag))
  })
}

export function searchArtworkTagStats(
  stats: ArtworkTagStat[],
  query: string
): ArtworkTagStat[] {
  const keyword = query.trim().toLocaleLowerCase()
  if (!keyword) return stats
  return stats.filter((stat) => stat.name.toLocaleLowerCase().includes(keyword))
}

/**
 * Selected tags stay visible even when a search or the display limit would
 * drop them, otherwise the active filter becomes impossible to undo.
 */
export function pinSelectedArtworkTags(
  stats: ArtworkTagStat[],
  selectedTags: string[],
  limit: number
): ArtworkTagStat[] {
  const visible = stats.slice(0, Math.max(0, limit))
  const shown = new Set(visible.map((stat) => stat.name))
  for (const name of selectedTags) {
    if (!name || shown.has(name)) continue
    shown.add(name)
    visible.unshift(
      stats.find((stat) => stat.name === name) ?? { name, count: 0 }
    )
  }
  return visible
}

/** Client-side paging for lists that are filtered after they were fetched. */
export function paginateWorks<T>(
  items: T[],
  page: number,
  pageSize = BOOKMARK_PAGE_SIZE
): T[] {
  const safePage = Math.max(1, Math.floor(page) || 1)
  const start = (safePage - 1) * pageSize
  return items.slice(start, start + pageSize)
}
