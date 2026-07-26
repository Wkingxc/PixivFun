<template lang="pug">
Teleport(to='body')
  Transition(name='dialog')
    .fnb-dialog-overlay(@click.self='cancel' v-if='dialogState')
      .fnb-dialog
        button.fnb-dialog__close(@click='cancel' aria-label='关闭') ×
        .fnb-dialog__header {{ dialogState.title }}
        .fnb-dialog__body {{ dialogState.content }}
        .fnb-dialog__footer
          FnbButton(@click='cancel' v-if='dialogState.negativeText') {{ dialogState.negativeText }}
          FnbButton(@click='confirm' variant='primary') {{ dialogState.positiveText || '确定' }}
</template>

<script lang="ts" setup>
import { useDialogState } from '~/composables/useDialog'
import { useBodyScrollLock } from '~/composables/useBodyScrollLock'

const { dialogState, confirm, cancel } = useDialogState()

const isOpen = computed(() => !!dialogState.value)
useBodyScrollLock(isOpen)
</script>

<style scoped lang="scss">
.fnb-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgb(18 13 17 / 52%);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9000;
}

.fnb-dialog {
  padding: 1.5rem;
  width: 400px;
  max-width: 86vw;
  max-height: 80vh;
  overflow-y: auto;
  position: relative;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: 0 22px 70px rgb(0 0 0 / 28%);
}

.fnb-dialog__close {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  background: none;
  border: none;
  font-size: 1.5rem;
  font-weight: 900;
  line-height: 1;
  cursor: pointer;
  color: var(--pf-muted);
  padding: 0.25rem;

  &:hover {
    color: var(--pf-text);
  }
}

.fnb-dialog__header {
  font-family: inherit;
  font-weight: 780;
  font-size: 1.15rem;
  margin-bottom: 1rem;
  padding-right: 2rem;
}

.fnb-dialog__body {
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

.fnb-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.75rem;
}

:deep(.fnb-button) {
  min-height: 36px;
  padding: 0.45rem 0.95rem;
  color: var(--pf-text);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  box-shadow: none;
  transform: none;
  font-family: inherit;

  &.fnb-button--primary {
    color: #fff;
    background: var(--pf-blue);
    border-color: var(--pf-blue);
  }
}

.dialog-enter-active,
.dialog-leave-active {
  transition: opacity 200ms ease-out;

  .fnb-dialog {
    transition:
      transform 200ms ease-out,
      opacity 200ms ease-out;
  }
}

.dialog-enter-from {
  opacity: 0;

  .fnb-dialog {
    opacity: 0;
    transform: scale(0.9) translateY(10px);
  }
}

.dialog-leave-to {
  opacity: 0;

  .fnb-dialog {
    opacity: 0;
    transform: scale(0.95);
  }
}
</style>
