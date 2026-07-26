<template lang="pug">
.fnb-float-button(:style='positionStyle')
  button.fnb-float-button__main(
    @click='$emit("click", $event)'
    v-bind='$attrs'
  )
    slot
  .fnb-float-button__menu(v-if='$slots.menu')
    slot(name='menu')
</template>

<script lang="ts" setup>
defineOptions({ inheritAttrs: false })

defineEmits<{
  click: [event: Event]
}>()

const props = defineProps<{
  bottom?: number
  right?: number
}>()

const positionStyle = computed(() => ({
  bottom: props.bottom ? `${props.bottom}px` : undefined,
  right: props.right ? `${props.right}px` : undefined,
}))
</script>

<style scoped lang="scss">
.fnb-float-button {
  position: fixed;
  z-index: 100;

  &:hover .fnb-float-button__menu {
    opacity: 1;
    pointer-events: auto;
    transform: translateY(0);
  }
}

.fnb-float-button__main {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-surface) 92%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 50%;
  box-shadow: 0 8px 24px rgb(67 41 59 / 14%);
  backdrop-filter: blur(12px);
  cursor: pointer;
  font-size: 1.25rem;
  transition:
    color 150ms ease,
    background 150ms ease,
    transform 150ms ease;

  &:hover {
    color: #fff;
    background: var(--pf-pink);
    border-color: var(--pf-pink);
    transform: translateY(-2px);
  }
}

.fnb-float-button__menu {
  position: absolute;
  bottom: 100%;
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-bottom: 0.5rem;
  opacity: 0;
  pointer-events: none;
  transform: translateY(4px);
  transition: all 200ms ease-out;
}
</style>
