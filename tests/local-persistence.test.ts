import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
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
    })
    assert.deepEqual(second, first)
    assert.equal(repository.getCounts().artworks, 2)
    assert.equal(repository.getCounts().authors, 1)
    assert.deepEqual(repository.getVisitedArtworkIds(['123', '456', '999']), [
      '123',
      '456',
    ])
    assert.deepEqual(repository.getVisitedAuthorIds(['123', '999']), ['123'])
    assert.equal(
      repository.getPreferences().viewedMarker.artworkImageOverlayOpacity,
      0.54
    )

    const restored = new LocalPersistenceRepository({
      databasePath: join(directory, 'restored.sqlite'),
    })
    try {
      const exported = repository.exportData()
      assert.deepEqual(Object.keys(exported).sort(), ['data', 'exportedAt'])
      assert.equal(typeof exported.exportedAt, 'number')
      assert.deepEqual(exported.data, {
        visitedArtworkIds: ['123', '456'],
        visitedAuthorIds: ['123'],
      })

      assert.deepEqual(restored.importData(exported), {
        artworks: 2,
        authorVisits: 1,
      })
      assert.deepEqual(restored.getCounts(), {
        artworks: 2,
        authors: 1,
      })

      assert.deepEqual(
        restored.importData({
          exportedAt: 1_800_000_000_000,
          data: {
            visitedArtworkIds: ['789'],
            visitedAuthorIds: ['456'],
            futureDataType: { records: ['ignored-for-now'] },
          },
        }),
        {
          artworks: 1,
          authorVisits: 1,
        }
      )
      assert.deepEqual(restored.getVisitedArtworkIds(['789']), ['789'])
    } finally {
      restored.close()
    }
  } finally {
    repository.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('旧数据库升级后只保留作品和作者访问集合', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-migrate-'))
  const databasePath = join(directory, 'pixivfun.sqlite')
  const legacy = new DatabaseSync(databasePath)
  legacy.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
    INSERT INTO schema_migrations(version, applied_at) VALUES (1, 1);
    CREATE TABLE profiles (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    INSERT INTO profiles(id, created_at, updated_at)
      VALUES ('local-default', 1, 1);
    CREATE TABLE artwork_reading_state (
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      artwork_id TEXT NOT NULL,
      state TEXT NOT NULL,
      first_viewed_at INTEGER NOT NULL,
      last_viewed_at INTEGER NOT NULL,
      last_page INTEGER,
      page_count INTEGER,
      source TEXT NOT NULL,
      PRIMARY KEY (profile_id, artwork_id)
    );
    INSERT INTO artwork_reading_state VALUES
      ('local-default', '123', 'viewed', 10, 20, 2, 4, 'pixivfun'),
      ('local-default', '456', 'unread', 30, 40, NULL, NULL, 'manual');
    CREATE TABLE author_visits (
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL,
      first_visited_at INTEGER NOT NULL,
      last_visited_at INTEGER NOT NULL,
      source TEXT NOT NULL,
      PRIMARY KEY (profile_id, author_id)
    );
    INSERT INTO author_visits VALUES
      ('local-default', '789', 10, 20, 'pixivfun');
    CREATE TABLE author_marks (
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      author_id TEXT NOT NULL,
      mark_type TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (profile_id, author_id)
    );
    CREATE TABLE page_exclusions (
      profile_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      pattern TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (profile_id, pattern)
    );
  `)
  legacy.close()

  const repository = new LocalPersistenceRepository({ databasePath })
  try {
    assert.deepEqual(repository.getVisitedArtworkIds(['123', '456']), [
      '123',
      '456',
    ])
    assert.deepEqual(repository.getCounts(), {
      artworks: 2,
      authors: 1,
    })
  } finally {
    repository.close()
  }

  const migrated = new DatabaseSync(databasePath)
  try {
    const columns = (table: string) =>
      (
        migrated.prepare(`PRAGMA table_info(${table})`).all() as Array<{
          name: string
        }>
      ).map((row) => row.name)
    assert.deepEqual(columns('artwork_visits'), ['profile_id', 'artwork_id'])
    assert.deepEqual(columns('author_visits'), ['profile_id', 'author_id'])
    assert.equal(
      migrated
        .prepare(
          `SELECT COUNT(*) AS count
           FROM sqlite_master
           WHERE type = 'table'
             AND name IN (
               'artwork_reading_state',
               'author_marks',
               'page_exclusions'
             )`
        )
        .get()!.count,
      0
    )
  } finally {
    migrated.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('短暂并发读锁释放后数据库仍可正常初始化', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-locked-db-'))
  const databasePath = join(directory, 'pixivfun.sqlite')
  const database = new DatabaseSync(databasePath)
  database.exec(
    'CREATE TABLE sample(id INTEGER); INSERT INTO sample VALUES (1)'
  )
  database.close()

  const reader = spawn(
    process.execPath,
    [
      '-e',
      `
        const { DatabaseSync } = require('node:sqlite')
        const database = new DatabaseSync(process.argv[1])
        database.exec('BEGIN; SELECT * FROM sample')
        process.stdout.write('ready')
        setTimeout(() => {
          database.exec('COMMIT')
          database.close()
        }, 250)
      `,
      databasePath,
    ],
    { stdio: ['ignore', 'pipe', 'inherit'] }
  )

  try {
    await once(reader.stdout!, 'data')
    const repository = new LocalPersistenceRepository({ databasePath })
    repository.close()
    const [exitCode] = await once(reader, 'exit')
    assert.equal(exitCode, 0)
  } finally {
    if (reader.exitCode === null) reader.kill()
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

test('屏蔽作者列表校验:去重、拒绝非法条目', () => {
  assert.deepEqual(
    normalizeLocalPreferencesPatch({
      contentFilter: {
        blockedAuthors: [
          { id: '123', name: '作者A', addedAt: 1700000000000 },
          { id: '123', name: '重复条目', addedAt: 1700000000001 },
          { id: '456', name: '', addedAt: 1700000000002 },
        ],
      },
    }),
    {
      contentFilter: {
        blockedAuthors: [
          { id: '123', name: '作者A', addedAt: 1700000000000 },
          { id: '456', name: '', addedAt: 1700000000002 },
        ],
      },
    }
  )
  assert.throws(
    () =>
      normalizeLocalPreferencesPatch({
        contentFilter: {
          blockedAuthors: [{ id: 'abc', name: 'x', addedAt: 1 }],
        },
      }),
    /id must be a numeric string/
  )
  assert.throws(
    () =>
      normalizeLocalPreferencesPatch({
        contentFilter: {
          blockedAuthors: [{ id: '1', name: 'x', addedAt: 1, extra: true }],
        },
      }),
    /unknown key extra/
  )
  assert.throws(
    () =>
      normalizeLocalPreferencesPatch({
        contentFilter: { blockedAuthors: 'nope' },
      }),
    /must be an array/
  )
})

test('Vue 响应式偏好可以即时合并标记开关和透明度', () => {
  const reactivePreferences = reactive(
    structuredClone(DEFAULT_LOCAL_PREFERENCES)
  )
  const merged = mergeLocalPreferences(reactivePreferences, {
    viewedMarker: {
      markArtworkImage: false,
      markAuthorName: false,
      authorVisitedColor: { r: 255, g: 224, b: 128, a: 1 },
      artworkImageOverlayOpacity: 0.72,
    },
  })

  assert.equal(merged.viewedMarker.markArtworkImage, false)
  assert.equal(merged.viewedMarker.markAuthorName, false)
  assert.deepEqual(merged.viewedMarker.authorVisitedColor, {
    r: 255,
    g: 224,
    b: 128,
    a: 1,
  })
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
