export type ExplicitTheme = 'light' | 'dark'
export type AuthorArtworkCategory = 'illust' | 'manga'
export const BOOKMARK_PAGE_SIZE = 48

export interface AuthorArtworkEntry {
  id: string
  category: AuthorArtworkCategory
}

export function nextExplicitTheme(resolvedTheme: string): ExplicitTheme {
  return resolvedTheme === 'dark' ? 'light' : 'dark'
}

export function buildAuthorArtworkEntries(profile: {
  illusts: Record<string, unknown>
  manga: Record<string, unknown>
}): AuthorArtworkEntry[] {
  const seen = new Set<string>()
  const entries: AuthorArtworkEntry[] = []

  for (const [category, works] of [
    ['illust', profile.illusts],
    ['manga', profile.manga],
  ] as const) {
    for (const id of Object.keys(works)) {
      if (seen.has(id)) continue
      seen.add(id)
      entries.push({ id, category })
    }
  }

  return entries.sort((a, b) => Number(b.id) - Number(a.id))
}

export function getAuthorArtworkPage(
  entries: AuthorArtworkEntry[],
  page: number,
  pageSize = 6
): AuthorArtworkEntry[] {
  const safePage = Math.max(1, Math.floor(page))
  return entries.slice((safePage - 1) * pageSize, safePage * pageSize)
}

export function getAuthorArtworkPositionPage(
  position: number | null,
  pageSize = 6
): number {
  if (!position || position < 1) return 1
  return Math.ceil(position / Math.max(1, Math.floor(pageSize)))
}

export function getWheelPageTarget(
  currentPage: number,
  totalPages: number,
  deltaY: number
): number {
  const safeTotal = Math.max(1, Math.floor(totalPages))
  const safeCurrent = Math.min(Math.max(1, Math.floor(currentPage)), safeTotal)
  if (deltaY === 0) return safeCurrent

  return Math.min(Math.max(safeCurrent + (deltaY > 0 ? 1 : -1), 1), safeTotal)
}

export function orderAuthorArtworkPage<T extends { id: string }>(
  entries: AuthorArtworkEntry[],
  works: Record<string, T>
): T[] {
  return entries.flatMap((entry) => {
    const work = works[entry.id]
    return work ? [work] : []
  })
}

export function getVisibleArtworkPages<T>(
  pages: readonly T[],
  expanded: boolean
): T[] {
  return expanded ? [...pages] : pages.slice(0, 1)
}

export function isBookmarkTab(tab: string): boolean {
  return tab === 'public_bookmarks' || tab === 'hidden_bookmarks'
}

export function isArtworkGridTab(tab: string): boolean {
  return tab === 'illusts' || tab === 'mangas' || isBookmarkTab(tab)
}

export function bookmarkPageOffset(
  page: number,
  pageSize = BOOKMARK_PAGE_SIZE
): number {
  const safePage = Math.max(1, Math.floor(page))
  return (safePage - 1) * pageSize
}

export function userArtworkTagPageOffset(page: number, pageSize = 24): number {
  const safePage = Math.max(1, Math.floor(page))
  return (safePage - 1) * Math.max(1, Math.floor(pageSize))
}

export function safeRankingCandidates<T extends { xRestrict: number }>(
  artworks: readonly T[],
  maxRank = artworks.length
): T[] {
  return artworks
    .slice(0, Math.max(0, maxRank))
    .filter((artwork) => artwork.xRestrict === 0)
}
