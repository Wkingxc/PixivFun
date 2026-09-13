import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { LocalPersistenceRepository } from '../server/persistence/repository.ts'
import { filterFollowingUpdatesByAuthors } from '../app/utils/followingLatest.ts'
import {
  createAuthorDirectoryCache,
  AUTHOR_DIRECTORY_TTL,
} from '../server/utils/author-directory-cache.ts'

function database(t: TestContext) {
  const directory = mkdtempSync(join(tmpdir(), 'pixivfun-categories-'))
  const databasePath = join(directory, 'test.sqlite')
  const repositories: LocalPersistenceRepository[] = []
  const open = (profileId = 'local-default') => {
    const repository = new LocalPersistenceRepository({
      databasePath,
      profileId,
    })
    repositories.push(repository)
    return repository
  }
  t.after(() => {
    for (const repository of repositories) repository.close()
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep))
    rmSync(directory, { recursive: true, force: true })
  })
  return { open, databasePath }
}

test('分类目录跨实例复用 SQLite 缓存、按账号隔离、过期刷新且失败不写缓存', async (t) => {
  const { open } = database(t)
  const repository = open()
  let time = 1000
  let calls = 0
  let fail = false
  const upstream = async () => {
    calls++
    if (fail) throw new Error('offline')
    return { illusts: { '100': null }, manga: null }
  }
  const load = createAuthorDirectoryCache(() => time)
  await Promise.all([
    load(repository, '1', '10', upstream),
    load(repository, '1', '10', upstream),
  ])
  assert.equal(calls, 1)
  const reopened = createAuthorDirectoryCache(() => time)
  const cached = await reopened(open(), '1', '10', upstream)
  assert.equal(calls, 1)
  assert.deepEqual(cached.illusts, { '100': null })
  await load(repository, '2', '10', upstream)
  assert.equal(calls, 2)
  time += AUTHOR_DIRECTORY_TTL
  fail = true
  await assert.rejects(load(repository, '1', '10', upstream), /offline/)
  fail = false
  await load(repository, '1', '10', upstream)
  assert.equal(calls, 4)
})

test('作者可加入多个分类，重命名保持关系，重启后保留，删除不影响其他分类或精选', (t) => {
  const { open } = database(t)
  const repository = open()
  const landscape = repository.createAuthorCategory('  风景  ')
  const comics = repository.createAuthorCategory('漫画')
  repository.saveFeaturedAuthor('10', {
    userId: '10',
    userName: '作者',
    profileImageUrl: '',
    userComment: '',
    illusts: [],
  })
  repository.setAuthorCategories('10', [landscape, comics, comics])
  repository.setAuthorCategories('20', [comics])
  repository.renameAuthorCategory(landscape, '场景')
  assert.deepEqual(open().getAuthorCategories(), [
    { id: landscape, name: '场景', authorIds: ['10'] },
    { id: comics, name: '漫画', authorIds: ['10', '20'] },
  ])
  repository.deleteAuthorCategory(landscape)
  assert.deepEqual(repository.getAuthorCategories(), [
    { id: comics, name: '漫画', authorIds: ['10', '20'] },
  ])
  assert.deepEqual(repository.getFeaturedAuthorIds(['10']), ['10'])
  repository.setAuthorCategories('10', [])
  assert.deepEqual(repository.getAuthorCategories()[0]?.authorIds, ['20'])
})

test('拒绝空白、超长、重名和无效分类，失败时保留作者原分类', (t) => {
  const repository = database(t).open()
  const first = repository.createAuthorCategory('原神')
  const second = repository.createAuthorCategory('Landscape')
  for (const name of [
    '',
    '  ',
    'a'.repeat(31),
    'bad\nname',
    ' 原神 ',
    'landscape',
  ]) {
    assert.throws(() => repository.createAuthorCategory(name))
  }
  repository.setAuthorCategories('10', [first])
  assert.throws(() => repository.renameAuthorCategory(second, '原神'))
  assert.throws(() => repository.setAuthorCategories('10', [second, 'missing']))
  assert.throws(() => repository.setAuthorCategories('10', null))
  assert.throws(() => repository.setAuthorCategories('invalid', [first]))
  assert.throws(() => repository.deleteAuthorCategory('missing'))
  assert.deepEqual(repository.getAuthorCategories()[0]?.authorIds, ['10'])
  assert.deepEqual(repository.getAuthorCategories()[1]?.authorIds, [])
})

test('分类名称和作者关系按本地 profile 隔离', (t) => {
  const { open } = database(t)
  const first = open('one')
  const second = open('two')
  const category = first.createAuthorCategory('漫画')
  first.setAuthorCategories('10', [category])
  assert.deepEqual(second.getAuthorCategories(), [])
  assert.throws(() => second.setAuthorCategories('20', [category]))
  assert.throws(() => second.renameAuthorCategory(category, '其他'))
  assert.throws(() => second.deleteAuthorCategory(category))
  assert.ok(second.createAuthorCategory('漫画'))
  assert.deepEqual(first.getAuthorCategories()[0]?.authorIds, ['10'])
})

test('已有 v5 数据库自动升级，不丢失精选和已读记录', (t) => {
  const { open, databasePath } = database(t)
  const repository = open()
  repository.saveFeaturedAuthor('10', {
    userId: '10',
    userName: '作者',
    profileImageUrl: '',
    userComment: '',
    illusts: [],
  })
  const legacy = new DatabaseSync(databasePath)
  legacy.exec(`
    DROP TABLE author_category_members;
    DROP TABLE author_categories;
    DELETE FROM schema_migrations;
    INSERT INTO schema_migrations(version, applied_at) VALUES (5, 1);
    INSERT INTO artwork_visits(profile_id, artwork_id) VALUES ('local-default', '123');
  `)
  legacy.close()
  const migrated = open()
  assert.deepEqual(migrated.getAuthorCategories(), [])
  assert.deepEqual(migrated.getFeaturedAuthorIds(['10']), ['10'])
  assert.deepEqual(migrated.getVisitedArtworkIds(['123']), ['123'])
  const category = migrated.createAuthorCategory('新分类')
  migrated.setAuthorCategories('10', [category])
  assert.deepEqual(open().getAuthorCategories()[0]?.authorIds, ['10'])
})

test('分类更新只匹配该分类作者，保留日期顺序且允许作者出现在多个分类', () => {
  const works = [
    { id: '1', userId: '10' },
    { id: '2', userId: 20 },
    { id: '3', userId: '10' },
    { id: '4', userId: '30' },
  ]
  assert.deepEqual(
    filterFollowingUpdatesByAuthors(works, new Set(['10'])).map(
      (work) => work.id
    ),
    ['1', '3']
  )
  assert.deepEqual(
    filterFollowingUpdatesByAuthors(works, new Set(['10', '20'])).map(
      (work) => work.id
    ),
    ['1', '2', '3']
  )
  assert.deepEqual(filterFollowingUpdatesByAuthors(works, new Set()), [])
  assert.equal(works.length, 4)
})
