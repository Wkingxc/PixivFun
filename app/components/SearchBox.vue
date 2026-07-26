<template lang="pug">
.search-box(:class='{ "no-icon": noIcon }')
  input(
    :aria-label='placeholder',
    :placeholder='placeholder'
    @blur='focused = false'
    @focus='focused = true'
    @keydown.esc='suggestions = []'
    @keyup.enter='makeSearch'
    v-model='keyword'
  )
  IFasSearch.icon(data-icon v-if='!noIcon')
  .search-suggestions(v-if='showSuggestions')
    button.suggestion-item(
      :key='item.tag'
      @mousedown.prevent='applySuggestion(item)'
      type='button'
      v-for='item in suggestions'
    )
      span.suggestion-tag {{ item.tag }}
      span.suggestion-translation(v-if='item.translation') {{ item.translation }}
</template>

<script lang="ts" setup>
import IFasSearch from '~icons/fa-solid/search'
import {
  createSequenceGuard,
  type SearchSuggestion,
} from '~/utils/searchSuggestions'

const props = defineProps<{
  type?: string
  noIcon?: boolean
  placeholder?: string
}>()

const placeholder = computed(
  () => props.placeholder || '输入关键词搜索/输入 id:数字 查看作品'
)

const route = useRoute()
const router = useRouter()
const keyword = ref((route.query.q as string) || '')

const pixivClient = usePixivClient()
const suggestions = ref<SearchSuggestion[]>([])
const focused = ref(false)
const showSuggestions = computed(
  () => focused.value && suggestions.value.length > 0
)
const suggestionGuard = createSequenceGuard()
let suggestionTimer: ReturnType<typeof setTimeout> | undefined

watch(keyword, (value) => {
  if (suggestionTimer) clearTimeout(suggestionTimer)
  const trimmed = value.trim()
  // Artwork-id style input never needs tag suggestions.
  if (!trimmed || /^(?:id:)?\d+$/i.test(trimmed)) {
    suggestions.value = []
    return
  }
  suggestionTimer = setTimeout(() => fetchSuggestions(trimmed), 300)
})

onBeforeUnmount(() => {
  if (suggestionTimer) clearTimeout(suggestionTimer)
})

async function fetchSuggestions(word: string): Promise<void> {
  const seq = suggestionGuard.next()
  try {
    const list = await pixivClient.getSearchSuggestions(word)
    if (!suggestionGuard.isCurrent(seq)) return
    suggestions.value = list.slice(0, 8)
  } catch {
    if (suggestionGuard.isCurrent(seq)) suggestions.value = []
  }
}

function applySuggestion(item: SearchSuggestion): void {
  keyword.value = item.tag
  suggestions.value = []
  makeSearch()
}

function makeSearch(): void {
  const normalizedKeyword = keyword.value.trim()
  if (!normalizedKeyword) return
  suggestions.value = []
  const artworkId = /^(?:id:)?(\d+)$/i.exec(normalizedKeyword)?.[1]
  if (artworkId) {
    router.push(`/artworks/${artworkId}`)
    return
  }
  const query: Record<string, string> = {}
  // Already on the search page: keep the active tab and filters, only
  // swap the keyword and reset pagination.
  if (route.path === '/search') {
    for (const [key, value] of Object.entries(route.query)) {
      if (typeof value === 'string') query[key] = value
    }
    delete query.p
  }
  query.q = normalizedKeyword
  if (props.type && props.type !== 'artworks') {
    query.type = props.type
  }
  router.push({ path: '/search', query })
}
</script>

<style lang="scss">
// Search Box
.search-box {
  display: flex;
  position: relative;
  align-items: center;
  font-size: 0.8rem;

  &.no-icon input {
    padding-left: 0.6em;
  }

  .icon,
  [data-icon] {
    position: absolute;
    left: 0.6em;
    pointer-events: none;
    color: var(--pf-muted);
    transition: all 0.24s ease-in-out;
  }

  input {
    font-size: inherit;
    box-sizing: border-box;
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    border-radius: 999px;
    box-shadow: 0 4px 16px rgb(67 41 59 / 7%);
    padding: 0.2rem 0.6em;
    padding-left: 2em;
    height: 2rem;
    width: 100%;
    transition: all 0.12s ease-in-out;

    &:focus {
      color: var(--pf-text);
      border-color: var(--pf-pink);
      outline: 0;
      box-shadow: 0 0 0 3px var(--pf-soft-pink);
    }

    &:focus + .icon,
    &:focus + [data-icon] {
      color: var(--pf-pink);
    }
  }

  .search-suggestions {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 30;
    display: grid;
    padding: 6px;
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    border-radius: 12px;
    box-shadow: 0 10px 28px rgb(0 0 0 / 14%);
    max-height: 320px;
    overflow-y: auto;
  }

  .suggestion-item {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding: 7px 10px;
    font-size: 0.82rem;
    text-align: left;
    color: var(--pf-text);
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;

    &:hover {
      background: var(--pf-soft-pink);
    }

    .suggestion-tag {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .suggestion-translation {
      flex-shrink: 0;
      color: var(--pf-muted);
      font-size: 0.76rem;
    }
  }

  &.big {
    font-size: 1.4rem;

    input {
      width: 100%;
      height: 3rem;
    }

    .search-suggestions {
      font-size: 1rem;
    }

    .suggestion-item {
      font-size: 0.95rem;
      padding: 9px 12px;
    }
  }
}
</style>
