import {
  resolveArtworkAccentTone,
  resolveArtworkPanelTone,
  type ArtworkAccentTone,
  type ArtworkPanelTone,
} from '~/utils/artworkDetailTuning'

const CARD_SIZE_KEY = 'pixivfun:artwork-directory-card-size'
const ARTWORK_MAX_HEIGHT_KEY = 'pixivfun:artwork-detail-max-height'
const CONTENT_WIDTH_KEY = 'pixivfun:artwork-detail-content-width'
const SIDEBAR_WIDTH_KEY = 'pixivfun:artwork-directory-sidebar-width'
const ACCENT_TONE_KEY = 'pixivfun:artwork-detail-accent-tone'
const PANEL_TONE_KEY = 'pixivfun:artwork-detail-panel-tone'

export const DEFAULT_ARTWORK_DIRECTORY_CARD_SIZE = 240
export const DEFAULT_ARTWORK_DETAIL_MAX_HEIGHT = 760
export const DEFAULT_ARTWORK_DETAIL_CONTENT_WIDTH = 740
export const DEFAULT_ARTWORK_DIRECTORY_SIDEBAR_WIDTH = 620

function clamp(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(Math.max(Math.round(value), min), max)
}

export function useArtworkDirectoryTuning() {
  const enabled = import.meta.dev
  const storedCardSize = useLocalStorage<number>(
    CARD_SIZE_KEY,
    DEFAULT_ARTWORK_DIRECTORY_CARD_SIZE
  )
  const storedArtworkMaxHeight = useLocalStorage<number>(
    ARTWORK_MAX_HEIGHT_KEY,
    DEFAULT_ARTWORK_DETAIL_MAX_HEIGHT
  )
  const storedContentWidth = useLocalStorage<number>(
    CONTENT_WIDTH_KEY,
    DEFAULT_ARTWORK_DETAIL_CONTENT_WIDTH
  )
  const storedSidebarWidth = useLocalStorage<number>(
    SIDEBAR_WIDTH_KEY,
    DEFAULT_ARTWORK_DIRECTORY_SIDEBAR_WIDTH
  )
  const storedAccentTone = useLocalStorage<string>(ACCENT_TONE_KEY, 'pink')
  const storedPanelTone = useLocalStorage<string>(PANEL_TONE_KEY, 'surface')

  const accentTone = computed<ArtworkAccentTone>({
    get: () => resolveArtworkAccentTone(enabled, storedAccentTone.value),
    set: (value) => {
      if (enabled) storedAccentTone.value = value
    },
  })

  const panelTone = computed<ArtworkPanelTone>({
    get: () => resolveArtworkPanelTone(enabled, storedPanelTone.value),
    set: (value) => {
      if (enabled) storedPanelTone.value = value
    },
  })

  const cardSize = computed({
    get: () =>
      enabled
        ? clamp(
            Number(storedCardSize.value),
            140,
            340,
            DEFAULT_ARTWORK_DIRECTORY_CARD_SIZE
          )
        : DEFAULT_ARTWORK_DIRECTORY_CARD_SIZE,
    set: (value: number) => {
      if (enabled) {
        storedCardSize.value = clamp(
          value,
          140,
          340,
          DEFAULT_ARTWORK_DIRECTORY_CARD_SIZE
        )
      }
    },
  })

  const artworkMaxHeight = computed({
    get: () =>
      enabled
        ? clamp(
            Number(storedArtworkMaxHeight.value),
            420,
            1800,
            DEFAULT_ARTWORK_DETAIL_MAX_HEIGHT
          )
        : DEFAULT_ARTWORK_DETAIL_MAX_HEIGHT,
    set: (value: number) => {
      if (enabled) {
        storedArtworkMaxHeight.value = clamp(
          value,
          420,
          1800,
          DEFAULT_ARTWORK_DETAIL_MAX_HEIGHT
        )
      }
    },
  })

  const sidebarWidth = computed({
    get: () =>
      enabled
        ? clamp(
            Number(storedSidebarWidth.value),
            420,
            800,
            DEFAULT_ARTWORK_DIRECTORY_SIDEBAR_WIDTH
          )
        : DEFAULT_ARTWORK_DIRECTORY_SIDEBAR_WIDTH,
    set: (value: number) => {
      if (enabled) {
        storedSidebarWidth.value = clamp(
          value,
          420,
          800,
          DEFAULT_ARTWORK_DIRECTORY_SIDEBAR_WIDTH
        )
      }
    },
  })

  const contentWidth = computed({
    get: () =>
      enabled
        ? clamp(
            Number(storedContentWidth.value),
            520,
            1200,
            DEFAULT_ARTWORK_DETAIL_CONTENT_WIDTH
          )
        : DEFAULT_ARTWORK_DETAIL_CONTENT_WIDTH,
    set: (value: number) => {
      if (enabled) {
        storedContentWidth.value = clamp(
          value,
          520,
          1200,
          DEFAULT_ARTWORK_DETAIL_CONTENT_WIDTH
        )
      }
    },
  })

  const style = computed(() => ({
    '--directory-card-size': `${cardSize.value}px`,
    '--directory-grid-height': `${cardSize.value * 3 + 20}px`,
    '--modern-artwork-max-height': `${artworkMaxHeight.value}px`,
    '--modern-content-width': `${contentWidth.value}px`,
    '--modern-sidebar-width': `${sidebarWidth.value}px`,
  }))

  function reset() {
    accentTone.value = 'pink'
    artworkMaxHeight.value = DEFAULT_ARTWORK_DETAIL_MAX_HEIGHT
    cardSize.value = DEFAULT_ARTWORK_DIRECTORY_CARD_SIZE
    contentWidth.value = DEFAULT_ARTWORK_DETAIL_CONTENT_WIDTH
    panelTone.value = 'surface'
    sidebarWidth.value = DEFAULT_ARTWORK_DIRECTORY_SIDEBAR_WIDTH
  }

  return {
    accentTone,
    artworkMaxHeight,
    cardSize,
    contentWidth,
    enabled,
    panelTone,
    reset,
    sidebarWidth,
    style,
  }
}
