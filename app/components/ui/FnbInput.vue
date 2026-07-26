<template lang="pug">
input.fnb-input(
  :class='{ "fnb-input--disabled": disabled }',
  :disabled='disabled',
  :placeholder='placeholder',
  :readonly='readonly',
  :type='type',
  :value='modelValue'
  @input='onInput'
)
</template>

<script lang="ts" setup>
const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

withDefaults(
  defineProps<{
    modelValue?: string
    placeholder?: string
    type?: string
    disabled?: boolean
    readonly?: boolean
  }>(),
  {
    type: 'text',
  }
)

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLInputElement).value)
}
</script>

<style scoped lang="scss">
.fnb-input {
  width: 100%;
  min-height: 42px;
  padding: 0.65rem 0.85rem;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  box-shadow: none;
  font: inherit;
  transition:
    border-color 150ms ease,
    box-shadow 150ms ease;

  &:focus {
    border-color: var(--pf-pink);
    outline: 0;
    box-shadow: 0 0 0 3px var(--pf-soft-pink);
  }

  &::placeholder {
    color: var(--pf-muted);
  }

  &--disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
