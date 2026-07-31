export interface AuthorArtworkVisibilityPage {
  ids: string[]
  page: number
  total: number
}

export function getAuthorArtworkVisibilityPage(
  allIds: readonly string[],
  hiddenIds: ReadonlySet<string>,
  page: number,
  pageSize: number,
  showHidden: boolean
): AuthorArtworkVisibilityPage {
  const visibleIds = allIds.filter((id) => hiddenIds.has(id) === showHidden)
  const safePageSize = Math.max(1, Math.floor(pageSize))
  const maxPage = Math.max(1, Math.ceil(visibleIds.length / safePageSize))
  const safePage = Math.min(Math.max(1, Math.floor(page)), maxPage)

  return {
    ids: visibleIds.slice(
      (safePage - 1) * safePageSize,
      safePage * safePageSize
    ),
    page: safePage,
    total: visibleIds.length,
  }
}
