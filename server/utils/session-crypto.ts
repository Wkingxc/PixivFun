import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12
const AUTH_TAG_BYTES = 16
const MIN_SECRET_LENGTH = 32
const SESSION_PREFIX = 'v1'

export interface PixivSessionPayload {
  version: 1
  phpsessid: string
  csrfToken: string
  userData: Record<string, unknown>
  expiresAt: number
}

export function resolveConfiguredSessionSecret(
  configured: string,
  production: boolean
): string | null {
  if (configured.length >= MIN_SECRET_LENGTH) return configured
  if (production) {
    throw new Error(
      `NUXT_SESSION_SECRET must contain at least ${MIN_SECRET_LENGTH} characters`
    )
  }
  return null
}

function deriveKey(secret: string): Buffer {
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `NUXT_SESSION_SECRET must contain at least ${MIN_SECRET_LENGTH} characters`
    )
  }
  return createHash('sha256').update(secret, 'utf8').digest()
}

function isSessionPayload(value: unknown): value is PixivSessionPayload {
  if (!value || typeof value !== 'object') return false
  const payload = value as Partial<PixivSessionPayload>
  return (
    payload.version === 1 &&
    typeof payload.phpsessid === 'string' &&
    typeof payload.csrfToken === 'string' &&
    !!payload.userData &&
    typeof payload.userData === 'object' &&
    typeof payload.expiresAt === 'number' &&
    Number.isFinite(payload.expiresAt)
  )
}

export function sealPixivSessionPayload(
  payload: PixivSessionPayload,
  secret: string
): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, deriveKey(secret), iv)
  cipher.setAAD(Buffer.from(SESSION_PREFIX))
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()

  return [
    SESSION_PREFIX,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    authTag.toString('base64url'),
  ].join('.')
}

export function unsealPixivSessionPayload(
  sealed: string,
  secret: string,
  now = Date.now()
): PixivSessionPayload | null {
  try {
    const [prefix, ivValue, encryptedValue, authTagValue, extra] =
      sealed.split('.')
    if (
      prefix !== SESSION_PREFIX ||
      !ivValue ||
      !encryptedValue ||
      !authTagValue ||
      extra
    ) {
      return null
    }

    const iv = Buffer.from(ivValue, 'base64url')
    const authTag = Buffer.from(authTagValue, 'base64url')
    if (iv.length !== IV_BYTES || authTag.length !== AUTH_TAG_BYTES) return null

    const decipher = createDecipheriv(ALGORITHM, deriveKey(secret), iv)
    decipher.setAAD(Buffer.from(SESSION_PREFIX))
    decipher.setAuthTag(authTag)
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ])
    const payload: unknown = JSON.parse(decrypted.toString('utf8'))

    if (!isSessionPayload(payload) || payload.expiresAt <= now) return null
    return payload
  } catch {
    return null
  }
}
