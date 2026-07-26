<template lang="pug">
.artwork-layout-floating(
  :class='{ "is-stacked": markerButtonVisible && markerAvailable }'
  v-if='available && artworkLayoutButtonVisible'
)
  Transition(name='layout-panel')
    aside.artwork-layout-panel(aria-label='作品排列设置' v-if='open')
      .layout-panel-heading
        .heading-copy
          strong 作品排列
          small 设置会同步应用到支持的作品网格
        button(@click='open = false' aria-label='关闭作品排列设置' type='button')
          ITablerX(aria-hidden='true')

      label.layout-setting
        .setting-heading
          span 页面宽度
          output {{ normalizedWidth }}px
        input(
          :max='ARTWORK_LAYOUT_LIMITS.width.max',
          :min='ARTWORK_LAYOUT_LIMITS.width.min',
          :step='ARTWORK_LAYOUT_LIMITS.width.step'
          aria-label='作品列表页面宽度'
          type='range'
          v-model.number='width'
        )

      label.layout-setting
        .setting-heading
          span 每行列数
        .column-stepper
          button(
            :disabled='normalizedColumns <= ARTWORK_LAYOUT_LIMITS.columns.min'
            @click='changeColumns(-1)'
            aria-label='减少每行列数'
            type='button'
          )
            ITablerMinus(aria-hidden='true')
          output {{ normalizedColumns }} 列
          button(
            :disabled='normalizedColumns >= ARTWORK_LAYOUT_LIMITS.columns.max'
            @click='changeColumns(1)'
            aria-label='增加每行列数'
            type='button'
          )
            ITablerPlus(aria-hidden='true')

      .layout-setting
        .setting-heading
          span 图片清晰度
        .quality-options(aria-label='作品卡片图片清晰度')
          button(
            :class='{ active: normalizedImageQuality === option.value }',
            :key='option.value'
            @click='imageQuality = option.value'
            type='button'
            v-for='option in qualityOptions'
          ) {{ option.label }}
        small.setting-help 原图档会使用更多网络流量

      .layout-setting
        .setting-heading
          span 过滤页数
          output {{ minPageCountLabel }}
        .column-stepper.column-stepper--with-reset
          button(
            :disabled='normalizedMinPageCount <= ARTWORK_LAYOUT_LIMITS.minPageCount.min'
            @click='changeMinPageCount(-1)'
            aria-label='降低页数过滤门槛'
            type='button'
          )
            ITablerMinus(aria-hidden='true')
          input.stepper-input(
            :max='ARTWORK_LAYOUT_LIMITS.minPageCount.max',
            :min='ARTWORK_LAYOUT_LIMITS.minPageCount.min',
            :step='ARTWORK_LAYOUT_LIMITS.minPageCount.step'
            @blur='commitMinPageCount'
            @change='commitMinPageCount'
            @focus='selectStepperInput'
            @keyup.enter='commitMinPageCount'
            aria-label='页数过滤门槛'
            inputmode='numeric'
            type='number'
            v-model='minPageCountInput'
          )
          button(
            :disabled='normalizedMinPageCount >= ARTWORK_LAYOUT_LIMITS.minPageCount.max'
            @click='changeMinPageCount(1)'
            aria-label='提高页数过滤门槛'
            type='button'
          )
            ITablerPlus(aria-hidden='true')
          button.stepper-reset(
            :disabled='normalizedMinPageCount === ARTWORK_LAYOUT_LIMITS.minPageCount.min'
            @click='resetMinPageCount'
            aria-label='重置页数过滤'
            title='重置为 0'
            type='button'
          )
            ITablerRestore(aria-hidden='true')
        small.setting-help 只在右侧作者目录、相关作品和作者页生效，0 表示不过滤

  button.artwork-layout-trigger(
    :aria-expanded='open',
    :class='{ active: open }'
    @click='open = !open'
    aria-label='打开作品排列设置'
    title='作品排列'
    type='button'
  )
    ITablerLayoutGrid(aria-hidden='true')
    span 作品排列
</template>

