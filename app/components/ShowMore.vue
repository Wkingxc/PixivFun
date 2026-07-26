<template lang="pug">
.show-more(ref='elRef')
  a(@click='method')
    | {{ text }}
    | &nbsp;
    IFasPlus(v-if='!loading')
    IFasSpinner.spin(v-else)
</template>

<script lang="ts" setup>
import IFasPlus from '~icons/fa-solid/plus'
import IFasSpinner from '~icons/fa-solid/spinner'

const elRef = ref<HTMLDivElement | null>(null)

const props = defineProps<{
  text: string
  method: () => any | Promise<any>
  loading: boolean
}>()

useIntersectionObserver(elRef, async ([{ isIntersecting }]) => {
  if (isIntersecting) {
    await nextTick()
    props.method()
  }
})
</script>

<style scoped lang="scss">
.show-more {
  text-align: center;

  a {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    min-height: 38px;
    margin: 1rem auto;
    padding: 0.45rem 1.2rem;
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    border: 1px solid color-mix(in srgb, var(--pf-pink) 36%, var(--pf-line));
    border-radius: 999px;
    box-shadow: none;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;

    &:hover {
      color: #fff;
      background: var(--pf-pink);
    }
  }
}
</style>
