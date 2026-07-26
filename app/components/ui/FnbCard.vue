<template lang="pug">
.fnb-card(:class='[`fnb-card--${color}`, `fnb-card--shadow-${shadow}`]')
  slot
</template>

<script lang="ts" setup>
withDefaults(
  defineProps<{
    color?: 'white' | 'brand' | 'highlight' | 'success'
    shadow?: 'sm' | 'md' | 'lg' | 'none'
  }>(),
  {
    color: 'white',
    shadow: 'md',
  }
)
</script>

<style scoped lang="scss">
.fnb-card {
  padding: 1rem;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  box-shadow: var(--pf-card-shadow);
  transition: all 150ms;

  &--shadow-sm {
    box-shadow: 0 4px 14px rgb(67 41 59 / 8%);
  }

  &--shadow-md {
    box-shadow: var(--pf-card-shadow);
  }

  &--shadow-lg {
    box-shadow: 0 16px 44px rgb(67 41 59 / 16%);
  }

  &--shadow-none {
    box-shadow: none;
  }

  &--brand {
    background: var(--pf-soft-blue);
    color: var(--pf-text);
  }

  &--highlight {
    background: var(--pf-soft-pink);
    color: var(--pf-text);
  }

  &--success {
    background: color-mix(in srgb, #36d879 12%, var(--pf-surface));
    color: var(--pf-text);
  }
}
</style>
