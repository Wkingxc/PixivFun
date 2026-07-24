export const PROXY_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'

interface TrustedPixivCredentials {
  phpsessid: string
  csrfToken: string
}

type IncomingHeaders = Record<string, string | string[] | undefined>

function firstHeaderValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export function createPixivRequestHeaders(
  incoming: IncomingHeaders,
  credentials: TrustedPixivCredentials | null,
  method: string
): Record<string, string> {
  const headers: Record<string, string> = {
    origin: 'https://www.pixiv.net',
    referer: 'https://www.pixiv.net/',
    'user-agent': PROXY_USER_AGENT,
    'accept-language':
      firstHeaderValue(incoming['accept-language']) ||
      'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
  }

  for (const name of [
    'accept',
    'content-type',
    'if-modified-since',
    'if-none-match',
  ]) {
    const value = firstHeaderValue(incoming[name])
    if (value) headers[name] = value
  }

  if (credentials) {
    headers.cookie = `PHPSESSID=${credentials.phpsessid}`
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
      headers['x-csrf-token'] = credentials.csrfToken
    }
  }

  return headers
}
