import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  createGoogleOAuthRequest,
  exchangeGoogleAuthorizationCode,
  googleCodeChallenge,
  refreshGoogleAccessToken,
  resolveGoogleOAuthClient,
} from '../server/cloud/google-oauth.ts'
import {
  openCloudRefreshToken,
  sealCloudRefreshToken,
} from '../server/cloud/google-token-vault.ts'
import { GoogleDriveSyncService } from '../server/cloud/google-drive-sync.ts'
import { LocalPersistenceRepository } from '../server/persistence/repository.ts'

test('Google Desktop OAuth 使用最小 Drive 权限、PKCE 和回环回调', () => {
  const request = createGoogleOAuthRequest({
    clientId: 'test-client.apps.googleusercontent.com',
    redirectUri: 'http://127.0.0.1:49152',
  })
  const url = new URL(request.authorizationUrl)

  assert.equal(url.origin, 'https://accounts.google.com')
  assert.equal(url.pathname, '/o/oauth2/v2/auth')
  assert.equal(
    url.searchParams.get('client_id'),
    'test-client.apps.googleusercontent.com'
  )
  assert.equal(url.searchParams.get('redirect_uri'), 'http://127.0.0.1:49152')
  assert.equal(
    url.searchParams.get('scope'),
    'https://www.googleapis.com/auth/drive.appdata'
  )
  assert.equal(url.searchParams.get('response_type'), 'code')
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('prompt'), 'consent')
  assert.equal(url.searchParams.get('client_secret'), null)
  assert.equal(url.searchParams.get('state'), request.state)
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(
    url.searchParams.get('code_challenge'),
    googleCodeChallenge(request.codeVerifier)
  )
  assert.match(request.state, /^[A-Za-z0-9_-]{32,}$/)
  assert.match(request.codeVerifier, /^[A-Za-z0-9_-]{43,128}$/)
})

test('Google Desktop OAuth 要求本地配置完整的客户端凭据', () => {
  assert.throws(
    () => resolveGoogleOAuthClient({}),
    /GOOGLE_DRIVE_CLIENT_ID is not configured/
  )
  assert.throws(
    () =>
      resolveGoogleOAuthClient({
        GOOGLE_DRIVE_CLIENT_ID: 'custom-client.apps.googleusercontent.com',
      }),
    /GOOGLE_DRIVE_CLIENT_SECRET is not configured/
  )

  assert.deepEqual(
    resolveGoogleOAuthClient({
      GOOGLE_DRIVE_CLIENT_ID: 'custom-client.apps.googleusercontent.com',
      GOOGLE_DRIVE_CLIENT_SECRET: 'test-client-secret',
    }),
    {
      clientId: 'custom-client.apps.googleusercontent.com',
      clientSecret: 'test-client-secret',
    }
  )
})

test('Google Desktop Token 交换和刷新使用 PKCE 且提交客户端 secret', async () => {
  const requests: URLSearchParams[] = []
  const fetch = async (
    _input: string | URL,
    init?: RequestInit
  ): Promise<Response> => {
    requests.push(new URLSearchParams(String(init?.body)))
    return Response.json({
      access_token: 'test-access-token',
      expires_in: 3600,
      refresh_token: 'test-refresh-token',
      scope: 'https://www.googleapis.com/auth/drive.appdata',
      token_type: 'Bearer',
    })
  }

  await exchangeGoogleAuthorizationCode({
    clientId: 'test-client.apps.googleusercontent.com',
    clientSecret: 'test-client-secret',
    code: 'test-code',
    codeVerifier: 'test-code-verifier',
    redirectUri: 'http://127.0.0.1:49152',
    fetch,
  })
  await refreshGoogleAccessToken({
    clientId: 'test-client.apps.googleusercontent.com',
    clientSecret: 'test-client-secret',
    refreshToken: 'test-refresh-token',
    fetch,
  })

  assert.equal(requests[0]!.get('client_secret'), 'test-client-secret')
  assert.equal(requests[1]!.get('client_secret'), 'test-client-secret')
})

