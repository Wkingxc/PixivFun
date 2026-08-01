export interface ClosableDispatcher {
  close(): Promise<void> | void
}

export interface ProxyDispatcherPool<T extends ClosableDispatcher> {
  get(url: string): Promise<T>
  clear(): Promise<void>
}

export function createProxyDispatcherPool<T extends ClosableDispatcher>(
  create: (url: string) => Promise<T>
): ProxyDispatcherPool<T> {
  let current: { url: string; dispatcher: T } | null = null
  let pending: { url: string; promise: Promise<T> } | null = null

  function closeQuietly(dispatcher: T): void {
    void Promise.resolve(dispatcher.close()).catch(() => {})
  }

  return {
    async get(url) {
      if (current?.url === url) return current.dispatcher
      if (pending?.url === url) return pending.promise

      const promise = create(url)
      pending = { url, promise }
      let dispatcher: T
      try {
        dispatcher = await promise
      } finally {
        if (pending?.promise === promise) pending = null
      }

      if (current?.url === url) {
        closeQuietly(dispatcher)
        return current.dispatcher
      }

      const previous = current
      current = { url, dispatcher }
      if (previous) closeQuietly(previous.dispatcher)
      return dispatcher
    },

    async clear() {
      const previous = current
      current = null
      pending = null
      if (previous) await Promise.resolve(previous.dispatcher.close())
    },
  }
}

export interface TransientRetryOptions {
  retries?: number
  signal?: AbortSignal | null
  timeoutMs?: number
}

const TRANSIENT_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
  'UND_ERR_BODY_TIMEOUT',
  'UND_ERR_CLOSED',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_DESTROYED',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET',
])

export function isTransientUpstreamError(error: unknown): boolean {
  if (error instanceof DOMException && error.name === 'TimeoutError')
    return true
  if (error instanceof TypeError && error.message === 'fetch failed')
    return true
  if (!error || typeof error !== 'object') return false

  const code = (error as { code?: unknown }).code
  if (typeof code === 'string' && TRANSIENT_ERROR_CODES.has(code)) return true

  const cause = (error as { cause?: unknown }).cause
  return cause != null && cause !== error
    ? isTransientUpstreamError(cause)
    : false
}

function createAttemptSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutMs: number
): AbortSignal {
  const timeoutSignal =
    timeoutMs > 0
      ? AbortSignal.timeout(timeoutMs)
      : new AbortController().signal
  return callerSignal
    ? AbortSignal.any([callerSignal, timeoutSignal])
    : timeoutSignal
}

export async function fetchWithTransientRetry<T>(
  method: string,
  attempt: (signal: AbortSignal) => Promise<T>,
  options: TransientRetryOptions = {}
): Promise<T> {
  const callerSignal = options.signal
  if (callerSignal?.aborted) {
    throw callerSignal.reason ?? new DOMException('Aborted', 'AbortError')
  }

  const normalizedMethod = method.toUpperCase()
  const canRetry = normalizedMethod === 'GET' || normalizedMethod === 'HEAD'
  const retries = canRetry ? Math.max(0, options.retries ?? 0) : 0
  const timeoutMs = options.timeoutMs ?? 0

  for (let index = 0; ; index += 1) {
    const signal = createAttemptSignal(callerSignal, timeoutMs)
    try {
      return await attempt(signal)
    } catch (error) {
      if (
        callerSignal?.aborted ||
        index >= retries ||
        !isTransientUpstreamError(error)
      ) {
        throw error
      }
    }
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as Error & { code?: unknown }).code
    return `${error.name}: ${error.message}${code ? ` [${String(code)}]` : ''}`
  }
  return String(error)
}

export function formatUpstreamError(error: unknown): string {
  const primary = describeError(error)
  const cause =
    error && typeof error === 'object' && 'cause' in error
      ? (error as { cause?: unknown }).cause
      : undefined
  return cause == null ? primary : `${primary}; cause=${describeError(cause)}`
}
