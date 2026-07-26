<template lang="pug">
Teleport(to='body')
  button.page-settings-trigger(
    :aria-expanded='open'
    @click='open = true'
    title='打开页面设置'
    type='button'
    v-if='!open'
  )
    ITablerAdjustments(aria-hidden='true')
    span 页面设置

  aside.page-settings-panel(
    :aria-label='title',
    :style='panelStyle'
    ref='panelRef'
    role='dialog'
    v-else
  )
    header.page-settings-heading(
      :class='{ "is-dragging": dragging }'
      @pointerdown='startDrag'
    )
      .page-settings-title
        ITablerAdjustments(aria-hidden='true')
        strong {{ title }}
      button(
        @click='open = false'
        aria-label='关闭页面设置'
        title='关闭'
        type='button'
      )
        ITablerX(aria-hidden='true')
    .page-settings-content
      slot
</template>

<script lang="ts" setup>
import {
  IconAdjustmentsHorizontal as ITablerAdjustments,
  IconX as ITablerX,
} from '@tabler/icons-vue'

withDefaults(
  defineProps<{
    title?: string
  }>(),
  {
    title: '页面设置',
  }
)

const open = ref(false)
const panelRef = ref<HTMLElement | null>(null)
const position = ref<{ left: number; top: number } | null>(null)
const dragging = ref(false)
let dragOffsetX = 0
let dragOffsetY = 0

const panelStyle = computed(() =>
  position.value
    ? {
        left: `${position.value.left}px`,
        top: `${position.value.top}px`,
        right: 'auto',
        bottom: 'auto',
      }
    : undefined
)

function clampPosition(value: number, max: number) {
  return Math.min(Math.max(value, 8), Math.max(max, 8))
}

function moveDrag(event: PointerEvent) {
  const panel = panelRef.value
  if (!dragging.value || !panel) return

  const rect = panel.getBoundingClientRect()
  position.value = {
    left: clampPosition(
      event.clientX - dragOffsetX,
      window.innerWidth - rect.width - 8
    ),
    top: clampPosition(
      event.clientY - dragOffsetY,
      window.innerHeight - rect.height - 8
    ),
  }
}

function stopDrag() {
  dragging.value = false
  window.removeEventListener('pointermove', moveDrag)
  window.removeEventListener('pointerup', stopDrag)
}

function startDrag(event: PointerEvent) {
  if (
    event.button !== 0 ||
    (event.target as HTMLElement).closest('button') ||
    !panelRef.value
  ) {
    return
  }

  const rect = panelRef.value.getBoundingClientRect()
  dragOffsetX = event.clientX - rect.left
  dragOffsetY = event.clientY - rect.top
  dragging.value = true
  window.addEventListener('pointermove', moveDrag)
  window.addEventListener('pointerup', stopDrag)
}

onBeforeUnmount(stopDrag)
</script>

<style scoped lang="scss">
.page-settings-trigger,
.page-settings-panel {
  position: fixed;
  z-index: 1200;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  box-shadow: 0 10px 30px rgb(0 0 0 / 18%);
}

.page-settings-trigger {
  left: 18px;
  bottom: 74px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 42px;
  padding: 0 14px;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;

  svg {
    width: 18px;
    height: 18px;
    color: var(--pf-pink);
  }
}

.page-settings-panel {
  left: 18px;
  bottom: 18px;
  width: min(330px, calc(100vw - 24px));
  overflow: hidden;
  border-radius: 16px;
}

.page-settings-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--pf-line);
  cursor: grab;
  touch-action: none;
  user-select: none;

  &.is-dragging {
    cursor: grabbing;
  }
}

.page-settings-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;

  svg {
    width: 18px;
    height: 18px;
    color: var(--pf-pink);
  }
}

.page-settings-heading button {
  display: grid;
  width: 30px;
  height: 30px;
  padding: 0;
  color: var(--pf-muted);
  background: transparent;
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  place-items: center;

  &:hover {
    color: var(--pf-text);
    background: var(--pf-bg);
  }

  svg {
    width: 18px;
    height: 18px;
  }
}

.page-settings-content {
  padding: 14px;
}
</style>
