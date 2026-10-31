import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { LocalPersistenceRepository } from '../server/persistence/repository.ts'
import { parseLocalBackup } from '../shared/local-backup.ts'

test('跨库备份恢复、合并同名分类、保留本机记录且重复导入幂等', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-backup-'))
  const source = new LocalPersistenceRepository({
    databasePath: join(directory, 'source.sqlite'),
  })
  let target = new LocalPersistenceRepository({
    databasePath: join(directory, 'target.sqlite'),
  })
  try {
    source.recordArtworkVisit('123')
    source.recordAuthorVisit('42')
    const categoryId = source.createAuthorCategory('喜欢')
    source.setAuthorCategories('42', [categoryId])
    source.hideAuthorArtworks('42', ['456'])
    source.saveFeaturedAuthor('42', {
      userId: '42',
      userName: '作者',
      profileImageUrl: '',
      userComment: '',
      illusts: [],
    })
    source.updatePreferences({
      appearance: { theme: 'dark' },
      networkProxy: {
        enabled: true,
        url: 'http://secret:password@localhost:7890',
      },
      contentFilter: {
        blockedAuthors: [{ id: '50', name: '屏蔽', addedAt: 1 }],
      },
    })
    source.saveCloudCredential({
      provider: 'google-drive',
      sealedPayload: 'cloud-secret',
      keyId: 'key-id',
    })
    source.saveCredential({
      pixivUserId: '42',
      sealedPayload: 'pixiv-secret',
      keyId: 'key-id',
    })
    const backup = source.exportLocalBackup()
    assert.equal(JSON.stringify(backup).includes('secret'), false)
    target.recordArtworkVisit('999')
    const existingId = target.createAuthorCategory('喜欢')
    target.setAuthorCategories('88', [existingId])
    target.updatePreferences({
      contentFilter: {
        blockedAuthors: [{ id: '51', name: '本机', addedAt: 2 }],
      },
    })
    assert.deepEqual(target.importLocalBackup(backup), {
      artworks: 1,
      authorVisits: 1,
    })
    assert.equal(target.getPreferences().appearance.theme, 'auto')
    assert.deepEqual(target.getAuthorCategories(), [
      { id: existingId, name: '喜欢', authorIds: ['42', '88'] },
    ])
    assert.deepEqual(target.getHiddenAuthorArtworkIds('42'), ['456'])
    assert.equal(target.getFeaturedAuthors().total, 1)
    assert.equal(target.getPreferences().contentFilter.blockedAuthors.length, 2)
    assert.deepEqual(target.importLocalBackup(backup, true), {
      artworks: 0,
      authorVisits: 0,
    })
    assert.equal(target.getPreferences().appearance.theme, 'dark')
    assert.equal(target.getCloudCredential('google-drive'), null)
    target.close()
    target = new LocalPersistenceRepository({
      databasePath: join(directory, 'target.sqlite'),
    })
    assert.deepEqual(target.getVisitedArtworkIds(['123', '999']), [
      '123',
      '999',
    ])
    assert.equal(target.getAuthorCategories().length, 1)
    assert.equal(target.getFeaturedAuthors().total, 1)
    assert.equal(target.getPreferences().appearance.theme, 'dark')
  } finally {
    source.close()
    target.close()
    rmSync(directory, { recursive: true, force: true })
  }
})

test('旧版记录兼容、格式拒绝、浏览器偏好白名单与失败回滚', () => {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-backup-'))
  const target = new LocalPersistenceRepository({
    databasePath: join(directory, 'target.sqlite'),
  })
  try {
    const legacy = {
      exportedAt: 1,
      data: { visitedArtworkIds: ['123', '123'], visitedAuthorIds: ['42'] },
    }
    assert.deepEqual(target.importLocalBackup(legacy), {
      artworks: 1,
      authorVisits: 1,
    })
    const backup = target.exportLocalBackup()
    backup.browserPreferences = {
      'pixivfun:marker-button-visible': 'false',
      'unrelated-token': 'secret',
    }
    assert.deepEqual(parseLocalBackup(backup).browserPreferences, {
      'pixivfun:marker-button-visible': 'false',
    })
    assert.throws(() => parseLocalBackup({ ...backup, version: 99 }))
    assert.throws(() =>
      parseLocalBackup({
        ...backup,
        hiddenArtworks: [{ authorId: '42', artworkId: 'bad' }],
      })
    )
    assert.throws(() =>
      target.importLocalBackup({
        ...backup,
        data: { ...backup.data, visitedArtworkIds: ['999'] },
        featuredAuthors: [{ userId: '43' }],
      })
    )
    assert.deepEqual(target.getVisitedArtworkIds(['999']), [])
    // Force a write failure after visits and categories have been inserted.
    const database = new DatabaseSync(join(directory, 'target.sqlite'))
    database.exec(
      "CREATE TRIGGER reject_hidden BEFORE INSERT ON author_artwork_exclusions BEGIN SELECT RAISE(ABORT, 'test failure'); END"
    )
    database.close()
    const invalid = {
      ...backup,
      categories: [{ name: '应回滚', authorIds: ['42'] }],
      hiddenArtworks: [{ authorId: '42', artworkId: '456' }],
      data: { ...backup.data, visitedArtworkIds: ['999'] },
    }
    assert.throws(() => target.importLocalBackup(invalid))
    assert.deepEqual(target.getVisitedArtworkIds(['999']), [])
    assert.equal(target.getAuthorCategories().length, 0)
  } finally {
    target.close()
    rmSync(directory, { recursive: true, force: true })
  }
})
