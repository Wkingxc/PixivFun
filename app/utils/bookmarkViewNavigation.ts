export type BookmarkViewTab = 'public_bookmarks' | 'hidden_bookmarks'
export const BOOKMARK_VIEW_MAX_AGE_MS = 30 * 60 * 1000

export interface BookmarkViewState {
  version: 1
  userId: string
  tab: BookmarkViewTab
  page: number
  tag: string
  scrollTop: number
  savedAt: number
}

export function bookmarkViewStorageKey(
  userId: string,
  tab: BookmarkViewTab
): string {
  return `pixivfun:bookmark-view:${userId}:${tab}`
}

export function createBookmarkViewState(
  state: Omit<BookmarkViewState, 'version'>
): BookmarkViewState {
  return {
    version: 1,
    userId: String(state.userId),
    tab: state.tab,
    page: Math.max(1, Math.floor(state.page)),
    tag: state.tag,
    scrollTop: Math.max(0, state.scrollTop),
    savedAt: state.savedAt,
  }
}

export function serializeBookmarkViewState(state: BookmarkViewState): string {
  return JSON.stringify(state)
}

export function parseBookmarkViewState(
  value: string | null,
  userId: string,
  tab: string,
  now = Date.now()
): BookmarkViewState | null {
  if (!value) return null

  let state: Partial<BookmarkViewState>
  try {
    state = JSON.parse(value) as Partial<BookmarkViewState>
  } catch {
    return null
  }

  if (
    state.version !== 1 ||
    state.userId !== userId ||
    state.tab !== tab ||
    (state.tab !== 'public_bookmarks' && state.tab !== 'hidden_bookmarks') ||
    typeof state.page !== 'number' ||
    !Number.isFinite(state.page) ||
    state.page < 1 ||
    typeof state.tag !== 'string' ||
    typeof state.scrollTop !== 'number' ||
    !Number.isFinite(state.scrollTop) ||
    state.scrollTop < 0 ||
    typeof state.savedAt !== 'number' ||
    !Number.isFinite(state.savedAt) ||
    state.savedAt > now ||
    now - state.savedAt > BOOKMARK_VIEW_MAX_AGE_MS
  ) {
    return null
  }

  return createBookmarkViewState({
    userId: state.userId,
    tab: state.tab,
    page: state.page,
    tag: state.tag,
    scrollTop: state.scrollTop,
    savedAt: state.savedAt,
  })
}
