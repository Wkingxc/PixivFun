export const READER_THREAD_LIMITS = { min: 1, max: 16 } as const
export const DEFAULT_READER_THREADS = 4

export function clampReaderThreads(value: unknown): number {
  // Blank input means "unset", not zero, so it falls back instead of clamping.
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').trim() || NaN)
  if (!Number.isFinite(parsed)) return DEFAULT_READER_THREADS
  return Math.min(
    READER_THREAD_LIMITS.max,
    Math.max(READER_THREAD_LIMITS.min, Math.round(parsed))
  )
}

/**
 * Sweep order for preloading: the page the reader is sitting on first, then
 * forward to the end, wrapping back around to the pages already scrolled past.
 */
export function getOriginalPreloadOrder(
  pageCount: number,
  startIndex: number
): number[] {
  if (pageCount <= 0) return []
  const start = Math.min(
    pageCount - 1,
    Math.max(0, Math.trunc(startIndex) || 0)
  )
  return Array.from(
    { length: pageCount },
    (_, offset) => (start + offset) % pageCount
  )
}

export interface ConcurrencyGate {
  /** Permits handed out at the same time. */
  readonly limit: number
  /** Permits currently held. */
  readonly activeCount: number
  /** Callers still waiting for a permit. */
  readonly pendingCount: number
  setLimit(limit: number): void
  /**
   * Resolves with the release function once a permit is free. `priority`
   * puts the caller at the head of the queue, so the page the viewer is
   * actually showing never waits behind the whole background sweep.
   */
  acquire(priority?: boolean): Promise<() => void>
}

export function createConcurrencyGate(limit: number): ConcurrencyGate {
  let currentLimit = clampReaderThreads(limit)
  let active = 0
  const waiting: (() => void)[] = []

  function drain(): void {
    while (active < currentLimit && waiting.length) {
      waiting.shift()!()
    }
  }

  return {
    get limit() {
      return currentLimit
    },
    get activeCount() {
      return active
    },
    get pendingCount() {
      return waiting.length
    },
    setLimit(next: number) {
      const clamped = clampReaderThreads(next)
      if (clamped === currentLimit) return
      currentLimit = clamped
      drain()
    },
    acquire(priority = false) {
      return new Promise<() => void>((resolve) => {
        let released = false
        const start = () => {
          active++
          resolve(() => {
            if (released) return
            released = true
            active--
            drain()
          })
        }
        // Queue even when a slot looks free, so a burst of callers keeps its
        // arrival order instead of the last one jumping ahead.
        if (priority) waiting.unshift(start)
        else waiting.push(start)
        drain()
      })
    },
  }
}
