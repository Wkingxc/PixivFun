<template lang="pug">
span.artwork-viewed-overlay(
  :style='overlayStyle'
  aria-hidden='true'
  v-if='isViewed && marker.markArtworkImage'
)
</template>

<script lang="ts" setup>
import { useLocalPersistenceStore } from '~/stores/local-persistence'

const props = defineProps<{
  artworkId: string | number
  disabled?: boolean
}>()
const store = useLocalPersistenceStore()
const { isViewed } = useArtworkViewedState(
  () => props.artworkId,
  () => !!props.disabled
)
const marker = computed(() => store.viewedMarker)
const overlayStyle = computed(() => {
  const { r, g, b, a } = marker.value.artworkVisitedColor
  return {
    backgroundColor: `rgb(${r} ${g} ${b} / ${a})`,
    opacity: marker.value.artworkImageOverlayOpacity,
  }
})
</script>

<style scoped>
.artwork-viewed-overlay {
  position: absolute;
  z-index: 4;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  transition:
    background-color 160ms ease,
    opacity 160ms ease;
}
</style>
