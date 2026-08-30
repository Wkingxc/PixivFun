import type { ArtworkGallery } from '~/types'
import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import {
  createConcurrencyGate,
  getOriginalPreloadOrder,
} from '../utils/readerOriginalLoader.ts'

export type ReaderOriginalState = 'idle' | 'loading' | 'loaded' | 'failed'

/**
 * Blobs are kept so that pressing 下载 right after a preload never goes back to
 * the network. Past this ceiling a page still counts as preloaded — the browser
 * cache holds it — it just is not pinned in memory as well.
 */
const MAX_CACHED_ORIGINAL_BYTES = 512 * 1024 * 1024

interface InflightTask {
  /** `false` while the task is still waiting for a gate permit. */
  started: boolean
  promise: Promise<Blob | null>
  token: object
}

export interface ReaderOriginals {
  states: Ref<ReaderOriginalState[]>
  loadedCount: ComputedRef<number>
  cachedBytes: Ref<number>
  /**
   * Fetches one original, reusing the cached blob or an in-flight request.
   * Resolves with `null` when the page does not exist or the loader was
   * stopped before the request started; rejects when the request fails.
   */
  ensure(index: number, priority?: boolean): Promise<Blob | null>
  /** Queues every page, starting at `startIndex` and wrapping around. */
  preload(startIndex: number): void
  /** Drops everything still queued; requests already in flight finish. */
  stop(): void
  /** Marks a page as available because an `<img>` finished loading it. */
  markLoaded(index: number): void
  /** Aborts, clears the cache and puts every page back to `idle`. */
  reset(): void
}

/**
 * Shared original-image loader for the waterfall reader.
 *
 * Preloading and downloading run through one gate and one cache, so the two
 * never fight over bandwidth and 下载 can start while the sweep is still
 * running instead of waiting for it to finish.
 */
export function useReaderOriginals(options: {
  pages: () => ArtworkGallery[]
  threads: () => number
}): ReaderOriginals {
  const states = ref<ReaderOriginalState[]>([])
  const cachedBytes = ref(0)
  const blobs = new Map<number, Blob>()
  const inflight = new Map<number, InflightTask>()
  const gate = createConcurrencyGate(options.threads())
  let controller = new AbortController()
  let runGeneration = 0

  const loadedCount = computed(
    () => states.value.filter((state) => state === 'loaded').length
  )

  watch(
    () => options.threads(),
    (next) => gate.setLimit(next)
  )

  function syncStates(): void {
    const pageCount = options.pages().length
    if (states.value.length === pageCount) return
    states.value = Array.from(
      { length: pageCount },
      (_, index) => states.value[index] || 'idle'
    )
  }

  function setState(index: number, state: ReaderOriginalState): void {
    syncStates()
    if (index < 0 || index >= states.value.length) return
    states.value[index] = state
  }

  function markLoaded(index: number): void {
    setState(index, 'loaded')
  }

  function retain(index: number, blob: Blob): void {
    if (cachedBytes.value + blob.size > MAX_CACHED_ORIGINAL_BYTES) return
    blobs.set(index, blob)
    cachedBytes.value += blob.size
  }

  async function load(
    index: number,
    url: string,
    priority: boolean,
    generation: number,
    task: InflightTask
  ): Promise<Blob | null> {
    const release = await gate.acquire(priority, task.token)
    const signal = controller.signal
    try {
      // Only work queued before the last stop() is dropped; anything already
      // downloading is cheaper to finish than to throw away.
      if (generation !== runGeneration) return null
      task.started = true
      setState(index, 'loading')
      // Default credentials mode on purpose: the same request an <img> would
      // make, so both share one browser cache entry instead of two.
      const response = await fetch(url, { signal })
      if (!response.ok) {
        throw new Error(`第 ${index + 1} 页原图请求失败（${response.status}）`)
      }
      const blob = await response.blob()
      retain(index, blob)
      setState(index, 'loaded')
      return blob
    } catch (error) {
      if (!signal.aborted) setState(index, 'failed')
      throw error
    } finally {
      release()
    }
  }

  function ensure(index: number, priority = false): Promise<Blob | null> {
    const cached = blobs.get(index)
    if (cached) return Promise.resolve(cached)
    const running = inflight.get(index)
    if (running) {
      if (priority && !running.started) gate.promote(running.token)
      return running.promise
    }

    const page = options.pages()[index]
    if (!page) return Promise.resolve(null)

    const task: InflightTask = {
      started: false,
      promise: Promise.resolve(null),
      token: {},
    }
    task.promise = load(
      index,
      page.urls.original,
      priority,
      runGeneration,
      task
    ).finally(() => {
      if (inflight.get(index) === task) inflight.delete(index)
    })
    inflight.set(index, task)
    return task.promise
  }

  function preload(startIndex: number): void {
    syncStates()
    for (const index of getOriginalPreloadOrder(
      options.pages().length,
      startIndex
    )) {
      if (states.value[index] === 'loaded') continue
      // A sweep failure is only interesting to whoever asked for that page.
      void ensure(index).catch(() => {})
    }
  }

  function stop(): void {
    runGeneration++
    for (const [index, task] of inflight) {
      if (!task.started) inflight.delete(index)
    }
  }

  function reset(): void {
    runGeneration++
    controller.abort()
    controller = new AbortController()
    inflight.clear()
    blobs.clear()
    cachedBytes.value = 0
    states.value = options.pages().map(() => 'idle')
  }

  return {
    states,
    loadedCount,
    cachedBytes,
    ensure,
    preload,
    stop,
    markLoaded,
    reset,
  }
}
