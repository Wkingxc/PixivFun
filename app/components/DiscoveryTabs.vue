<template lang="pug">
.discovery-tabs
  button.discovery-tab(
    :class='{ active: modelValue === tab.value, disabled: tab.disabled }',
    :disabled='tab.disabled',
    :key='tab.value'
    @click='!tab.disabled && $emit("update:modelValue", tab.value)'
    v-for='tab in tabs'
  )
    | {{ tab.label }}
    span.coming-soon(v-if='tab.disabled') soon
</template>

<script lang="ts" setup>
defineProps<{ modelValue: string }>()
defineEmits<{ 'update:modelValue': [value: string] }>()

const tabs = [
  { label: '插画·漫画', value: 'all', disabled: false },
  { label: '小说', value: 'novel', disabled: false },
]
</script>

<style scoped lang="scss">
.discovery-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.discovery-tab {
  padding: 0.3rem 0.75rem;
  font-family: inherit;
  font-size: 0.85rem;
  font-weight: 700;
  background: var(--pf-surface);
  color: var(--pf-muted);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  box-shadow: none;
  cursor: pointer;
  transition: all 150ms;

  &.active {
    background: var(--pf-blue);
    color: #fff;
    border-color: var(--pf-blue);
  }

  &.disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &:hover:not(.active):not(.disabled) {
    background: var(--pf-soft-blue);
    color: var(--pf-blue);
    border-color: color-mix(in srgb, var(--pf-blue) 36%, var(--pf-line));
  }

  .coming-soon {
    font-size: 0.6rem;
    margin-left: 0.25rem;
    vertical-align: super;
    opacity: 0.7;
  }
}
</style>