<script lang="ts" setup>
import {
  IconLayoutGrid as ITablerLayoutGrid,
  IconMinus as ITablerMinus,
  IconPlus as ITablerPlus,
  IconRestore as ITablerRestore,
  IconX as ITablerX,
} from '@tabler/icons-vue'
import {
  ARTWORK_LAYOUT_DEFAULTS,
  ARTWORK_LAYOUT_LIMITS,
  normalizeArtworkLayoutValue,
} from '~/utils/artworkLayout'
import type { ArtworkCardImageQuality } from '~/utils/artworkLayout'

const route = useRoute()
const open = ref(false)
const { artworkLayoutButtonVisible, markerButtonVisible } =
  useFloatingControlsVisibility()
const {
  width,
  columns,
  imageQuality,
  minPageCount,
  normalizedWidth,
  normalizedColumns,
  normalizedImageQuality,
  normalizedMinPageCount,
} = useArtworkLayoutSettings()
const minPageCountLabel = computed(() =>
  normalizedMinPageCount.value > 0
    ? `仅 > ${normalizedMinPageCount.value} 页`
    : '不过滤'
)
const qualityOptions: {
  label: string
  value: ArtworkCardImageQuality
}[] = [
  { label: '小图', value: 'small' },
  { label: '高清', value: 'regular' },
  { label: '原图', value: 'original' },
]

function changeColumns(offset: number) {
  columns.value = Math.min(
    ARTWORK_LAYOUT_LIMITS.columns.max,
    Math.max(
      ARTWORK_LAYOUT_LIMITS.columns.min,
      normalizedColumns.value + offset
    )
  )
}

function clampMinPageCount(value: number): number {
  return normalizeArtworkLayoutValue(
    value,
    ARTWORK_LAYOUT_DEFAULTS.minPageCount,
    ARTWORK_LAYOUT_LIMITS.minPageCount
  )
}

function changeMinPageCount(offset: number) {
  minPageCount.value = clampMinPageCount(normalizedMinPageCount.value + offset)
}

function resetMinPageCount() {
  minPageCount.value = ARTWORK_LAYOUT_DEFAULTS.minPageCount
}

// v-model on a number input hands back a number, but an in-progress edit can
// still leave a raw string (or an empty field) here.
const minPageCountInput = ref<string | number>(normalizedMinPageCount.value)
watch(normalizedMinPageCount, (value) => {
  minPageCountInput.value = value
})

function selectStepperInput(event: FocusEvent) {
  ;(event.target as HTMLInputElement | null)?.select()
}

/**
 * Typed values are only applied once the field settles, so intermediate
 * keystrokes ("2" on the way to "25") never re-filter the lists. Out of range
 * or unparseable input snaps back to the clamped value.
 */
function commitMinPageCount() {
  const raw = String(minPageCountInput.value ?? '').trim()
  const parsed = Number(raw)
  // An emptied field means "I'm still editing", not "disable the filter".
  const next =
    raw && Number.isFinite(parsed)
      ? clampMinPageCount(parsed)
      : normalizedMinPageCount.value
  minPageCount.value = next
  minPageCountInput.value = next
}

const available = computed(() => {
  const path = route.path
  if (route.name === 'artworks') return true
  if (/^\/users\/[^/]+\/?$/.test(path)) return true
  if (path === '/following/latest') return true
  if (path === '/discovery/artworks') return true
  return path === '/search' && route.query.type !== 'novels'
})

const markerAvailable = computed(() => {
  const path = route.path
  return (
    route.name === 'artworks' ||
    path === '/following/latest' ||
    /^\/users\/[^/]+\/?$/.test(path)
  )
})

watch([available, artworkLayoutButtonVisible], ([isAvailable, isVisible]) => {
  if (!isAvailable || !isVisible) open.value = false
})
</script>

<style scoped lang="scss">
.artwork-layout-floating {
  position: fixed;
  z-index: 1250;
  top: 82px;
  left: 18px;

  &.is-stacked {
    top: 136px;
  }
}

.artwork-layout-trigger {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 15px;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 18%);
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 750;

  svg {
    width: 19px;
    height: 19px;
    color: var(--pf-pink);
  }

  &.active {
    color: #fff;
    background: var(--pf-pink);
    border-color: transparent;

    svg {
      color: #fff;
    }
  }

  &:focus-visible {
    outline: 2px solid var(--pf-pink);
    outline-offset: 3px;
  }
}

