import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { compileScript, parse } from 'vue/compiler-sfc'
import {
  effectScope,
  nextTick,
  onScopeDispose,
  ref,
  shallowReactive,
  watch,
} from 'vue'
import ts from 'typescript'

const filename = new URL(
  '../app/components/Comment/CommentArea.vue',
  import.meta.url
)
const { descriptor } = parse(readFileSync(filename, 'utf8'))
const script = compileScript(descriptor, { id: 'comment-area-test' })
const { outputText } = ts.transpileModule(script.content, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
})

type Page = { hasNext: boolean; comments: { id: string }[] }

function createArea(initial = {}) {
  const props = shallowReactive({
    id: 'a',
    count: 10,
    type: 'illust',
    disabled: false,
    ...initial,
  })
  const requests: {
    id: string
    type: string
    params: { limit: number; offset: number }
    resolve: (page: Page) => void
  }[] = []
  const fetchComments =
    (type: string) => (id: string, params: { limit: number; offset: number }) =>
      new Promise<Page>((resolve) =>
        requests.push({ id, type, params, resolve })
      )
  let intersection: (entries: { isIntersecting: boolean }[]) => void
  const exports: any = {}
  const load = new Function(
    'require',
    'exports',
    'ref',
    'watch',
    'onScopeDispose',
    'useIntersectionObserver',
    outputText
  )
  load(
    (name: string) => {
      if (name === 'vue')
        return { defineComponent: (component: unknown) => component }
      if (name === './Comment.vue') return {}
      if (name === '~/stores/artwork') {
        return {
          useArtworkStore: () => ({ fetchComments: fetchComments('illust') }),
        }
      }
      if (name === '~/stores/novel') {
        return {
          useNovelStore: () => ({ fetchComments: fetchComments('novel') }),
        }
      }
      throw new Error(`Unexpected import: ${name}`)
    },
    exports,
    ref,
    watch,
    onScopeDispose,
    (_target: unknown, callback: typeof intersection) => {
      intersection = callback
    }
  )
  const scope = effectScope()
  const state = scope.run(() => exports.default.setup(props, { expose() {} }))
  return {
    props,
    requests,
    state,
    visible(value: boolean) {
      intersection([{ isIntersecting: value }])
    },
    dispose() {
      scope.stop()
    },
  }
}

test('switching artwork clears comments and restarts pagination at offset zero', async (t) => {
  const area = createArea()
  t.after(() => area.dispose())
  area.visible(true)
  assert.deepEqual(area.requests[0].params, { limit: 3, offset: 0 })
  area.requests[0].resolve({
    hasNext: true,
    comments: [{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }],
  })
  await nextTick()
  const more = area.state.init(true)
  assert.deepEqual(area.requests[1].params, { limit: 30, offset: 3 })
  area.requests[1].resolve({ hasNext: false, comments: [{ id: 'a4' }] })
  await more

  area.props.id = 'b'
  await nextTick()
  assert.deepEqual(area.state.comments.value, [])
  assert.equal(area.state.hasNext.value, false)
  assert.equal(area.state.loading.value, true)
  assert.equal(area.requests[2].id, 'b')
  assert.deepEqual(area.requests[2].params, { limit: 3, offset: 0 })
  area.requests[2].resolve({ hasNext: false, comments: [{ id: 'b1' }] })
  await nextTick()
  assert.deepEqual(area.state.comments.value, [{ id: 'b1' }])
})

test('old requests cannot append comments or clear loading after rapid a-b-a navigation', async (t) => {
  const area = createArea()
  t.after(() => area.dispose())
  area.visible(true)
  area.props.id = 'b'
  await nextTick()
  area.props.id = 'a'
  await nextTick()
  assert.equal(area.requests.length, 3)
  area.requests[0].resolve({ hasNext: true, comments: [{ id: 'old-a' }] })
  await nextTick()
  assert.deepEqual(area.state.comments.value, [])
  assert.equal(area.state.loading.value, true)
  area.requests[2].resolve({ hasNext: false, comments: [{ id: 'new-a' }] })
  await nextTick()
  area.requests[1].resolve({ hasNext: true, comments: [{ id: 'old-b' }] })
  await nextTick()
  assert.deepEqual(area.state.comments.value, [{ id: 'new-a' }])
  assert.equal(area.state.hasNext.value, false)
  assert.equal(area.state.loading.value, false)
})

test('hidden comments remain lazy and repeated visibility does not load another page', async (t) => {
  const area = createArea()
  t.after(() => area.dispose())
  assert.equal(area.requests.length, 0)
  area.visible(true)
  area.requests[0].resolve({ hasNext: true, comments: [{ id: 'a1' }] })
  await nextTick()
  area.visible(false)
  area.props.id = 'b'
  await nextTick()
  assert.deepEqual(area.state.comments.value, [])
  assert.equal(area.requests.length, 1)
  area.visible(true)
  area.requests[1].resolve({ hasNext: true, comments: [{ id: 'b1' }] })
  await nextTick()
  area.visible(false)
  area.visible(true)
  assert.equal(area.requests.length, 2)
})

test('empty and disabled comment areas clear the previous artwork without fetching', async (t) => {
  const area = createArea()
  t.after(() => area.dispose())
  area.visible(true)
  area.requests[0].resolve({ hasNext: true, comments: [{ id: 'a1' }] })
  await nextTick()
  area.props.id = 'b'
  area.props.count = 0
  await nextTick()
  assert.deepEqual(area.state.comments.value, [])
  assert.equal(area.state.hasNext.value, false)
  assert.equal(area.state.loading.value, false)
  assert.equal(area.requests.length, 1)
  area.props.id = 'c'
  area.props.count = 10
  area.props.disabled = true
  await nextTick()
  assert.equal(area.requests.length, 1)
  area.props.disabled = false
  await nextTick()
  assert.equal(area.requests[1].id, 'c')
})

test('changing work type uses the correct API and unmounted requests are ignored', async () => {
  const area = createArea()
  area.visible(true)
  area.props.type = 'novel'
  await nextTick()
  assert.equal(area.requests[1].type, 'novel')
  assert.deepEqual(area.requests[1].params, { limit: 3, offset: 0 })
  area.dispose()
  area.requests[0].resolve({ hasNext: true, comments: [{ id: 'illust' }] })
  area.requests[1].resolve({ hasNext: true, comments: [{ id: 'novel' }] })
  await nextTick()
  assert.deepEqual(area.state.comments.value, [])
})
