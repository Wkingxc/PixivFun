<template lang="pug">
Teleport(to='body')
  TransitionGroup.fnb-toast-container(name='toast' tag='div')
    .fnb-toast(
      :class='`fnb-toast--${toast.type}`',
      :key='toast.id'
      v-for='toast in toasts'
    ) {{ toast.message }}
</template>

<script lang="ts" setup>
import { useToastState } from '~/composables/useToast'

const { toasts } = useToastState()
</script>

<style scoped lang="scss">
.fnb-toast-container {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10000;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  pointer-events: none;
}

.fnb-toast {
  padding: 0.75rem 1.5rem;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  box-shadow: 0 12px 34px rgb(30 19 26 / 18%);
  font-weight: 680;
  pointer-events: auto;
  max-width: 80vw;

  &--info {
    background: var(--pf-surface);
  }

  &--success {
    color: #16864c;
    background: color-mix(in srgb, #36d879 14%, var(--pf-surface));
    border-color: color-mix(in srgb, #36d879 48%, var(--pf-line));
  }

  &--warning {
    color: #9a6900;
    background: color-mix(in srgb, #ffc849 18%, var(--pf-surface));
    border-color: color-mix(in srgb, #ffc849 52%, var(--pf-line));
  }

  &--error {
    color: #d74755;
    background: color-mix(in srgb, #ed5a68 13%, var(--pf-surface));
    border-color: color-mix(in srgb, #ed5a68 48%, var(--pf-line));
  }
}

.toast-enter-active,
.toast-leave-active {
  transition:
    transform 250ms ease-out,
    opacity 250ms ease-out;
}

.toast-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
