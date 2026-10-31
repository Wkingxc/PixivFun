import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import ts from 'typescript'
import * as backupHelpers from '../shared/local-backup.ts'

const filename = new URL('../app/pages/data.vue', import.meta.url)
const { descriptor } = parse(readFileSync(filename, 'utf8'))
const script = compileScript(descriptor, { id: 'data-page-test' })
const { outputText } = ts.transpileModule(script.content, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
})

function createPage() {
  const stored = new Map<string, string>()
  const requests: { url: string; options?: any }[] = []
  const downloads: Blob[] = []
  let response: unknown = { imported: { artworks: 2, authorVisits: 1 } }
  let fail = false
  let clicks = 0
  const exports: any = {}
  const load = new Function(
    'require',
    'exports',
    'ref',
    'shallowRef',
    'computed',
    'onMounted',
    '$fetch',
    'localStorage',
    'document',
    'URL',
    'setTimeout',
    outputText
  )
  load(
    (name: string) => {
      if (name === 'vue') return Vue
      if (name === '~/components/Card.vue') return {}
      if (name === '~/components/Data/GoogleDriveSync.vue') return {}
      if (name === '~/utils/setTitle') return { setTitle() {} }
      if (name === '~~/shared/local-backup') return backupHelpers
      throw new Error(`Unexpected import: ${name}`)
    },
    exports,
    Vue.ref,
    Vue.shallowRef,
    Vue.computed,
    () => {},
    async (url: string, options?: any) => {
      requests.push({ url, options })
      if (fail) throw { data: { message: '无效备份' } }
      return response
    },
    {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    {
      createElement: () => ({
        click() {
          clicks++
        },
        remove() {},
      }),
      body: { append() {} },
    },
    {
      createObjectURL: (blob: Blob) => {
        downloads.push(blob)
        return 'blob:test'
      },
      revokeObjectURL() {},
    },
    () => {}
  )
  const state = exports.default.setup({}, { expose() {} })
  return {
    state,
    stored,
    requests,
    downloads,
    setResponse(value: unknown) {
      response = value
    },
    setFail() {
      fail = true
    },
    clicks: () => clicks,
  }
}

const legacy = {
  exportedAt: 1,
  data: { visitedArtworkIds: ['123'], visitedAuthorIds: ['42'] },
}
function fileEvent(content: string) {
  return { target: { files: [new File([content], 'backup.json')] } }
}

test('备份页模板可编译；选择文件只预览，确认后才合并，失败可重试', async () => {
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename: filename.pathname,
    id: 'data-page-test',
    preprocessLang: 'pug',
    preprocessOptions: { doctype: 'html' },
  })
  assert.deepEqual(template.errors, [])
  const page = createPage()
  await page.state.selectFile(fileEvent(JSON.stringify(legacy)))
  assert.equal(page.requests.length, 0)
  assert.equal(page.state.backup.value.data.visitedArtworkIds.length, 1)
  assert.equal(page.state.restorePreferences.value, false)
  assert.equal(page.state.legacyBackup.value, true)
  await page.state.importBackup()
  assert.equal(page.requests[0].options.body.restorePreferences, false)
  assert.equal(page.state.completed.value, true)

  const invalid = createPage()
  await invalid.state.selectFile(fileEvent(JSON.stringify(legacy)))
  await invalid.state.selectFile(fileEvent('{broken'))
  assert.equal(invalid.state.backup.value, undefined)
  assert.match(invalid.state.error.value, /JSON/)
  assert.equal(invalid.requests.length, 0)
  await invalid.state.selectFile(fileEvent(JSON.stringify(legacy)))
  invalid.setFail()
  await invalid.state.importBackup()
  assert.equal(invalid.state.completed.value, false)
  assert.equal(invalid.state.busy.value, false)
  assert.equal(invalid.state.error.value, '无效备份')
})

test('导出仅收集白名单浏览器设置；导入可选择恢复布局', async () => {
  const page = createPage()
  const backup = backupHelpers.parseLocalBackup(legacy)
  backup.preferences = { appearance: { theme: 'dark' } }
  backup.browserPreferences = { 'pixivfun:marker-button-visible': 'false' }
  page.setResponse(backup)
  page.stored.set('pixivfun:artwork-layout-columns', '4')
  page.stored.set('unrelated-token', 'private')
  await page.state.exportBackup()
  assert.equal(page.clicks(), 1)
  const exported = JSON.parse(await page.downloads[0].text())
  assert.equal(
    exported.browserPreferences['pixivfun:artwork-layout-columns'],
    '4'
  )
  assert.equal(JSON.stringify(exported).includes('private'), false)
  const imported = createPage()
  await imported.state.selectFile(fileEvent(JSON.stringify(backup)))
  assert.equal(imported.state.restorePreferences.value, true)
  assert.equal(imported.state.legacyBackup.value, false)
  imported.state.restorePreferences.value = true
  await imported.state.importBackup()
  assert.equal(imported.stored.get('pixivfun:marker-button-visible'), 'false')
  assert.equal(imported.requests[0].options.body.restorePreferences, true)
})
