<template lang="pug">
span.fnb-tag(
  :class='{ "fnb-tag--active": active, "fnb-tag--clickable": clickable }',
  :role='clickable ? "button" : undefined',
  :style='colorStyle',
  :tabindex='clickable ? 0 : undefined'
  @click='clickable ? $emit("click", $event) : undefined'
  @keydown.enter='clickable ? $emit("click", $event) : undefined'
)
  slot
</template>

<script lang="ts" setup>
defineEmits<{
  click: [event: Event]
}>()

const props = withDefaults(
  defineProps<{
    color?: string
    active?: boolean
    clickable?: boolean
  }>(),
  {
    clickable: false,
  }
)

const colorStyle = computed(() => {
  if (!props.color) return undefined
  return { 'background-color': props.color }
})
</script>

<style scoped lang="scss">
.fnb-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.2rem 0.55rem;
  color: var(--pf-text);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  box-shadow: none;
  font-size: 0.78rem;
  line-height: 1.4;
  transition:
    color 150ms ease,
    background 150ms ease,
    border-color 150ms ease;

  &--active {
    background: var(--pf-soft-pink);
    color: var(--pf-pink);
    border-color: color-mix(in srgb, var(--pf-pink) 36%, var(--pf-line));
    font-weight: 700;
  }

  &--clickable {
    cursor: pointer;

    &:hover {
      color: var(--pf-pink);
      background: var(--pf-soft-pink);
      border-color: color-mix(in srgb, var(--pf-pink) 36%, var(--pf-line));
    }

    &:focus-visible {
      outline: 2px solid var(--pf-pink);
      outline-offset: 2px;
    }
  }
}
</style>
