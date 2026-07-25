<template lang="pug">
.artwork-marker-floating
  Transition(name='marker-panel')
    aside.artwork-marker-panel(aria-label='已访问作品标记设置' v-if='open')
      .marker-panel-heading
        strong 标记设置
        button(@click='open = false' aria-label='关闭标记设置' type='button')
          ITablerX(aria-hidden='true')

      label.marker-setting
        span 遮罩颜色
        input(
          :value='colorHex'
          @change='changeColor'
          aria-label='已访问作品遮罩颜色'
          type='color'
        )

      label.marker-setting
        span 标题变色
        input(
          :checked='marker.markArtworkTitle'
          @change='changeBoolean("markArtworkTitle", $event)'
          type='checkbox'
        )

      label.marker-setting
        span 图片遮罩
        input(
          :checked='marker.markArtworkImage'
          @change='changeBoolean("markArtworkImage", $event)'
          type='checkbox'
        )

      label.marker-setting.marker-setting--range
        span 透明度
        input(
          :value='marker.artworkImageOverlayOpacity'
          @input='changeOpacity'
          aria-label='图片遮罩透明度'
          max='1'
          min='0.1'
          step='0.01'
          type='range'
        )
        output {{ Math.round(marker.artworkImageOverlayOpacity * 100) }}%

      label.marker-setting
        span
          | 隐藏已访问
          small 暂未启用
        input(
          :checked='marker.hideViewedArtwork'
          @change='changeBoolean("hideViewedArtwork", $event)'
          type='checkbox'
        )

  button.artwork-marker-trigger(
    :aria-expanded='open',
    :class='{ active: open }'
    @click='open = !open'
    aria-label='打开标记设置'
    title='标记设置'
    type='button'
  )
    ITablerColorSwatch(aria-hidden='true')
    span 标记
</template>

<script lang="ts" setup>
import {
  IconColorSwatch as ITablerColorSwatch,
  IconX as ITablerX,
} from '@tabler/icons-vue'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import type { LocalPreferences } from '~~/shared/local-preferences'

const store = useLocalPersistenceStore()
const open = ref(false)
let persistTimer: ReturnType<typeof setTimeout> | undefined
const marker = computed(() => store.viewedMarker)
const colorHex = computed(() => {
  const { r, g, b } = marker.value.artworkVisitedColor
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('')}`
})

type MarkerBooleanKey = {
  [
    Key in keyof LocalPreferences['viewedMarker']
  ]: LocalPreferences['viewedMarker'][Key] extends boolean ? Key : never
}[keyof LocalPreferences['viewedMarker']]

function persistMarker() {
  if (persistTimer) clearTimeout(persistTimer)
  persistTimer = undefined
  void store.persistPreferences().catch(() => {})
}

function patchMarker(
  patch: Partial<LocalPreferences['viewedMarker']>,
  debounce = false
) {
  store.applyPreferencesPatch({ viewedMarker: patch })
  if (persistTimer) clearTimeout(persistTimer)
  if (debounce) {
    persistTimer = setTimeout(persistMarker, 120)
    return
  }
  persistMarker()
}

function changeBoolean(key: MarkerBooleanKey, event: Event) {
  patchMarker({ [key]: (event.target as HTMLInputElement).checked })
}

function changeColor(event: Event) {
  const value = (event.target as HTMLInputElement).value
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value)
  if (!match) return
  patchMarker({
    artworkVisitedColor: {
      r: Number.parseInt(match[1]!, 16),
      g: Number.parseInt(match[2]!, 16),
      b: Number.parseInt(match[3]!, 16),
      a: marker.value.artworkVisitedColor.a,
    },
  })
}

function changeOpacity(event: Event) {
  patchMarker(
    {
      artworkImageOverlayOpacity: Number(
        (event.target as HTMLInputElement).value
      ),
    },
    true
  )
}

onBeforeUnmount(() => {
  if (persistTimer) persistMarker()
})
</script>

<style scoped lang="scss">
.artwork-marker-floating {
  position: fixed;
  z-index: 1250;
  top: 82px;
  left: 18px;
}

.artwork-marker-trigger {
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

.artwork-marker-panel {
  position: absolute;
  top: calc(100% + 10px);
  left: 0;
  width: min(310px, calc(100vw - 36px));
  padding: 14px;
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-surface) 95%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  box-shadow: 0 16px 50px rgb(0 0 0 / 24%);
  backdrop-filter: blur(16px);
}

.marker-panel-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;

  button {
    display: grid;
    width: 28px;
    height: 28px;
    padding: 0;
    color: var(--pf-muted);
    background: transparent;
    border: 0;
    border-radius: 8px;
    cursor: pointer;
    place-items: center;
  }
}

.marker-setting {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  min-height: 38px;
  font-size: 0.76rem;
  font-weight: 700;

  span {
    display: grid;
  }

  small {
    color: var(--pf-muted);
    font-size: 0.65rem;
    font-weight: 500;
  }

  input[type='color'] {
    width: 42px;
    height: 28px;
    padding: 2px;
    border: 1px solid var(--pf-line);
    border-radius: 8px;
    background: var(--pf-bg);
    cursor: pointer;
  }

  input[type='checkbox'] {
    width: 17px;
    height: 17px;
    accent-color: var(--pf-pink);
  }

  &--range {
    grid-template-columns: 72px minmax(0, 1fr) 38px;

    input {
      accent-color: var(--pf-pink);
    }

    output {
      color: var(--pf-muted);
      text-align: right;
    }
  }
}

.marker-panel-enter-active,
.marker-panel-leave-active {
  transition:
    opacity 150ms ease,
    transform 150ms ease;
}

.marker-panel-enter-from,
.marker-panel-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 760px) {
  .artwork-marker-floating {
    top: 70px;
    left: 10px;
  }
}
</style>
