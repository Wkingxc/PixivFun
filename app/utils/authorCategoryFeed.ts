import { buildAuthorArtworkEntries } from './refineModernArtwork.ts'

export const AUTHOR_CATEGORY_PAGE_SIZE = 60
const REQUEST_CONCURRENCY = 4
const METADATA_BATCH_SIZE = 48
const DIRECTORY_TTL = 5 * 60_000
const MAX_CACHED_ARTWORKS = 1200

interface CategoryArtwork {
  id: string
  userId: string
  createDate: string
}

interface CategoryEntry {
  id: string
  authorId: string
  category: 'illust' | 'manga'
}

interface CategoryFeedClient<T> {
  getUserProfileAll(authorId: string): Promise<{
    illusts: Record<string, null> | null
    manga: Record<string, null> | null
    expiresAt?: number
  }>
  getUserIllusts(
    authorId: string,
    ids: string[],
    category: string
  ): Promise<Record<string, T>>
}

async function mapLimited<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const workers = Array.from(
    { length: Math.min(REQUEST_CONCURRENCY, items.length) },
    async () => {
      while (next < items.length) {
        signal?.throwIfAborted()
        const index = next++
        results[index] = await operation(items[index]!)
      }
    }
  )
  // Wait for the bounded in-flight requests before surfacing failure.
  const settled = await Promise.allSettled(workers)
  signal?.throwIfAborted()
  const failure = settled.find((result) => result.status === 'rejected')
  if (failure?.status === 'rejected') throw failure.reason
  return results
}

/** Independent author archive feed: never scans the all-following timeline. */
export function createAuthorCategoryFeed<T extends CategoryArtwork>(
  client: CategoryFeedClient<T>,
  now = Date.now
) {
  const profiles = new Map<
    string,
    { entries: CategoryEntry[]; expiresAt: number }
  >()
  const pendingProfiles = new Map<string, Promise<CategoryEntry[]>>()
  const artworks = new Map<string, T>()
  const unavailable = new Set<string>()
  let revision = 0
  let merged:
    { key: string; revision: number; entries: CategoryEntry[] } | undefined

  async function getDirectory(authorId: string) {
    const cached = profiles.get(authorId)
    if (cached && cached.expiresAt > now()) return cached.entries
    if (cached) {
      profiles.delete(authorId)
      unavailable.clear()
      for (const [id, work] of artworks) {
        if (String(work.userId) === authorId) artworks.delete(id)
      }
      revision++
    }
    const pending = pendingProfiles.get(authorId)
    if (pending) return pending
    const request = (async () => {
      const profile = await client.getUserProfileAll(authorId)
      const entries = buildAuthorArtworkEntries({
        illusts: profile.illusts ?? {},
        manga: profile.manga ?? {},
      }).map((entry) => ({ ...entry, authorId }))
      profiles.set(authorId, {
        entries,
        expiresAt: profile.expiresAt ?? now() + DIRECTORY_TTL,
      })
      revision++
      return entries
    })()
    pendingProfiles.set(authorId, request)
    try {
      return await request
    } finally {
      pendingProfiles.delete(authorId)
    }
  }

  async function load(
    authorIds: readonly string[],
    requestedPage = 1,
    signal?: AbortSignal,
    onProgress?: (loaded: number, total: number) => void
  ) {
    signal?.throwIfAborted()
    const authors = [...new Set(authorIds)].sort()
    const failedAuthorIds: string[] = []
    let loaded = 0
    onProgress?.(loaded, authors.length)
    const directories = await mapLimited(
      authors,
      async (authorId) => {
        try {
          return await getDirectory(authorId)
        } catch (error) {
          signal?.throwIfAborted()
          if (authors.length === 1) throw error
          failedAuthorIds.push(authorId)
          return []
        } finally {
          onProgress?.(++loaded, authors.length)
        }
      },
      signal
    )
    if (authors.length && failedAuthorIds.length === authors.length) {
      throw new Error('分类作者的作品目录读取失败')
    }
    // Use the same newest-first Pixiv work-ID order as the author's own directory.
    const key = authors.join(',')
    if (
      !merged ||
      merged.key !== key ||
      merged.revision !== revision ||
      failedAuthorIds.length
    ) {
      merged = {
        key,
        revision,
        entries: [
          ...new Map(
            directories.flat().map((entry) => [entry.id, entry])
          ).values(),
        ].sort((a, b) => Number(b.id) - Number(a.id)),
      }
    }
    let entries = merged.entries.filter((entry) => !unavailable.has(entry.id))
    const safePage =
      Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1

    while (true) {
      signal?.throwIfAborted()
      const page = Math.min(
        safePage,
        Math.max(1, Math.ceil(entries.length / AUTHOR_CATEGORY_PAGE_SIZE))
      )
      const selected = entries.slice(
        (page - 1) * AUTHOR_CATEGORY_PAGE_SIZE,
        page * AUTHOR_CATEGORY_PAGE_SIZE
      )
      const groups = new Map<string, CategoryEntry[]>()
      for (const entry of selected) {
        if (artworks.has(entry.id)) continue
        const key = `${entry.authorId}:${entry.category}`
        const group = groups.get(key) ?? []
        group.push(entry)
        groups.set(key, group)
      }
      const batches = [...groups.values()].flatMap((group) => {
        const parts: CategoryEntry[][] = []
        for (
          let offset = 0;
          offset < group.length;
          offset += METADATA_BATCH_SIZE
        ) {
          parts.push(group.slice(offset, offset + METADATA_BATCH_SIZE))
        }
        return parts
      })
      await mapLimited(
        batches,
        async (batch) => {
          const works = await client.getUserIllusts(
            batch[0]!.authorId,
            batch.map((entry) => entry.id),
            batch[0]!.category
          )
          for (const entry of batch) {
            const work = works[entry.id]
            if (
              work &&
              String(work.id) === entry.id &&
              String(work.userId) === entry.authorId
            )
              artworks.set(entry.id, work)
            else unavailable.add(entry.id)
          }
        },
        signal
      )
      if (selected.some((entry) => unavailable.has(entry.id))) {
        entries = entries.filter((entry) => !unavailable.has(entry.id))
        continue
      }
      const works = selected.map((entry) => artworks.get(entry.id)!)
      works.sort(
        (a, b) =>
          (Date.parse(b.createDate) || 0) - (Date.parse(a.createDate) || 0) ||
          Number(b.id) - Number(a.id)
      )
      // Keep recently viewed metadata bounded while retaining this page.
      for (const work of works) {
        artworks.delete(work.id)
        artworks.set(work.id, work)
      }
      while (artworks.size > MAX_CACHED_ARTWORKS)
        artworks.delete(artworks.keys().next().value!)
      return { works, total: entries.length, page, failedAuthorIds }
    }
  }

  return { load }
}
