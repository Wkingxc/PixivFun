import type { PixivUser } from '~~/app/types'
import { proxyAwareFetch } from '~~/server/utils/pixiv'
import { PROXY_USER_AGENT } from '~~/server/utils/pixiv-headers'
import {
  assertSameOrigin,
  setPixivSession,
} from '~~/server/utils/pixiv-session'
import {
  normalizePixivUserImages,
  resolvePixivSessionMetadata,
} from '~~/server/utils/pixiv-user'

const SESSION_ID_PATTERN = /^\d{2,10}_[0-9A-Za-z]{32}$/
const MAX_REQUEST_BYTES = 512
const RATE_LIMIT_WINDOW = 60_000
const RATE_LIMIT_ATTEMPTS = 10
const attempts = new Map<string, { count: number; resetAt: number }>()

function enforceRateLimit(event: Parameters<typeof getRequestIP>[0]): void {
  const now = Date.now()
  const key = getRequestIP(event) || 'local'
  if (attempts.size > 1000) {
    for (const [address, value] of attempts) {
      if (value.resetAt <= now) attempts.delete(address)
    }
  }
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return
  }
  current.count += 1
  if (current.count > RATE_LIMIT_ATTEMPTS) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too many login attempts',
    })
  }
}

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  enforceRateLimit(event)

  const contentLength = Number(getHeader(event, 'content-length') || 0)
  if (contentLength > MAX_REQUEST_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Request too large' })
  }

  const body = await readBody<{ phpsessid?: unknown }>(event)
  const phpsessid =
    typeof body?.phpsessid === 'string' ? body.phpsessid.trim() : ''
  if (!SESSION_ID_PATTERN.test(phpsessid)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid PHPSESSID format',
    })
  }

  let response: Response
  try {
    response = await proxyAwareFetch('https://www.pixiv.net/', {
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
        cookie: `PHPSESSID=${phpsessid}`,
        referer: 'https://www.pixiv.net/',
        'user-agent': PROXY_USER_AGENT,
      },
      signal: AbortSignal.timeout(9000),
    })
  } catch {
    throw createError({
      statusCode: 502,
      statusMessage: 'Unable to reach Pixiv',
    })
  }

  if (!response.ok) {
    throw createError({
      statusCode: response.status === 401 || response.status === 403 ? 401 : 502,
      statusMessage: 'Pixiv session validation failed',
    })
  }

  let metadata
  try {
    metadata = resolvePixivSessionMetadata(await response.text())
  } catch {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired Pixiv session',
    })
  }
  if (!metadata.token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Pixiv CSRF token is unavailable',
    })
  }

  const userData = normalizePixivUserImages(
    metadata.userData
  ) as unknown as PixivUser
  setPixivSession(event, {
    phpsessid,
    csrfToken: metadata.token,
    userData,
  })
  setResponseHeader(event, 'cache-control', 'no-store')
  return { userData }
})
