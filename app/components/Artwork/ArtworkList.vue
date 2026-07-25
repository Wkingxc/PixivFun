<template lang="pug">
Component.artworks-list(:class='{ inline }', :is='inline ? "div" : "ul"')
  template(v-if='loading')
    li(:key='"skeleton-" + i' v-for='i in skeletonNumber')
      ArtworkCard(loading)
  template(v-else)
    li(:key='item.id' v-for='item in artworks')
      ArtworkCard(
        :image-zoom='imageZoom',
        :item='item',
        :marker-disabled='markerDisabled'
      )
</template>

<script lang="ts" setup>
import ArtworkCard from './ArtworkCard.vue'
import { isArtwork } from '~/utils'
import type { ArtworkInfo, ArtworkInfoOrAd } from '~/types'
import { useLocalPersistenceStore } from '~/stores/local-persistence'

const props = defineProps<{
  list: ArtworkInfoOrAd[]
  loading?: boolean | number
  inline?: boolean
  imageZoom?: boolean
  markerDisabled?: boolean
}>()

const skeletonNumber = computed(() =>
  typeof props.loading === 'number' ? props.loading : 8
)

const artworks = computed(() => {
  return props.list.filter((item): item is ArtworkInfo => isArtwork(item))
})

const localPersistence = useLocalPersistenceStore()
watch(
  artworks,
  (items) => {
    if (props.markerDisabled) return
    void localPersistence
      .ensureArtworkVisits(
        items.filter((item) => item.type !== 'novel').map((item) => item.id)
      )
      .catch(() => {})
  },
  { immediate: true }
)
</script>

<style lang="scss">
.artworks-list {
  margin-top: 1rem;
  list-style: none;
  padding-left: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
  justify-content: center;

  &.inline {
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    display: block;
    max-width: 100%;
    // Neubrutalism scrollbar styling
    scrollbar-width: thin;
    scrollbar-color: var(--fnb-text) var(--fnb-bg);

    li:not(:first-of-type) {
      margin-left: 0.75rem;
    }
  }

  li {
    width: 180px;
    max-width: calc(45vw - 1.5rem);
    display: inline-block;
  }
}

.tiny {
  gap: 0.75rem;

  li {
    width: 100px;
  }

  .info {
    display: none;
  }
}
</style>
