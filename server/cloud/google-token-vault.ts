import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const PREFIX = 'g1'
const AAD = Buffer.from('pixivfun:google-drive:refresh-token')

export function sealCloudRefreshToken(
  refreshToken: string,
  key: Buffer
): string {
  if (!refreshToken || key.length !== 32) {
    throw new TypeError('Google refresh token or encryption key is invalid')
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  cipher.setAAD(AAD)
  const encrypted = Buffer.concat([
    cipher.update(refreshToken, 'utf8'),
    cipher.final(),
  ])
  return [
    PREFIX,
    iv.toString('base64url'),
    encrypted.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
  ].join('.')
}

export function openCloudRefreshToken(
  sealed: string,
  key: Buffer
): string | null {
  try {
    const [prefix, ivValue, encryptedValue, tagValue, extra] = sealed.split('.')
    if (
      prefix !== PREFIX ||
      !ivValue ||
      !encryptedValue ||
      !tagValue ||
      extra ||
      key.length !== 32
    ) {
      return null
    }
    const iv = Buffer.from(ivValue, 'base64url')
    const tag = Buffer.from(tagValue, 'base64url')
    if (iv.length !== 12 || tag.length !== 16) return null
    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAAD(AAD)
    decipher.setAuthTag(tag)
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedValue, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
  } catch {
    return null
  }
}
