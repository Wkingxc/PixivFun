import { randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { PixivUser } from '~~/app/types'
import {
  resolveConfiguredSessionSecret,
  sealPixivSessionPayload,
  unsealPixivSessionPayload,
  type PixivSessionPayload,
} from './session-crypto'
import { shouldUseSecureCookie } from './session-cookie'

export const PIXIV_SESSION_COOKIE = 'pixivfun_session'
export const PIXIV_SESSION_MAX_AGE = 60 * 60 * 24 * 30
const MAX_COOKIE_LENGTH = 3800

let developmentSecret = ''
let warnedAboutDevelopmentSecret = false

function cookieOptions(event: H3Event) {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(getRequestProtocol(event)),
    sameSite: 'strict' as const,
    path: '/',
  }
}

function getSessionSecret(): string {
  const configured = String(useRuntimeConfig().sessionSecret || '')
  try {
    const resolved = resolveConfiguredSessionSecret(
      configured,
      process.env.NODE_ENV === 'production'
    )
    if (resolved) return resolved
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Session configuration error',
      message: error instanceof Error ? error.message : 'Invalid session secret',
    })
  }

  if (!developmentSecret) {
    developmentSecret = randomBytes(32).toString('base64url')
  }
  if (!warnedAboutDevelopmentSecret) {
    warnedAboutDevelopmentSecret = true
    console.warn(
      '[session] NUXT_SESSION_SECRET is not configured; using an ephemeral development key'
    )
  }
  return developmentSecret
}

export function setPixivSession(
  event: H3Event,
  data: {
    phpsessid: string
    csrfToken: string
    userData: PixivUser
  }
): void {
  const payload: PixivSessionPayload = {
    version: 1,
    phpsessid: data.phpsessid,
    csrfToken: data.csrfToken,
    userData: data.userData as unknown as Record<string, unknown>,
    expiresAt: Date.now() + PIXIV_SESSION_MAX_AGE * 1000,
  }
  const sealed = sealPixivSessionPayload(payload, getSessionSecret())
  if (sealed.length > MAX_COOKIE_LENGTH) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Session data is too large',
    })
  }

  setCookie(event, PIXIV_SESSION_COOKIE, sealed, {
    ...cookieOptions(event),
    maxAge: PIXIV_SESSION_MAX_AGE,
  })
}

export function getPixivSession(event: H3Event): PixivSessionPayload | null {
  const sealed = getCookie(event, PIXIV_SESSION_COOKIE)
  if (!sealed) return null

  const payload = unsealPixivSessionPayload(sealed, getSessionSecret())
  if (!payload) clearPixivSession(event)
  return payload
}

export function clearPixivSession(event: H3Event): void {
  deleteCookie(event, PIXIV_SESSION_COOKIE, cookieOptions(event))
}

export function assertSameOrigin(event: H3Event): void {
  const origin = getHeader(event, 'origin')
  if (!origin) return

  let requestOrigin: string
  try {
    requestOrigin = getRequestURL(event).origin
  } catch {
    throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
  }
  if (origin !== requestOrigin) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid origin' })
  }
}
