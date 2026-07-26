import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clampReaderThreads,
  createConcurrencyGate,
  DEFAULT_READER_THREADS,
  getOriginalPreloadOrder,
  READER_THREAD_LIMITS,
} from '../app/utils/readerOriginalLoader.ts'
import {
  clampReaderWidth,
  DEFAULT_READER_WIDTH,
  READER_WIDTH_LIMITS,
} from '../app/utils/artworkWaterfallReader.ts'
import { useReaderOriginals } from '../app/composables/useReaderOriginals.ts'

test('并发线程数会取整、夹紧范围并在非法值时回落默认值', () => {
  assert.equal(clampReaderThreads(6), 6)
  assert.equal(clampReaderThreads('8'), 8)
  assert.equal(clampReaderThreads(3.4), 3)
  assert.equal(clampReaderThreads(0), READER_THREAD_LIMITS.min)
  assert.equal(clampReaderThreads(999), READER_THREAD_LIMITS.max)
  assert.equal(clampReaderThreads(''), DEFAULT_READER_THREADS)
  assert.equal(clampReaderThreads(undefined), DEFAULT_READER_THREADS)
})

test('阅读界面宽度按步长对齐并夹紧到允许范围', () => {
  assert.equal(clampReaderWidth(2200), 2200)
  assert.equal(clampReaderWidth(2209), 2200)
  assert.equal(clampReaderWidth(2211), 2220)
  assert.equal(clampReaderWidth(100), READER_WIDTH_LIMITS.min)
  assert.equal(clampReaderWidth(99999), READER_WIDTH_LIMITS.max)
  assert.equal(clampReaderWidth('bad'), DEFAULT_READER_WIDTH)
})

test('原图预载顺序从当前页开始，走到末页后回卷到开头', () => {
  assert.deepEqual(getOriginalPreloadOrder(5, 2), [2, 3, 4, 0, 1])
  assert.deepEqual(getOriginalPreloadOrder(3, 0), [0, 1, 2])
  // Out-of-range starts clamp instead of producing holes.
  assert.deepEqual(getOriginalPreloadOrder(3, 9), [2, 0, 1])
  assert.deepEqual(getOriginalPreloadOrder(3, -4), [0, 1, 2])
  assert.deepEqual(getOriginalPreloadOrder(0, 0), [])
})

test('并发闸门同时最多放行 limit 个任务', async () => {
  const gate = createConcurrencyGate(3)
  let active = 0
  let peak = 0

  await Promise.all(
    Array.from({ length: 12 }, async () => {
      const release = await gate.acquire()
      active++
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 1))
      active--
      release()
    })
  )

  assert.equal(peak, 3)
  assert.equal(gate.activeCount, 0)
  assert.equal(gate.pendingCount, 0)
})

test('优先任务插到等待队列最前面', async () => {
  const gate = createConcurrencyGate(1)
  const order: string[] = []
  const releaseFirst = await gate.acquire()

  const queued = [
    gate.acquire().then((release) => {
      order.push('normal-1')
      release()
    }),
    gate.acquire().then((release) => {
      order.push('normal-2')
      release()
    }),
    gate.acquire(true).then((release) => {
      order.push('priority')
      release()
    }),
  ]

  assert.equal(gate.pendingCount, 3)
  releaseFirst()
  await Promise.all(queued)

  assert.deepEqual(order, ['priority', 'normal-1', 'normal-2'])
})

test('调高闸门上限会立刻放行排队中的任务', async () => {
  const gate = createConcurrencyGate(1)
  const releases: (() => void)[] = []
  const held = gate.acquire().then((release) => releases.push(release))
  const waiting = gate.acquire().then((release) => releases.push(release))

  await held
  assert.equal(gate.pendingCount, 1)

  gate.setLimit(4)
  await waiting
  assert.equal(gate.activeCount, 2)
  assert.equal(gate.pendingCount, 0)

  for (const release of releases) release()
  assert.equal(gate.activeCount, 0)
})

test('预载未完成时下载会复用进行中的请求并按线程数完成全部原图', async () => {
  const originalFetch = globalThis.fetch
  const calls = new Map<string, number>()
  let active = 0
  let peak = 0

  globalThis.fetch = async (input) => {
    const url = String(input)
    calls.set(url, (calls.get(url) || 0) + 1)
    active++
    peak = Math.max(peak, active)
    await new Promise((resolve) => setTimeout(resolve, 5))
    active--
    return new Response(new Blob([url]), { status: 200 })
  }

  try {
    const pages = Array.from({ length: 5 }, (_, index) => ({
      width: 1000,
      height: 1400,
      urls: {
        thumb_mini: `https://example.test/thumb-${index}.jpg`,
        small: `https://example.test/small-${index}.jpg`,
        regular: `https://example.test/regular-${index}.jpg`,
        original: `https://example.test/original-${index}.jpg`,
      },
    }))
    const originals = useReaderOriginals({
      pages: () => pages,
      threads: () => 2,
    })

    originals.preload(0)
    const downloaded = await Promise.all(
      pages.map((_, index) => originals.ensure(index))
    )

    assert.equal(
      downloaded.every((blob) => blob instanceof Blob),
      true
    )
    assert.equal(originals.loadedCount.value, pages.length)
    assert.equal(peak, 2)
    assert.deepEqual(
      [...calls.values()],
      Array.from({ length: pages.length }, () => 1)
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})
