/**
 * Lightweight in-memory request cache shared by the Pixiv API domain
 * modules: in-flight dedup, per-endpoint TTL, stale-while-revalidate and
 * prefix invalidation for write operations. Values are cached as-is, so
 * callers must not mutate returned objects in place.
 */

interface CacheEntry {
  value: unknown
  expiresAt: number
  staleUntil: number
}

export interface CachedFetchOptions {
  /** Fresh lifetime in ms. 0 disables caching (dedup still applies). */
  ttl?: number
  /**
   * Extra window after ttl during which the stale value is returned
   * immediately while a background refresh runs. Defaults to 4 * ttl.
   */
  staleTtl?: number
  /**
   * Abort signal from the caller. Signal-bound requests bypass in-flight
   * sharing so an abort never cancels an unrelated caller's request.
   */
  signal?: AbortSignal
}

export const CACHE_TTL = {
  /** Lists that should feel fresh but survive back-navigation. */
  list: 60_000,
  /** User profiles and rankings change slowly. */
  profile: 300_000,
} as const

export class RequestCache {
  private entries = new Map<string, CacheEntry>()
  private inflight = new Map<string, Promise<unknown>>()
  private now: () => number

  constructor(now: () => number = () => Date.now()) {
    this.now = now
  }

  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: CachedFetchOptions = {}
  ): Promise<T> {
    const ttl = options.ttl ?? 0
    const staleTtl = options.staleTtl ?? ttl * 4
    const now = this.now()

    const entry = this.entries.get(key)
    if (entry && ttl > 0) {
      if (now < entry.expiresAt) {
        return entry.value as T
      }
      if (now < entry.staleUntil) {
        // Serve stale immediately; refresh in the background for next read.
        this.refresh(key, fetcher, ttl, staleTtl)
        return entry.value as T
      }
      this.entries.delete(key)
    }

    if (options.signal) {
      // Signal-bound requests are not shared between callers.
      const value = await fetcher()
      this.store(key, value, ttl, staleTtl)
      return value
    }

    const shared = this.inflight.get(key)
    if (shared) return shared as Promise<T>

    const promise = fetcher().then(
      (value) => {
        this.inflight.delete(key)
        this.store(key, value, ttl, staleTtl)
        return value
      },
      (error) => {
        this.inflight.delete(key)
        throw error
      }
    )
    this.inflight.set(key, promise)
    return promise
  }

  /** Drop every cached entry whose key starts with the given prefix. */
  invalidate(prefix: string): void {
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) this.entries.delete(key)
    }
  }

  /** Drop exactly one cached entry (avoids prefix collisions like id 123 vs 1234). */
  invalidateExact(key: string): void {
    this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
    this.inflight.clear()
  }

  private store(key: string, value: unknown, ttl: number, staleTtl: number) {
    if (ttl <= 0) return
    const now = this.now()
    this.entries.set(key, {
      value,
      expiresAt: now + ttl,
      staleUntil: now + ttl + staleTtl,
    })
  }

  private refresh(
    key: string,
    fetcher: () => Promise<unknown>,
    ttl: number,
    staleTtl: number
  ) {
    if (this.inflight.has(key)) return
    const promise = fetcher().then(
      (value) => {
        this.inflight.delete(key)
        this.store(key, value, ttl, staleTtl)
        return value
      },
      () => {
        // Keep serving the stale value if the background refresh fails.
        this.inflight.delete(key)
      }
    )
    this.inflight.set(key, promise)
  }
}

/** Shared cache instance for the whole client session. */
export const requestCache = new RequestCache()

/** Build a stable cache key from an endpoint name and its parameters. */
export function cacheKey(
  scope: string,
  ...parts: Array<string | number | boolean | null | undefined>
): string {
  return `${scope}:${parts.map((part) => String(part ?? '')).join('|')}`
}
