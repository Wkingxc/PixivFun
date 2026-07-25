import { createHash, randomBytes } from 'node:crypto'
import type { H3Event } from 'h3'
import type { PixivUser } from '~~/app/types'
import { resolveAppDataDir } from '~~/server/persistence/data-dir'
import { useLocalPersistenceRepository } from '~~/server/persistence'
import { ensureMasterKey } from '~~/server/persistence/master-key'
import {
  sealPixivSessionPayload,
  unsealPixivSessionPayload,
  type PixivSessionPayload,
} from './session-crypto'
import { shouldUseSecureCookie } from './session-cookie'

export const PIXIV_SESSION_COOKIE = 'pixivfun_session'
export const PIXIV_SESSION_MAX_AGE = 60 * 60 * 24 * 30

function cookieOptions(event: H3Event) {
  return {
    httpOnly: true,
    secure: shouldUseSecureCookie(getRequestProtocol(event)),
    sameSite: 'strict' as const,
    path: '/',
  }
}

function getSessionKey(): { secret: string; keyId: string } {
  const configured = String(useRuntimeConfig().sessionSecret || '')
  try {
    const key = ensureMasterKey({
      dataDir: resolveAppDataDir(),
      configuredSecret: configured || undefined,
    })
    return {
      secret: key.toString('base64url'),
      keyId: createHash('sha256').update(key).digest('base64url').slice(0, 16),
    }
  } catch (error) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Session configuration error',
      message:
        error instanceof Error ? error.message : 'Invalid session secret',
    })
  }
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url')
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
  const { secret, keyId } = getSessionKey()
  const sealed = sealPixivSessionPayload(payload, secret)
  const repository = useLocalPersistenceRepository()
  const credentialId = repository.saveCredential({
    sealedPayload: sealed,
    pixivUserId: data.userData.id,
    keyId,
  })
  const token = randomBytes(32).toString('base64url')
  repository.createLocalSession(
    tokenHash(token),
    credentialId,
    payload.expiresAt
  )

  setCookie(event, PIXIV_SESSION_COOKIE, token, {
    ...cookieOptions(event),
    maxAge: PIXIV_SESSION_MAX_AGE,
  })
}

export function getPixivSession(event: H3Event): PixivSessionPayload | null {
  const token = getCookie(event, PIXIV_SESSION_COOKIE)
  if (!token || token.length !== 43) return null

  const credential = useLocalPersistenceRepository().getCredentialForSession(
    tokenHash(token)
  )
  if (!credential) {
    clearPixivSession(event)
    return null
  }
  const { secret, keyId } = getSessionKey()
  if (credential.keyId !== keyId) {
    clearPixivSession(event)
    return null
  }
  const payload = unsealPixivSessionPayload(credential.sealedPayload, secret)
  if (!payload) clearPixivSession(event)
  return payload
}

export function clearPixivSession(
  event: H3Event,
  clearSavedConnection = false
): void {
  const token = getCookie(event, PIXIV_SESSION_COOKIE)
  const repository = useLocalPersistenceRepository()
  if (token) repository.deleteLocalSession(tokenHash(token))
  if (clearSavedConnection) repository.clearCredentials()
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
