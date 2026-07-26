<template lang="pug">
.fnb-mbox(:class='`fnb-mbox--${type}`')
  .fnb-mbox__header(v-if='header || $slots.header')
    slot(name='header') {{ header }}
  .fnb-mbox__body
    slot
  button.fnb-mbox__close(
    @click='$emit("close")'
    aria-label='关闭'
    v-if='closable'
  ) ×
</template>

<script lang="ts" setup>
defineEmits<{
  close: []
}>()

withDefaults(
  defineProps<{
    type?: 'info' | 'success' | 'warning' | 'error'
    header?: string
    closable?: boolean
  }>(),
  {
    type: 'info',
  }
)
</script>

<style scoped lang="scss">
.fnb-mbox {
  padding: 1rem;
  position: relative;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 14px;
  box-shadow: 0 5px 18px rgb(67 41 59 / 8%);

  &--info {
    background: var(--pf-surface);
  }

  &--success {
    color: #16864c;
    background: color-mix(in srgb, #36d879 12%, var(--pf-surface));
    border-color: color-mix(in srgb, #36d879 44%, var(--pf-line));
  }

  &--warning {
    color: #9a6900;
    background: color-mix(in srgb, #ffc849 15%, var(--pf-surface));
    border-color: color-mix(in srgb, #ffc849 48%, var(--pf-line));
  }

  &--error {
    color: #d74755;
    background: color-mix(in srgb, #ed5a68 11%, var(--pf-surface));
    border-color: color-mix(in srgb, #ed5a68 44%, var(--pf-line));
  }
}

.fnb-mbox__header {
  font-weight: 900;
  margin-bottom: 0.5rem;
}

.fnb-mbox__close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  font-weight: 900;
  line-height: 1;
  padding: 0.25rem;
  color: inherit;
}
</style>
