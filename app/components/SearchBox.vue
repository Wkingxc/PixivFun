<template lang="pug">
.search-box(:class='{ "no-icon": noIcon }')
  input(
    :aria-label='placeholder',
    :placeholder='placeholder'
    @keyup.enter='makeSearch'
    v-model='keyword'
  )
  IFasSearch.icon(data-icon v-if='!noIcon')
</template>

<script lang="ts" setup>
import IFasSearch from '~icons/fa-solid/search'

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

function makeSearch(): void {
  const normalizedKeyword = keyword.value.trim()
  if (!normalizedKeyword) return
  const artworkId = /^(?:id:)?(\d+)$/i.exec(normalizedKeyword)?.[1]
  if (artworkId) {
    router.push(`/artworks/${artworkId}`)
    return
  }
  const query: Record<string, string> = { q: normalizedKeyword }
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

  &.big {
    font-size: 1.4rem;

    input {
      width: 100%;
      height: 3rem;
    }
  }
}
</style>
