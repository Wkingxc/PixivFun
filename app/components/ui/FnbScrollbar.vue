<template lang="pug">
.fnb-scrollbar(:class='{ "fnb-scrollbar--x": xScrollable }')
  slot
</template>

<script lang="ts" setup>
defineProps<{
  xScrollable?: boolean
}>()
</script>

<style scoped lang="scss">
.fnb-scrollbar {
  overflow: auto;

  &--x {
    overflow-x: auto;
    overflow-y: hidden;
  }

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--pf-muted);
    border-radius: 999px;

    &:hover {
      background: var(--pf-text);
    }
  }
}
</style>
