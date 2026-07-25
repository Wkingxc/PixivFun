import { createHash } from 'node:crypto'
import { resolveAppDataDir } from '../persistence/data-dir.ts'
import { useLocalPersistenceRepository } from '../persistence/index.ts'
import { ensureMasterKey } from '../persistence/master-key.ts'
import { proxyAwareFetch } from '../utils/pixiv.ts'
import { startGoogleAuthorizationFlow } from './google-auth-flow.ts'
import {
  refreshGoogleAccessToken,
  resolveGoogleOAuthClient,
  revokeGoogleToken,
} from './google-oauth.ts'
import {
  openCloudRefreshToken,
  sealCloudRefreshToken,
} from './google-token-vault.ts'

const PROVIDER = 'google-drive'

function getVaultKey(): { key: Buffer; keyId: string } {
  const key = ensureMasterKey({
    dataDir: resolveAppDataDir(),
    configuredSecret: process.env.NUXT_SESSION_SECRET || undefined,
  })
  return {
    key,
    keyId: createHash('sha256').update(key).digest('base64url').slice(0, 16),
  }
}

export function getGoogleDriveRefreshToken(): string | null {
  const credential =
    useLocalPersistenceRepository().getCloudCredential(PROVIDER)
  if (!credential) return null
  const { key, keyId } = getVaultKey()
  if (credential.keyId !== keyId) return null
  return openCloudRefreshToken(credential.sealedPayload, key)
}

export function isGoogleDriveConnected(): boolean {
  return getGoogleDriveRefreshToken() !== null
}

export async function connectGoogleDrive(): Promise<{
  authorizationUrl: string
  expiresAt: number
}> {
  const client = resolveGoogleOAuthClient()
  return startGoogleAuthorizationFlow({
    clientId: client.clientId,
    clientSecret: client.clientSecret,
    fetch: proxyAwareFetch,
    saveRefreshToken(refreshToken) {
      const { key, keyId } = getVaultKey()
      useLocalPersistenceRepository().saveCloudCredential({
        provider: PROVIDER,
        sealedPayload: sealCloudRefreshToken(refreshToken, key),
        keyId,
      })
    },
  })
}

export async function getGoogleDriveAccessToken(): Promise<string> {
  const refreshToken = getGoogleDriveRefreshToken()
  if (!refreshToken) throw new Error('Google Drive is not connected')
  const client = resolveGoogleOAuthClient()
  try {
    const token = await refreshGoogleAccessToken({
      clientId: client.clientId,
      clientSecret: client.clientSecret,
      refreshToken,
      fetch: proxyAwareFetch,
    })
    return token.access_token
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid_grant')) {
      useLocalPersistenceRepository().deleteCloudCredential(PROVIDER)
    }
    throw error
  }
}

export async function disconnectGoogleDrive(): Promise<void> {
  const refreshToken = getGoogleDriveRefreshToken()
  try {
    if (refreshToken) await revokeGoogleToken(refreshToken, proxyAwareFetch)
  } finally {
    useLocalPersistenceRepository().deleteCloudCredential(PROVIDER)
  }
}