test('Google Refresh Token 加密落库且不会进入普通导出', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-google-token-'))
  const databasePath = join(directory, 'pixivfun.sqlite')
  const key = Buffer.alloc(32, 7)
  const refreshToken = '1//google-refresh-token-must-stay-private'
  const sealed = sealCloudRefreshToken(refreshToken, key)
  let repository = new LocalPersistenceRepository({ databasePath })

  try {
    assert.equal(sealed.includes(refreshToken), false)
    assert.equal(openCloudRefreshToken(sealed, key), refreshToken)
    assert.equal(openCloudRefreshToken(sealed, Buffer.alloc(32, 8)), null)

    repository.saveCloudCredential({
      provider: 'google-drive',
      sealedPayload: sealed,
      keyId: 'test-key',
    })
    repository.close()

    repository = new LocalPersistenceRepository({ databasePath })
    assert.deepEqual(repository.getCloudCredential('google-drive'), {
      sealedPayload: sealed,
      keyId: 'test-key',
    })
    assert.equal(
      JSON.stringify(repository.exportData()).includes(sealed),
      false
    )

    repository.deleteCloudCredential('google-drive')
    assert.equal(repository.getCloudCredential('google-drive'), null)
  } finally {
    repository.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('Google Drive 上传取集合并集并保留未来字段，同步只返回实际新增记录', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-google-sync-'))
  const repository = new LocalPersistenceRepository({
    databasePath: join(directory, 'pixivfun.sqlite'),
  })
  let remote:
    | {
        exportedAt: number
        data: Record<string, unknown>
      }
    | undefined
  const fetch = async (
    input: string | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const url = new URL(input)
    if (
      url.pathname === '/drive/v3/files' &&
      (init?.method || 'GET') === 'GET'
    ) {
      return Response.json({
        kind: 'drive#fileList',
        incompleteSearch: false,
        files: remote
          ? [
              {
                kind: 'drive#file',
                id: 'drive-file-1',
                name: 'pixivfun-data.json',
                mimeType: 'application/json',
                modifiedTime: '2026-07-25T12:00:00.000Z',
                version: '1',
              },
            ]
          : [],
      })
    }
    if (
      url.pathname === '/drive/v3/files/drive-file-1' &&
      url.searchParams.get('alt') === 'media'
    ) {
      return Response.json(remote)
    }
    if (url.pathname === '/upload/drive/v3/files' && init?.method === 'POST') {
      const parts = String(init.body).matchAll(
        /\r\n\r\n([\s\S]*?)(?=\r\n--pixivfun-)/g
      )
      const bodies = Array.from(parts, (match) => match[1]!)
      remote = JSON.parse(bodies.at(-1)!) as typeof remote
      return Response.json({
        kind: 'drive#file',
        id: 'drive-file-1',
        name: 'pixivfun-data.json',
        mimeType: 'application/json',
        modifiedTime: '2026-07-25T12:00:00.000Z',
        version: '1',
      })
    }
    if (
      url.pathname === '/upload/drive/v3/files/drive-file-1' &&
      init?.method === 'PATCH'
    ) {
      remote = JSON.parse(String(init.body)) as typeof remote
      return Response.json({
        kind: 'drive#file',
        id: 'drive-file-1',
        name: 'pixivfun-data.json',
        mimeType: 'application/json',
        modifiedTime: '2026-07-25T12:01:00.000Z',
        version: '2',
      })
    }
    return new Response('Not found', { status: 404 })
  }
  const service = new GoogleDriveSyncService({
    repository,
    getAccessToken: async () => 'test-access-token',
    fetch,
  })

  try {
    repository.recordArtworkVisit('100')
    repository.recordAuthorVisit('200')
    assert.deepEqual(await service.upload(), {
      created: true,
      artworks: 1,
      authors: 1,
    })

    remote!.data.visitedArtworkIds = ['100', '300']
    remote!.data.visitedAuthorIds = ['200', '400']
    remote!.data.futureDataType = { records: ['preserve-me'] }
    assert.deepEqual(await service.upload(), {
      created: false,
      artworks: 2,
      authors: 2,
    })
    assert.deepEqual(remote!.data.futureDataType, {
      records: ['preserve-me'],
    })

    remote!.data.visitedArtworkIds = ['100', '300', '500']
    remote!.data.visitedAuthorIds = ['200', '400', '600']
    assert.deepEqual(await service.sync(), {
      found: true,
      artworksAdded: 2,
      authorsAdded: 2,
    })
    assert.deepEqual(repository.getVisitedArtworkIds(['100', '300', '500']), [
      '100',
      '300',
      '500',
    ])
    assert.deepEqual(await service.sync(), {
      found: true,
      artworksAdded: 0,
      authorsAdded: 0,
    })
  } finally {
    repository.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
