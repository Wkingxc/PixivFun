import type { ArtworkInfo } from '~/types'
import { BOOKMARK_PAGE_SIZE } from '~/utils/refineModernArtwork'
import {
  BOOKMARK_TAG_SCAN_PAGE_LIMIT,
  collectArtworkTagStats,
  filterWorksByArtworkTags,
} from '~/utils/bookmarkArtworkTags'

export type BookmarkPageFetcher = (
  offset: number
) => Promise<{ works: ArtworkInfo[]; total: number }>

/**
 * Builds an artwork-tag index for one bookmark list (public or private) by
 * walking its pages. Scanning is opt-in — the panel stays collapsed until the
 * user asks for it — and every page is served through the shared request cache,
 * so browsing afterwards costs nothing extra.
 */
export function useBookmarkArtworkTags(fetchPage: BookmarkPageFetcher) {
  const works = shallowRef<ArtworkInfo[]>([])
  const selectedTags = ref<string[]>([])
  const scanning = ref(false)
  const scanned = ref(false)
  const truncated = ref(false)
  const error = ref('')
  const total = ref(0)
  let runId = 0

  const stats = computed(() => collectArtworkTagStats(works.value))
  const filteredWorks = computed(() =>
    filterWorksByArtworkTags(works.value, selectedTags.value)
  )
  const active = computed(() => selectedTags.value.length > 0)

  async function scan(force = false): Promise<void> {
    if (scanning.value) return
    if (scanned.value && !force) return

    const currentRun = ++runId
    scanning.value = true
    error.value = ''
    const collected: ArtworkInfo[] = []
    const seen = new Set<string>()

    try {
      for (let page = 0; page < BOOKMARK_TAG_SCAN_PAGE_LIMIT; page += 1) {
        const data = await fetchPage(page * BOOKMARK_PAGE_SIZE)
        if (currentRun !== runId) return
        total.value = data.total
        for (const work of data.works) {
          if (seen.has(work.id)) continue
          seen.add(work.id)
          collected.push(work)
        }
        // Publish progressively so the tag cloud fills in while scanning.
        works.value = [...collected]
        if (!data.works.length || collected.length >= data.total) break
      }
      truncated.value = collected.length < total.value
      scanned.value = true
    } catch (err) {
      if (currentRun !== runId) return
      console.warn('failed to index bookmark artwork tags', err)
      error.value = '统计作品标签失败，请稍后重试'
    } finally {
      if (currentRun === runId) scanning.value = false
    }
  }

  /** Drop the index when its scope changes (other list, other bookmark tag). */
  function reset(): void {
    runId += 1
    works.value = []
    selectedTags.value = []
    scanning.value = false
    scanned.value = false
    truncated.value = false
    error.value = ''
    total.value = 0
  }

  function setSelectedTags(tags: string[]): void {
    selectedTags.value = [...new Set(tags.filter(Boolean))]
  }

  return {
    works,
    stats,
    filteredWorks,
    selectedTags,
    scanning,
    scanned,
    truncated,
    error,
    total,
    active,
    scan,
    reset,
    setSelectedTags,
  }
}

export type BookmarkArtworkTagIndex = ReturnType<typeof useBookmarkArtworkTags>
