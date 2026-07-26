<template lang="pug">
.card
  h2(:id='title' v-if='title') {{ title }}
  .inner
    slot
</template>

<script lang="ts" setup>
defineProps<{ title: string | undefined }>()
</script>

<style scoped lang="scss">
.inner {
  padding: 1rem;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  box-shadow: var(--pf-card-shadow);
}
</style>
