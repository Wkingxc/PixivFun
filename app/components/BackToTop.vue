<template lang="pug">
Transition(name='back-to-top')
  button.back-to-top(
    @click='scrollToTop'
    aria-label='回到顶部'
    title='回到顶部'
    v-show='visible'
  )
    ITablerArrowUp
</template>

<script lang="ts" setup>
import { IconArrowUp as ITablerArrowUp } from '@tabler/icons-vue'

const visible = ref(false)

function onScroll() {
  visible.value = window.scrollY > 400
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }))
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll))
</script>

<style scoped lang="scss">
.back-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  width: 2.5rem;
  height: 2.5rem;
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
  font-size: 1.2rem;
  transition: all 150ms;

  &:hover {
    color: #fff;
    background: var(--pf-pink);
    border-color: var(--pf-pink);
    transform: translateY(-2px);
    box-shadow: 0 10px 26px color-mix(in srgb, var(--pf-pink) 24%, transparent);
  }
}

.back-to-top-enter-active,
.back-to-top-leave-active {
  transition:
    opacity 0.2s,
    transform 0.2s;
}

.back-to-top-enter-from,
.back-to-top-leave-to {
  opacity: 0;
  transform: translateY(1rem);
}
</style>
