import { emptyTagInfo, type TagInfo } from '~/utils/tagInfo'

/**
 * Tag descriptions and translations cost one request per tag, so keep the
 * fan-out small: chips ask for what they show, the queue drains a few at a
 * time, and every answer is cached for the whole session.
 */
const MAX_CONCURRENT_TAG_INFO = 4

const useGlobalTagInfo = createGlobalState(() => {
  const entries = ref(new Map<string, TagInfo>())
  const queue: string[] = []
  const inflight = new Set<string>()

  function pump(): void {
    while (inflight.size < MAX_CONCURRENT_TAG_INFO && queue.length) {
      const tag = queue.shift()
      if (!tag) continue
      inflight.add(tag)
      void usePixivClient()
        .getTagInfo(tag)
        .then((info) => {
          entries.value.set(tag, info)
        })
        .catch(() => {
          // Cache the miss too, otherwise a broken tag retries on every hover.
          entries.value.set(tag, emptyTagInfo(tag))
        })
        .finally(() => {
          inflight.delete(tag)
          pump()
        })
    }
  }

  function ensure(tag: string): void {
    const key = tag.trim()
    if (!key) return
    if (entries.value.has(key) || inflight.has(key)) return
    if (queue.includes(key)) return
    queue.push(key)
    pump()
  }

  function get(tag: string): TagInfo | undefined {
    return entries.value.get(tag.trim())
  }

  return { entries, ensure, get }
})

export function useTagInfo() {
  return useGlobalTagInfo()
}
