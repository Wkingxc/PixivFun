import type { H3Event } from 'h3'
import colors from 'picocolors'
import { createPixivRequestHeaders } from './pixiv-headers'
import { getPixivSession } from './pixiv-session'
import { resolveUpstreamProxyUrl } from './system-proxy'

export const PROD = process.env.NODE_ENV === 'production'
export const DEV = !PROD
export const PXIMG_BASEURL_I = (() => {
  const i =
    process.env.NUXT_PUBLIC_PXIMG_BASEURL_I || process.env.VITE_PXIMG_BASEURL_I
  return i ? i.replace(/\/$/, '') + '/' : '/-/'
})()

export const PXIMG_BASEURL_S = (() => {
  const s =
    process.env.NUXT_PUBLIC_PXIMG_BASEURL_S || process.env.VITE_PXIMG_BASEURL_S
  return s ? s.replace(/\/$/, '') + '/' : '/~/'
})()

// --- Proxy-aware fetch ---

export async function proxyAwareFetch(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const proxyUrl = await resolveUpstreamProxyUrl()
  if (proxyUrl) {
    const { fetch: undiciFetch, ProxyAgent } = await import('undici')
    return undiciFetch(url, {
      ...init,
      dispatcher: new ProxyAgent(proxyUrl),
    } as any) as unknown as Response
  }
  return globalThis.fetch(url, init)
}

// --- Pixiv API client ---

interface PixivFetchOptions {
  event: H3Event
  method?: string
  url: string
  params?: Record<string, any>
  data?: any
}

export function buildPixivHeaders(
  event: H3Event,
  method = event.method
): Record<string, string> {
  const session = getPixivSession(event)
  return createPixivRequestHeaders(
    getHeaders(event),
    session
      ? {
          phpsessid: session.phpsessid,
          csrfToken: session.csrfToken,
        }
      : null,
    method
  )
}

export async function pixivFetch(
  opts: PixivFetchOptions
): Promise<{ data: any; status: number; headers: Headers }> {
  const { event } = opts
  const method = (opts.method ?? 'GET').toUpperCase()

  // Build URL with query params
  const url = new URL(opts.url, 'https://www.pixiv.net/')
  if (opts.params) {
    for (const [k, v] of Object.entries(opts.params)) {
      if (v == null || k === '__PATH' || k === '__PREFIX') continue
      if (Array.isArray(v)) {
        for (const item of v) {
          url.searchParams.append(k, String(item))
        }
      } else {
        url.searchParams.set(k, String(v))
      }
    }
  }

  const headers = buildPixivHeaders(event, method)

  // Prepare body
  let body: string | undefined
  if (method !== 'GET' && opts.data != null) {
    body = typeof opts.data === 'string' ? opts.data : JSON.stringify(opts.data)
    if (typeof opts.data !== 'string') {
      headers['content-type'] = 'application/json'
    }
  }

  if (DEV) {
    console.info(
      colors.green(`[${method}] <`),
      colors.cyan(url.pathname + url.search)
    )
  }

  const response = await proxyAwareFetch(url.toString(), {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(9000),
  })

  const contentType = response.headers.get('content-type') ?? ''
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (DEV) {
    console.info(
      colors.green(`[SEND ${response.status}] >`),
      colors.cyan(url.pathname)
    )
  }

  return { data, status: response.status, headers: response.headers }
}

// --- URL replacement utilities ---

export function replacePximgUrlsInString(str: string): string {
  if (!str.includes('pximg.net')) return str
  return str
    .replaceAll('https://i.pximg.net/', PXIMG_BASEURL_I)
    .replaceAll('https://s.pximg.net/', PXIMG_BASEURL_S)
}

export function replacePximgUrlsInObject(
  obj: Record<string, any> | string
): Record<string, any> | string {
  if (typeof obj === 'string') return replacePximgUrlsInString(obj)
  return deepReplaceString(obj, replacePximgUrlsInString)
}

function isObject(value: any): value is Record<string, any> {
  return typeof value === 'object' && value !== null
}

export function deepReplaceString<T>(
  obj: T,
  replacer: (value: string) => string
): T {
  if (Array.isArray(obj)) {
    return obj.map((value) =>
      deepReplaceString(value, replacer)
    ) as unknown as T
  } else if (isObject(obj)) {
    if (
      ['arraybuffer', 'blob', 'formdata'].includes(
        obj.constructor.name.toLowerCase()
      )
    ) {
      return obj
    }
    const result: Record<string, any> = {}
    for (const [key, value] of Object.entries(obj)) {
      result[key] = deepReplaceString(value, replacer)
    }
    return result as T
  } else if (typeof obj === 'string') {
    return replacer(obj) as unknown as T
  }
  return obj
}
