import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { reactive } from 'vue'
import { parsePixivResource } from '../shared/pixiv-resource.ts'
import {
  DEFAULT_LOCAL_PREFERENCES,
  mergeLocalPreferences,
  normalizeLocalPreferencesPatch,
} from '../shared/local-preferences.ts'
import { ensureMasterKey } from '../server/persistence/master-key.ts'
import { LocalPersistenceRepository } from '../server/persistence/repository.ts'

test('资源记录只由类型和 Pixiv ID 决定，与 hostname、端口和别名无关', () => {
  const artworkUrls = [
    'http://localhost:3000/artworks/123?from=list#top',
    'http://127.0.0.1:8080/i/123/',
    'https://www.pixiv.net/zh/artworks/123',
  ]

  assert.deepEqual(
    artworkUrls.map((url) => parsePixivResource(url)),
    artworkUrls.map(() => ({
      type: 'artwork',
      id: '123',
      key: 'artwork:123',
    }))
  )
  assert.deepEqual(parsePixivResource('http://localhost:3000/users/123'), {
    type: 'author',
    id: '123',
    key: 'author:123',
  })
  assert.equal(parsePixivResource('/unknown/123'), null)
})

test('主密钥首次自动生成，后续启动复用同一个密钥', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-key-'))
  try {
    const first = ensureMasterKey({ dataDir: directory })
    const second = ensureMasterKey({ dataDir: directory })

    assert.equal(first.length, 32)
    assert.deepEqual(second, first)
    assert.equal(
      Buffer.from(
        readFileSync(join(directory, 'master.key'), 'utf8').trim(),
        'base64url'
      ).length,
      32
    )
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

test('marker v1 只导入作品和作者且重复导入保持唯一记录', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-db-'))
  const repository = new LocalPersistenceRepository({
    databasePath: join(directory, 'pixivfun.sqlite'),
  })
  const backup = {
    schemaVersion: 1,
    exportedAt: 1_800_000_000_000,
    settings: {
      artworkVisitedColor: { r: 1, g: 2, b: 3, a: 1 },
      markArtworkTitle: false,
      markArtworkImage: false,
      hideViewedArtwork: true,
      artworkImageOverlayOpacity: 0.33,
      authorPageGridColumns: 4,
    },
    viewedArtworks: {
      '123': { id: '123', visitedAt: 1_700_000_000_000 },
      '456': { id: '456', visitedAt: 1_710_000_000_000 },
    },
    viewedUsers: {
      '123': { id: '123', visitedAt: 1_720_000_000_000 },
    },
    exclusions: {
      pages: ['/users/71318526/bookmarks/artworks'],
    },
  }

  try {
    const first = repository.importMarkerBackup(backup)
    const second = repository.importMarkerBackup(backup)

    assert.deepEqual(first, {
      artworks: 2,
      authors: 1,
      exclusions: 0,
      settings: 0,
    })
    assert.deepEqual(second, first)
    assert.equal(repository.getCounts().artworks, 2)
    assert.equal(repository.getCounts().authors, 1)
    assert.deepEqual(repository.getArtworkStatuses(['123', '456', '999']), {
      '123': {
        state: 'viewed',
        firstViewedAt: 1_700_000_000_000,
        lastViewedAt: 1_700_000_000_000,
        lastPage: null,
        pageCount: null,
      },
      '456': {
        state: 'viewed',
        firstViewedAt: 1_710_000_000_000,
        lastViewedAt: 1_710_000_000_000,
        lastPage: null,
        pageCount: null,
      },
    })
    assert.equal(
      repository.getPreferences().viewedMarker.artworkImageOverlayOpacity,
      0.54
    )

    const restored = new LocalPersistenceRepository({
      databasePath: join(directory, 'restored.sqlite'),
    })
    try {
      assert.deepEqual(restored.importData(repository.exportData()), {
        artworks: 2,
        authorVisits: 1,
        authorMarks: 0,
        exclusions: 0,
        settings: 30,
      })
      assert.deepEqual(restored.getCounts(), {
        artworks: 2,
        authors: 1,
        exclusions: 0,
      })
    } finally {
      restored.close()
    }
  } finally {
    repository.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('设置校验保留合法值并拒绝未知键和越界透明度', () => {
  assert.deepEqual(
    normalizeLocalPreferencesPatch({
      viewedMarker: {
        markArtworkImage: false,
        artworkImageOverlayOpacity: 0.7,
      },
      artworkReader: {
        columns: 5,
        imageQuality: 'regular',
      },
    }),
    {
      viewedMarker: {
        markArtworkImage: false,
        artworkImageOverlayOpacity: 0.7,
      },
      artworkReader: {
        columns: 5,
        imageQuality: 'regular',
      },
    }
  )
  assert.throws(
    () =>
      normalizeLocalPreferencesPatch({
        viewedMarker: { artworkImageOverlayOpacity: 2 },
      }),
    /artworkImageOverlayOpacity/
  )
  assert.throws(
    () =>
      normalizeLocalPreferencesPatch({
        viewedMarker: { artworkImageOverlayOpacity: 0.09 },
      }),
    /artworkImageOverlayOpacity/
  )
  assert.throws(
    () =>
      normalizeLocalPreferencesPatch({
        viewedMarker: {
          ...DEFAULT_LOCAL_PREFERENCES.viewedMarker,
          unknown: true,
        },
      }),
    /unknown/
  )
})

test('Vue 响应式偏好可以即时合并标记开关和透明度', () => {
  const reactivePreferences = reactive(
    structuredClone(DEFAULT_LOCAL_PREFERENCES)
  )
  const merged = mergeLocalPreferences(reactivePreferences, {
    viewedMarker: {
      markArtworkImage: false,
      artworkImageOverlayOpacity: 0.72,
    },
  })

  assert.equal(merged.viewedMarker.markArtworkImage, false)
  assert.equal(merged.viewedMarker.artworkImageOverlayOpacity, 0.72)
})

test('加密凭据与不透明会话可跨重启恢复且不会进入普通导出', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-session-db-'))
  const databasePath = join(directory, 'pixivfun.sqlite')
  let repository = new LocalPersistenceRepository({ databasePath })

  try {
    const credentialId = repository.saveCredential({
      sealedPayload: 'sealed-PHPSESSID-that-must-not-be-exported',
      pixivUserId: '71318526',
      keyId: 'test-key-id',
    })
    repository.createLocalSession(
      'opaque-token-hash',
      credentialId,
      Date.now() + 60_000
    )
    repository.close()

    repository = new LocalPersistenceRepository({ databasePath })
    assert.deepEqual(repository.getCredentialForSession('opaque-token-hash'), {
      sealedPayload: 'sealed-PHPSESSID-that-must-not-be-exported',
      keyId: 'test-key-id',
    })
    assert.equal(
      JSON.stringify(repository.exportData()).includes('PHPSESSID'),
      false
    )
    repository.clearCredentials()
    assert.equal(repository.getCredentialForSession('opaque-token-hash'), null)
  } finally {
    repository.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
