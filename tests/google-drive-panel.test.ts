import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compileScript, compileTemplate, parse } from 'vue/compiler-sfc'
import * as Vue from 'vue'
import ts from 'typescript'

const filename = new URL(
  '../app/components/Data/GoogleDriveSync.vue',
  import.meta.url
)
const { descriptor } = parse(readFileSync(filename, 'utf8'))
const script = compileScript(descriptor, { id: 'drive-panel-test' })
const { outputText } = ts.transpileModule(script.content, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
})

function createPanel(statusFails = false) {
  let mount: () => void = () => {}
  let unmount: () => void = () => {}
  let refreshes = 0
  const requests: string[] = []
  const errors: string[] = []
  const exports: any = {}
  const load = new Function(
    'require',
    'exports',
    'ref',
    'computed',
    'onMounted',
    'onBeforeUnmount',
    'useToast',
    '$fetch',
    outputText
  )
  load(
    (name: string) => {
      if (name === 'vue') return Vue
      if (name === '@tabler/icons-vue') return {}
      if (name === '~/stores/local-persistence')
        return {
          useLocalPersistenceStore: () => ({
            async refreshCheckedArtworkVisits() {
              refreshes++
            },
            async refreshCheckedAuthorVisits() {
              refreshes++
            },
          }),
        }
      throw new Error(`Unexpected import: ${name}`)
    },
    exports,
    Vue.ref,
    Vue.computed,
    (callback: () => void) => {
      mount = callback
    },
    (callback: () => void) => {
      unmount = callback
    },
    () => ({
      success() {},
      info() {},
      warning() {},
      error(message: string) {
        errors.push(message)
      },
    }),
    async (url: string) => {
      requests.push(url)
      if (url.endsWith('/status')) {
        if (statusFails) throw new Error('offline')
        return { connected: true }
      }
      return { found: true, artworksAdded: 1, authorsAdded: 1 }
    }
  )
  const state = exports.default.setup({}, { expose() {} })
  return {
    state,
    requests,
    errors,
    mount: () => mount(),
    unmount: () => unmount(),
    refreshes: () => refreshes,
  }
}

test('进入数据页时独立检查云盘状态，下载合并后刷新记录并可断开', async () => {
  const template = compileTemplate({
    source: descriptor.template!.content,
    filename: filename.pathname,
    id: 'drive-panel-test',
    preprocessLang: 'pug',
    preprocessOptions: { doctype: 'html' },
  })
  assert.deepEqual(template.errors, [])
  const panel = createPanel()
  panel.mount()
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual(panel.requests, ['/api/cloud/google/status'])
  assert.equal(panel.state.connected.value, true)
  assert.equal(panel.state.busy.value, false)
  await panel.state.sync()
  assert.equal(panel.refreshes(), 2)
  await panel.state.disconnect()
  assert.equal(panel.state.connected.value, false)
  panel.unmount()
})

test('云盘状态检查失败时解除忙碌状态并提示重试', async () => {
  const panel = createPanel(true)
  panel.mount()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(panel.state.busy.value, false)
  assert.equal(panel.state.connected.value, false)
  assert.match(panel.errors[0], /连接状态/)
  panel.unmount()
})
