import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { parse, compileScript, compileTemplate } from 'vue/compiler-sfc'
import ts from 'typescript'
import { getAuthorArtworkPage } from '../app/utils/refineModernArtwork.ts'
import { createDirectoryCoverPreloader } from '../app/utils/directoryCoverPreloader.ts'

function createLoader(capacity = 36, timeoutMs = 8000) {
  const images: {
    src: string
    onload: null | (() => Promise<void>)
    onerror: null | (() => void)
    decode: () => Promise<void>
  }[] = []
  const loader = createDirectoryCoverPreloader(
    () => {
      const image = {
        src: '',
        onload: null,
        onerror: null,
        decode: async () => {},
      }
      images.push(image)
      return image as unknown as HTMLImageElement
    },
    capacity,
    timeoutMs
  )
  return { ...loader, images }
}

test('六张封面并行加载并等待解码，重复预载复用同一请求', async () => {
  const loader = createLoader()
  const urls = Array.from({ length: 6 }, (_, index) => `/cover-${index}.jpg`)
  let decoded!: () => void
  let ready = false
  const first = loader.preload(urls).then(() => {
    ready = true
  })
  const repeated = loader.preload([...urls, urls[0], ''])
  assert.equal(loader.images.length, 6)
  assert.deepEqual(loader.readyUrls(), [])
  loader.images[0].decode = () =>
    new Promise((resolve) => {
      decoded = resolve
    })
  const loading = loader.images.map((image) => image.onload!())
  await Promise.resolve()
  assert.equal(ready, false)
  decoded()
  await Promise.all([...loading, first, repeated])
  assert.equal(ready, true)
  assert.deepEqual(loader.readyUrls(), urls)
  await loader.preload(urls)
  assert.equal(loader.images.length, 6)
})

test('单张封面失败不阻塞整页，并允许下次重试', async () => {
  const loader = createLoader()
  const page = loader.preload(['/good.jpg', '/failed.jpg'])
  await loader.images[0].onload!()
  loader.images[1].onerror!()
  await page
  assert.deepEqual(loader.readyUrls(), ['/good.jpg'])
  const retry = loader.preload(['/good.jpg', '/failed.jpg'])
  assert.equal(loader.images.length, 3)
  await loader.images[2].onload!()
  await retry
})

test('缓存限制解码图片数量，并在切换作者后清空', async () => {
  const loader = createLoader(2)
  for (const url of ['/a', '/b', '/c']) {
    const request = loader.preload([url])
    await loader.images.at(-1)!.onload!()
    await request
  }
  await loader.preload(['/b', '/c'])
  assert.equal(loader.images.length, 3)
  const evicted = loader.preload(['/a'])
  await loader.images.at(-1)!.onload!()
  await evicted
  assert.equal(loader.images.length, 4)
  loader.clear()
  assert.deepEqual(loader.readyUrls(), [])
  const nextAuthor = loader.preload(['/a'])
  await loader.images.at(-1)!.onload!()
  await nextAuthor
  assert.equal(loader.images.length, 5)
})

test('封面请求超时后解除等待，避免翻页一直锁定', async () => {
  const loader = createLoader(36, 10)
  await loader.preload(['/timeout.jpg'])
  const retry = loader.preload(['/timeout.jpg'])
  assert.equal(loader.images.length, 2)
  await loader.images[1].onload!()
  await retry
})

const filename = 'app/components/Artwork/AuthorArtworkDirectory.vue'
const { descriptor } = parse(
  readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8')
)

test('作者目录的 Vue/Pug 模板可以编译', () => {
  const script = compileScript(descriptor, { id: 'directory-preload-test' })
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename,
    id: 'directory-preload-test',
    preprocessLang: 'pug',
    preprocessOptions: { doctype: 'html' },
    compilerOptions: { bindingMetadata: script.bindings },
  })
  assert.deepEqual(template.errors, [])
})

test('翻页预载前后各六张，滚动窗口只预载当前及相邻两页封面', async () => {
  const source = ts.createSourceFile(
    filename,
    descriptor.scriptSetup!.content,
    ts.ScriptTarget.Latest,
    true
  )
  const names = new Set([
    'preloadAdjacentPages',
    'preloadPageCovers',
    'loadScrollWindow',
  ])
  const functions = source.statements
    .filter(
      (statement) =>
        ts.isFunctionDeclaration(statement) && names.has(statement.name!.text)
    )
    .map((statement) => statement.getText(source))
    .join('\n')
  const { outputText } = ts.transpileModule(functions, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  })
  const entries = Array.from({ length: 30 }, (_, index) => ({
    id: String(index),
    category: 'illust',
  }))
  const covers: string[][] = []
  const pages: number[] = []
  const create = new Function(
    'directoryEntries',
    'artworkCache',
    'totalPages',
    'getAuthorArtworkPage',
    'loadPage',
    'coverPreloader',
    'readyCoverUrls',
    `const directoryRequestId = 0; const pageSize = 6; ${outputText}; return { preloadAdjacentPages, loadScrollWindow }`
  )
  const directory = create(
    { value: entries },
    {
      value: Object.fromEntries(
        entries.map((entry) => [entry.id, { url: `/cover-${entry.id}` }])
      ),
    },
    { value: 5 },
    getAuthorArtworkPage,
    async (page: number) => {
      pages.push(page)
    },
    {
      preload: async (urls: string[]) => {
        covers.push(urls)
      },
      readyUrls: () => [],
    },
    { value: new Set() }
  )
  await directory.preloadAdjacentPages(3)
  assert.deepEqual(pages, [2, 4])
  assert.deepEqual(
    covers.flat().sort(),
    [...entries.slice(6, 12), ...entries.slice(18, 24)]
      .map((entry) => `/cover-${entry.id}`)
      .sort()
  )
  pages.length = 0
  covers.length = 0
  await directory.loadScrollWindow(3)
  assert.deepEqual(pages, [1, 2, 3, 4, 5])
  assert.deepEqual(
    covers.flat().sort(),
    entries
      .slice(6, 24)
      .map((entry) => `/cover-${entry.id}`)
      .sort()
  )
  pages.length = 0
  covers.length = 0
  await directory.preloadAdjacentPages(1)
  assert.deepEqual(pages, [2])
  assert.equal(covers.flat().length, 6)
})
