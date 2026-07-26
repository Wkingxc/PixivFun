import { createHash, randomBytes } from 'node:crypto'

export const GOOGLE_DRIVE_SCOPE =
  'https://www.googleapis.com/auth/drive.appdata'

interface GoogleOAuthEnvironment {
  GOOGLE_DRIVE_CLIENT_ID?: string
  GOOGLE_DRIVE_CLIENT_SECRET?: string
}

export interface GoogleOAuthClient {
  clientId: string
  clientSecret: string
}

export interface GoogleOAuthRequest {
  authorizationUrl: string
  codeVerifier: string
  state: string
}

export type GoogleFetch = (
  input: string | URL,
  init?: RequestInit
) => Promise<Response>

interface GoogleTokenResponse {
  access_token: string
  expires_in: number
  refresh_token?: string
  scope: string
  token_type: string
}

export function resolveGoogleOAuthClient(
  env: GoogleOAuthEnvironment = process.env
): GoogleOAuthClient {
  const clientId = env.GOOGLE_DRIVE_CLIENT_ID?.trim()
  if (!clientId) {
    throw new Error('GOOGLE_DRIVE_CLIENT_ID is not configured')
  }
  const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET?.trim()
  if (!clientSecret) {
    throw new Error('GOOGLE_DRIVE_CLIENT_SECRET is not configured')
  }
  return { clientId, clientSecret }
}

export function googleCodeChallenge(codeVerifier: string): string {
  return createHash('sha256').update(codeVerifier, 'ascii').digest('base64url')
}

export function createGoogleOAuthRequest(input: {
  clientId: string
  redirectUri: string
}): GoogleOAuthRequest {
  const codeVerifier = randomBytes(48).toString('base64url')
  const state = randomBytes(32).toString('base64url')
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.search = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: GOOGLE_DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
    code_challenge: googleCodeChallenge(codeVerifier),
    code_challenge_method: 'S256',
  }).toString()
  return {
    authorizationUrl: url.toString(),
    codeVerifier,
    state,
  }
}

export async function exchangeGoogleAuthorizationCode(input: {
  clientId: string
  clientSecret: string
  code: string
  codeVerifier: string
  redirectUri: string
  fetch: GoogleFetch
}): Promise<GoogleTokenResponse> {
  return requestGoogleToken(input.fetch, {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    code: input.code,
    code_verifier: input.codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: input.redirectUri,
  })
}

export async function refreshGoogleAccessToken(input: {
  clientId: string
  clientSecret: string
  refreshToken: string
  fetch: GoogleFetch
}): Promise<GoogleTokenResponse> {
  return requestGoogleToken(input.fetch, {
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token',
  })
}

export async function revokeGoogleToken(
  token: string,
  fetch: GoogleFetch
): Promise<void> {
  const response = await fetch('https://oauth2.googleapis.com/revoke', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) {
    throw new Error(`Google token revocation failed (${response.status})`)
  }
}

async function requestGoogleToken(
  fetch: GoogleFetch,
  parameters: Record<string, string>
): Promise<GoogleTokenResponse> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(parameters),
    signal: AbortSignal.timeout(15_000),
  })
  const value = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (
    !response.ok ||
    !value ||
    typeof value.access_token !== 'string' ||
    typeof value.expires_in !== 'number' ||
    typeof value.scope !== 'string' ||
    typeof value.token_type !== 'string'
  ) {
    const code =
      value && typeof value.error === 'string' ? `: ${value.error}` : ''
    throw new Error(`Google OAuth token request failed${code}`)
  }
  return {
    access_token: value.access_token,
    expires_in: value.expires_in,
    ...(typeof value.refresh_token === 'string'
      ? { refresh_token: value.refresh_token }
      : {}),
    scope: value.scope,
    token_type: value.token_type,
  }
}
