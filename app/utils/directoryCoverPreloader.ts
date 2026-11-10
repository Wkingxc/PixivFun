/** Keep decoded covers alive across directory page changes, with bounded memory. */
export function createDirectoryCoverPreloader(
  createImage: () => HTMLImageElement = () => new Image(),
  capacity = 36,
  timeoutMs = 8000
) {
  const cache = new Map<
    string,
    { image: HTMLImageElement; ready: Promise<void>; loaded: boolean }
  >()

  function load(src: string): Promise<void> {
    const cached = cache.get(src)
    if (cached) {
      cache.delete(src)
      cache.set(src, cached)
      return cached.ready
    }

    const image = createImage()
    const ready = new Promise<void>((resolve) => {
      let finished = false
      const finish = (success: boolean) => {
        if (finished) return
        finished = true
        clearTimeout(timer)
        image.onload = null
        image.onerror = null
        if (success && cache.get(src)?.image === image) {
          cache.get(src)!.loaded = true
        }
        if (!success && cache.get(src)?.image === image) cache.delete(src)
        resolve()
      }
      const timer = setTimeout(() => finish(false), timeoutMs)
      image.onload = async () => {
        try {
          await image.decode()
        } catch {
          // A loaded image can still render when decode() is unsupported/fails.
        }
        finish(true)
      }
      image.onerror = () => finish(false)
    })
    cache.set(src, { image, ready, loaded: false })
    while (cache.size > Math.max(1, capacity)) {
      cache.delete(cache.keys().next().value!)
    }
    image.src = src
    return ready
  }

  return {
    async preload(urls: readonly string[]): Promise<void> {
      await Promise.all([...new Set(urls.filter(Boolean))].map(load))
    },
    readyUrls(): string[] {
      return [...cache].flatMap(([url, entry]) => (entry.loaded ? [url] : []))
    },
    clear() {
      cache.clear()
    },
  }
}
