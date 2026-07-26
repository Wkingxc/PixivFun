<template lang="pug">
.fnb-tabs
  .fnb-tabs__nav
    button.fnb-tabs__tab(
      :class='{ "fnb-tabs__tab--active": modelValue === tab.key }',
      :key='tab.key'
      @click='$emit("update:modelValue", tab.key)'
      v-for='tab in tabs'
    ) {{ tab.label }}
  .fnb-tabs__panel(
    :key='tab.key'
    v-for='tab in tabs'
    v-show='modelValue === tab.key'
  )
    slot(:name='`panel-${tab.key}`')
</template>

<script lang="ts" setup>
defineEmits<{
  'update:modelValue': [value: string]
}>()

defineProps<{
  modelValue?: string
  tabs: { key: string; label: string }[]
}>()
</script>

<style scoped lang="scss">
.fnb-tabs__nav {
  display: flex;
  gap: 4px;
  padding: 0;
  background: transparent;
  border-bottom: 1px solid var(--pf-line);
}

.fnb-tabs__tab {
  flex: 0 1 auto;
  padding: 10px 18px 9px;
  background: transparent;
  border: 0;
  border-bottom: 3px solid transparent;
  font-family: inherit;
  font-size: 0.82rem;
  font-weight: 680;
  cursor: pointer;
  transition:
    color 150ms,
    background 150ms;
  color: var(--pf-muted);

  &:hover:not(.fnb-tabs__tab--active) {
    color: var(--pf-text);
    background: var(--pf-soft-pink);
  }

  &--active {
    color: var(--pf-pink);
    font-weight: 760;
    background: transparent;
    border-color: var(--pf-pink);
  }
}

.fnb-tabs__panel {
  margin-top: 1rem;
}
</style>
