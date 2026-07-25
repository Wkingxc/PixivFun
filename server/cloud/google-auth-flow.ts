import { createServer, type Server } from 'node:http'
import {
  createGoogleOAuthRequest,
  exchangeGoogleAuthorizationCode,
  GOOGLE_DRIVE_SCOPE,
  type GoogleFetch,
} from './google-oauth.ts'

const AUTHORIZATION_TIMEOUT_MS = 5 * 60_000

let activeServer: Server | undefined

export async function startGoogleAuthorizationFlow(input: {
  clientId: string
  clientSecret: string
  fetch: GoogleFetch
  saveRefreshToken: (refreshToken: string) => void
}): Promise<{ authorizationUrl: string; expiresAt: number }> {
  activeServer?.close()

  let request: ReturnType<typeof createGoogleOAuthRequest> | undefined
  let redirectUri = ''
  let completed = false
  let timer: ReturnType<typeof setTimeout> | undefined

  const server = createServer((incoming, outgoing) => {
    void (async () => {
      if (completed || incoming.method !== 'GET' || !incoming.url || !request) {
        respond(outgoing, 404, '授权请求无效，请返回 PixivFun 重试。')
        return
      }
      const callback = new URL(incoming.url, redirectUri)
      if (callback.pathname !== '/') {
        respond(outgoing, 404, '授权回调地址无效。')
        return
      }
      completed = true
      if (timer) clearTimeout(timer)
      try {
        const error = callback.searchParams.get('error')
        const code = callback.searchParams.get('code')
        const state = callback.searchParams.get('state')
        if (error) throw new Error(`Google authorization failed: ${error}`)
        if (!code || state !== request.state) {
          throw new Error('Google authorization callback is invalid')
        }
        const token = await exchangeGoogleAuthorizationCode({
          clientId: input.clientId,
          clientSecret: input.clientSecret,
          code,
          codeVerifier: request.codeVerifier,
          redirectUri,
          fetch: input.fetch,
        })
        if (!token.refresh_token) {
          throw new Error('Google did not return a refresh token')
        }
        if (!token.scope.split(/\s+/).includes(GOOGLE_DRIVE_SCOPE)) {
          throw new Error('Google Drive app-data permission was not granted')
        }
        input.saveRefreshToken(token.refresh_token)
        respond(
          outgoing,
          200,
          'Google Drive 已连接，可以关闭此页面并返回 PixivFun。'
        )
      } catch (error) {
        console.error(
          '[Google Drive OAuth] callback failed:',
          error instanceof Error ? error.message : 'Unknown error'
        )
        respond(
          outgoing,
          400,
          'Google Drive 连接失败，请查看 PixivFun 终端中的错误后重试。'
        )
      } finally {
        server.close()
        if (activeServer === server) activeServer = undefined
      }
    })()
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Unable to start Google OAuth callback listener')
  }
  activeServer = server
  redirectUri = `http://127.0.0.1:${address.port}`
  request = createGoogleOAuthRequest({
    clientId: input.clientId,
    redirectUri,
  })
  const expiresAt = Date.now() + AUTHORIZATION_TIMEOUT_MS
  timer = setTimeout(() => {
    completed = true
    server.close()
    if (activeServer === server) activeServer = undefined
  }, AUTHORIZATION_TIMEOUT_MS)
  timer.unref()
  return { authorizationUrl: request.authorizationUrl, expiresAt }
}

function respond(
  response: Parameters<Parameters<typeof createServer>[0]>[1],
  status: number,
  message: string
): void {
  response.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(
    `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>PixivFun Google Drive</title></head><body><p>${message}</p></body></html>`
  )
}
