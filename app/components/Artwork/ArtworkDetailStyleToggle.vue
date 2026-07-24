<template lang="pug">
.artwork-style-control
  span.artwork-style-label 作品页
  FnbSelect(
    :model-value='style',
    :options='options'
    @update:model-value='updateStyle'
  )
</template>

<script lang="ts" setup>
import type { ArtworkDetailStyle } from '~/utils/artworkDetailStyle'

const { style } = useArtworkDetailStyle()
const options = [
  { label: '经典', value: 'classic' },
  { label: 'UI 新版', value: 'modern' },
]

function updateStyle(value: string) {
  style.value = value as ArtworkDetailStyle
}
</script>

<style scoped lang="scss">
.artwork-style-control {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--pf-muted);
  font-size: 0.72rem;
  white-space: nowrap;

  :deep(.fnb-select) {
    min-width: 5.5rem;
  }

  :deep(.fnb-select-trigger) {
    min-height: 34px;
    padding: 0 9px;
    color: var(--pf-text);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
    border-radius: 9px;
    box-shadow: none;
    font-size: 0.75rem;

    &:hover {
      color: var(--pf-blue);
      box-shadow: none;
      transform: none;
    }
  }

  :deep(.fnb-select-dropdown) {
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    border-radius: 9px;
    box-shadow: var(--pf-card-shadow);
  }
}

@media (max-width: 1180px) {
  .artwork-style-label {
    display: none;
  }
}
</style>
