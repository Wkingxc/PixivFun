import axios, { type AxiosInstance } from 'axios'
import { createPximgReplacer } from '~/utils/pximg'

// ── Response envelope ────────────────────────────────────────────────

export interface PixivResponse<T> {
  error: boolean
  message: string
  body: T
}

export interface PixivWebClientOptions {
  /** Base URL for API requests (default: current origin) */
  baseURL?: string
  /** Proxy base URL for i.pximg.net images (default: VITE_PXIMG_BASEURL_I or https://i.pximg.net/) */
  pximgBaseUrlI?: string
  /** Proxy base URL for s.pximg.net static assets (default: VITE_PXIMG_BASEURL_S or https://s.pximg.net/) */
  pximgBaseUrlS?: string
  /** Request timeout in ms (default: 15000) */
  timeout?: number
}

function resolveBaseUrl(fallback: string, override?: string): string {
  if (override) return override.endsWith('/') ? override : override + '/'
  return fallback
}

/**
 * Shared HTTP core for all Pixiv API domain mixins. Domain modules extend
 * this class and are merged into PixivWebClient via applyMixins.
 */
export class PixivApiBase {
  protected http: AxiosInstance
  protected pximgReplacer: ReturnType<typeof createPximgReplacer>

  constructor(options: PixivWebClientOptions = {}) {
    let defaultI = '/-/'
    let defaultS = '/~/'
    try {
      const config = useRuntimeConfig()
      defaultI = (config.public.pximgBaseUrlI as string) || defaultI
      defaultS = (config.public.pximgBaseUrlS as string) || defaultS
    } catch {
      // runtimeConfig not available
    }
    const baseUrlI = resolveBaseUrl(defaultI, options.pximgBaseUrlI)
    const baseUrlS = resolveBaseUrl(defaultS, options.pximgBaseUrlS)
    this.pximgReplacer = createPximgReplacer(baseUrlI, baseUrlS)

    this.http = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeout ?? 35 * 1000,
      headers: {
        'Content-Type': 'application/json',
      },
    })
  }

  /**
   * Unwrap /ajax/* response envelope and apply pximg URL replacement.
   */
  protected unwrap<T>(data: PixivResponse<T>): T {
    if (data.error) {
      throw new Error(data.message || 'Pixiv API error')
    }
    return this.pximgReplacer.replacePximgInObject(data.body)
  }

  /**
   * Apply pximg URL replacement without unwrapping (for non-ajax endpoints).
   */
  protected transform<T>(data: T): T {
    return this.pximgReplacer.replacePximgInObject(data)
  }

  protected async postFormData(
    url: string,
    data:
      string | string[][] | Record<string, string> | URLSearchParams | undefined
  ) {
    return this.http.post(url, new URLSearchParams(data).toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
      },
    })
  }
}
