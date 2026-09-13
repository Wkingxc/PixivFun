export const AUTHOR_DIRECTORY_TTL = 5 * 60_000
const NAMESPACE = 'author-category-directory-v1'

export interface AuthorDirectory {
  illusts: Record<string, null> | null
  manga: Record<string, null> | null
}

interface CacheRepository {
  getCache(namespace: string, key: string, now?: number): unknown | null
  setCache(
    namespace: string,
    key: string,
    value: unknown,
    expiresAt: number
  ): void
}

/** Cache only work IDs, scoped to the authenticated viewer. Never cache failures. */
export function createAuthorDirectoryCache(now = Date.now) {
  const pending = new Map<
    string,
    Promise<AuthorDirectory & { expiresAt: number }>
  >()
  return async (
    repository: CacheRepository,
    viewerId: string,
    authorId: string,
    fetchDirectory: () => Promise<AuthorDirectory>
  ) => {
    const key = `${viewerId}:${authorId}`
    const cached = repository.getCache(NAMESPACE, key, now()) as
      (AuthorDirectory & { expiresAt: number }) | null
    if (cached) return cached
    const existing = pending.get(key)
    if (existing) return existing
    const request = (async () => {
      const directory = await fetchDirectory()
      const result = {
        illusts: Object.fromEntries(
          Object.keys(directory.illusts ?? {})
            .filter((id) => /^\d+$/.test(id))
            .map((id) => [id, null])
        ),
        manga: Object.fromEntries(
          Object.keys(directory.manga ?? {})
            .filter((id) => /^\d+$/.test(id))
            .map((id) => [id, null])
        ),
        expiresAt: now() + AUTHOR_DIRECTORY_TTL,
      }
      repository.setCache(NAMESPACE, key, result, result.expiresAt)
      return result
    })()
    pending.set(key, request)
    try {
      return await request
    } finally {
      pending.delete(key)
    }
  }
}