.artwork-layout-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: min(320px, calc(100vw - 36px));
  padding: 16px;
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-surface) 95%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  box-shadow: 0 16px 50px rgb(0 0 0 / 24%);
  backdrop-filter: blur(16px);
}

.layout-panel-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;

  .heading-copy {
    display: grid;
    gap: 3px;

    small {
      color: var(--pf-muted);
      font-size: 0.68rem;
      line-height: 1.45;
    }
  }

  button {
    display: grid;
    flex: none;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--pf-muted);
    background: transparent;
    border: 0;
    border-radius: 50%;
    cursor: pointer;
    place-items: center;

    &:hover {
      color: var(--pf-pink);
      background: var(--pf-soft-pink);
    }
  }
}

.layout-setting {
  display: grid;
  gap: 8px;
  padding: 11px 0;
  border-top: 1px solid var(--pf-line);
}

.setting-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.8rem;
  font-weight: 680;

  output {
    color: var(--pf-pink);
    font-size: 0.74rem;
    font-weight: 750;
  }
}

.layout-setting input[type='range'] {
  width: 100%;
  accent-color: var(--pf-pink);
}

.column-stepper {
  display: grid;
  grid-template-columns: 34px 64px 34px;
  align-items: center;
  gap: 7px;

  output {
    text-align: center;
  }

  button {
    display: grid;
    width: 34px;
    height: 32px;
    padding: 0;
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    border: 1px solid color-mix(in srgb, var(--pf-pink) 24%, var(--pf-line));
    border-radius: 9px;
    cursor: pointer;
    place-items: center;

    &:hover:not(:disabled) {
      color: #fff;
      background: var(--pf-pink);
      border-color: var(--pf-pink);
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  }
}

// Same 34/64/34 rhythm as the column stepper above, plus the reset slot, so
// the two settings line up instead of one stretching across the panel.
.column-stepper--with-reset {
  grid-template-columns: 34px 64px 34px 34px;
}

// Neutral next to the pink − / + pair: resetting is a different kind of action
// and shouldn't read as another step.
.column-stepper .stepper-reset {
  color: var(--pf-muted);
  background: var(--pf-bg);
  border-color: var(--pf-line);

  &:hover:not(:disabled) {
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    border-color: color-mix(in srgb, var(--pf-pink) 24%, var(--pf-line));
  }

  svg {
    width: 16px;
    height: 16px;
  }
}

.stepper-input {
  width: 100%;
  min-height: 32px;
  padding: 0 6px;
  color: var(--pf-text);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 9px;
  cursor: text;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  text-align: center;
  outline: 0;

  &:hover {
    border-color: color-mix(in srgb, var(--pf-pink) 34%, var(--pf-line));
  }

  &:focus {
    border-color: var(--pf-pink);
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-pink) 13%, transparent);
  }

  // The native spinners duplicate the − / + buttons and crowd the field.
  appearance: textfield;

  &::-webkit-outer-spin-button,
  &::-webkit-inner-spin-button {
    margin: 0;
    appearance: none;
  }
}

.quality-options {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;

  button {
    min-height: 34px;
    padding: 0 8px;
    color: var(--pf-muted);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
    border-radius: 9px;
    cursor: pointer;
    font: inherit;
    font-size: 0.74rem;
    font-weight: 700;

    &:hover {
      color: var(--pf-pink);
      background: var(--pf-soft-pink);
    }

    &.active {
      color: #fff;
      background: var(--pf-pink);
      border-color: var(--pf-pink);
    }
  }
}

.setting-help {
  color: var(--pf-muted);
  font-size: 0.66rem;
  line-height: 1.5;
}

.layout-panel-enter-active,
.layout-panel-leave-active {
  transition:
    opacity 160ms ease,
    transform 160ms ease;
}

.layout-panel-enter-from,
.layout-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 560px) {
  .artwork-layout-floating {
    top: 76px;
    left: 12px;

    &.is-stacked {
      top: 130px;
    }
  }

  .artwork-layout-trigger {
    min-height: 40px;
    padding: 0 12px;
  }
}
</style>
