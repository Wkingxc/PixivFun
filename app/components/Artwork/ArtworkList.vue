<template lang="pug">
Component.artworks-list(
  :class='{ inline, "artworks-list--controlled": controlled }',
  :is='inline ? "div" : "ul"',
  :style='controlled ? gridStyle : undefined'
)
  template(v-if='loading')
    li(:key='"skeleton-" + i' v-for='i in skeletonNumber')
      ArtworkCard(loading)
  template(v-else)
    li(:key='item.id' v-for='item in artworks')
      ArtworkCard(
        :image-quality='controlled ? normalizedImageQuality : undefined',
        :image-zoom='imageZoom',
        :item='item',
        :marker-disabled='markerDisabled',
        :selectable='selectable',
        :selected='selectedIds?.includes(item.id)'
        @toggle-selection='$emit("toggle-selection", $event)'
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
  controlled?: boolean
  selectable?: boolean
  selectedIds?: string[]
}>()

defineEmits<{
  'toggle-selection': [item: ArtworkInfo]
}>()

const skeletonNumber = computed(() =>
  typeof props.loading === 'number' ? props.loading : 8
)

const artworks = computed(() => {
  return props.list.filter((item): item is ArtworkInfo => isArtwork(item))
})

const localPersistence = useLocalPersistenceStore()
const { gridStyle, normalizedImageQuality } = useArtworkLayoutSettings()
watch(
  artworks,
  (items) => {
    if (props.markerDisabled) return
    void localPersistence
      .ensureArtworkVisits(
        items.filter((item) => item.type !== 'novel').map((item) => item.id)
      )
      .catch(() => {})
    void localPersistence
      .ensureAuthorVisits(items.map((item) => item.userId))
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
    // Compact horizontal scrollbar for the one-row presentation.
    scrollbar-width: thin;
    scrollbar-color: var(--pf-muted) var(--pf-bg);

    li:not(:first-of-type) {
      margin-left: 0.75rem;
    }
  }

  li {
    width: 180px;
    max-width: calc(45vw - 1.5rem);
    display: inline-block;
  }

  &--controlled {
    padding-left: 0;

    > li {
      display: block;
      width: auto;
      min-width: 0;
      max-width: none;
    }
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
