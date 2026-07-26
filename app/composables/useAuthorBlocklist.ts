import { useLocalPersistenceStore } from '~/stores/local-persistence'
import type { BlockedAuthor } from '~~/shared/local-preferences'

interface HasUserId {
  userId?: string | number | null
}

/**
 * Central author-blocklist helpers. Blocked authors' works and cards are
 * filtered out of every list flow; the user's own bookmarks and direct
 * visits to a blocked author's page are exempt (the page shows a banner
 * instead).
 */
export function useAuthorBlocklist() {
  const localPersistence = useLocalPersistenceStore()

  const blockedAuthors = computed<BlockedAuthor[]>(
    () => localPersistence.preferences.contentFilter.blockedAuthors
  )

  const blockedIds = computed(
    () => new Set(blockedAuthors.value.map((entry) => entry.id))
  )

  function isBlocked(userId: string | number | null | undefined): boolean {
    if (userId === null || userId === undefined) return false
    return blockedIds.value.has(String(userId))
  }

  /** Drop items authored by blocked users. Works for artwork/novel/user lists. */
  function filterBlocked<T extends HasUserId>(list: T[]): T[] {
    if (!blockedIds.value.size) return list
    return list.filter((item) => !isBlocked(item.userId))
  }

  async function blockAuthor(author: {
    id: string | number
    name: string
  }): Promise<void> {
    const id = String(author.id)
    if (!/^\d+$/.test(id) || blockedIds.value.has(id)) return
    const next: BlockedAuthor[] = [
      ...blockedAuthors.value,
      { id, name: author.name, addedAt: Date.now() },
    ]
    await localPersistence.patchPreferences({
      contentFilter: { blockedAuthors: next },
    })
  }

  async function unblockAuthor(userId: string | number): Promise<void> {
    const id = String(userId)
    if (!blockedIds.value.has(id)) return
    const next = blockedAuthors.value.filter((entry) => entry.id !== id)
    await localPersistence.patchPreferences({
      contentFilter: { blockedAuthors: next },
    })
  }

  return {
    blockedAuthors,
    isBlocked,
    filterBlocked,
    blockAuthor,
    unblockAuthor,
  }
}
