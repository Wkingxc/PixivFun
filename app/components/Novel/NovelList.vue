<template lang="pug">
ul.novel-list
  template(v-if='loading')
    li(:key='`skeleton-${i}`' v-for='i in skeletonNumber')
      NovelCard(loading)
  template(v-else)
    li(:key='item.id' v-for='item in novels')
      NovelCard(:item='item')
</template>

<script lang="ts" setup>
import NovelCard from './NovelCard.vue'
import type { NovelInfo } from '~/types'

const props = defineProps<{
  list: NovelInfo[]
  loading?: boolean | number
  /** Skip the author blocklist (own bookmarks / author's own page). */
  filterDisabled?: boolean
}>()

const { filterBlocked } = useAuthorBlocklist()

const novels = computed(() =>
  props.filterDisabled ? props.list : filterBlocked(props.list)
)

const skeletonNumber = computed(() =>
  typeof props.loading === 'number' ? props.loading : 6
)
</script>

<style scoped lang="scss">
.novel-list {
  list-style: none;
  padding-left: 0;
  margin-top: 1rem;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1.25rem;

  li {
    min-width: 0;
  }
}
</style>
