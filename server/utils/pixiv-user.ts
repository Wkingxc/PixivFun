import { type CheerioAPI, load } from 'cheerio'

export interface PixivSessionMetadata {
  userData: Record<string, unknown>
  token: string
}

function normalizeProxyBase(base: string, fallback: string): string {
  const value = base || fallback
  return value.endsWith('/') ? value : `${value}/`
}

function replacePixivImageUrl(
  value: unknown,
  baseUrlI: string,
  baseUrlS: string
): unknown {
  if (typeof value !== 'string') return value
  return value
    .replace('https://i.pximg.net/', baseUrlI)
    .replace('https://s.pximg.net/', baseUrlS)
}

export function normalizePixivUserImages<T extends Record<string, unknown>>(
  userData: T,
  baseUrlI = normalizeProxyBase(
    process.env.NUXT_PUBLIC_PXIMG_BASEURL_I ||
      process.env.VITE_PXIMG_BASEURL_I ||
      '',
    '/-/'
  ),
  baseUrlS = normalizeProxyBase(
    process.env.NUXT_PUBLIC_PXIMG_BASEURL_S ||
      process.env.VITE_PXIMG_BASEURL_S ||
      '',
    '/~/'
  )
): T {
  return {
    ...userData,
    profileImg: replacePixivImageUrl(
      userData.profileImg,
      baseUrlI,
      baseUrlS
    ),
    profileImgBig: replacePixivImageUrl(
      userData.profileImgBig,
      baseUrlI,
      baseUrlS
    ),
  }
}

export function resolvePixivSessionMetadata(
  document: string
): PixivSessionMetadata {
  const $ = load(document)
  if ($('meta[name="global-data"]').length > 0) {
    return resolveLegacyGlobalMeta($)
  }
  if ($('script#__NEXT_DATA__').length > 0) {
    return resolveNextData($)
  }
  throw new Error('Cannot resolve user data')
}

function resolveLegacyGlobalMeta($: CheerioAPI): PixivSessionMetadata {
  const content = $('meta[name="global-data"]').attr('content')
  if (!content) throw new Error('Invalid Pixiv session')

  const meta = JSON.parse(content)
  if (!meta?.userData) throw new Error('Invalid Pixiv user data')

  return {
    userData: meta.userData,
    token: typeof meta.token === 'string' ? meta.token : '',
  }
}

function resolveNextData($: CheerioAPI): PixivSessionMetadata {
  const text = $('script#__NEXT_DATA__').text()
  if (!text) throw new Error('Invalid Pixiv session')

  const nextData = JSON.parse(text)
  const serialized =
    nextData?.props?.pageProps?.serverSerializedPreloadedState
  if (typeof serialized !== 'string') {
    throw new Error('Invalid Pixiv user data')
  }

  const preloadState = JSON.parse(serialized)
  const userData = preloadState?.userData?.self
  if (!userData) throw new Error('Invalid Pixiv user data')

  return {
    userData,
    token:
      typeof preloadState?.api?.token === 'string'
        ? preloadState.api.token
        : '',
  }
}
