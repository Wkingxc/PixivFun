<template lang="pug">
mixin content
  slot
    IFasListUl.svg--ListLink
  | {{ text }}

li
  RouterLink.plain(:to='link' v-if='link')
    +content
  a.plain(
    :href='downloadLink'
    @click='$emit("activate")'
    download
    v-else-if='downloadLink'
  )
    +content
  a.plain(:href='externalLink' target='_blank' v-else-if='externalLink')
    +content
  a.plain.not-allowed(v-else)
    +content
</template>

<script lang="ts" setup>
import IFasListUl from '~icons/fa-solid/list-ul'
defineProps<{
  text: string
  downloadLink?: string
  externalLink?: string
  link?: string
}>()
defineEmits<{ activate: [] }>()
</script>

<style scoped lang="scss">
li {
  a {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 38px;
    padding: 0 10px;
    color: var(--pf-text);
    border-radius: 8px;
    font-size: 0.94rem;
    font-weight: 500;
    text-decoration: none;
    transition:
      color 150ms ease,
      background 150ms ease;

    &:hover {
      color: var(--pf-blue);
      background: var(--pf-soft-blue);
    }

    &.not-allowed {
      cursor: not-allowed;
      text-decoration: line-through;
    }

    &.router-link-exact-active {
      color: var(--pf-blue);
      background: var(--pf-soft-pink);
      border-radius: 12px;
      font-weight: 650;
    }
  }
}

:slotted(svg) {
  width: 18px;
  height: 18px;
  flex: 0 0 auto;
}
</style>
