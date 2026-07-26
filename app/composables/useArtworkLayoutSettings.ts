import type { CSSProperties } from 'vue'
import {
  ARTWORK_LAYOUT_DEFAULTS,
  ARTWORK_LAYOUT_LIMITS,
  getEffectiveArtworkColumns,
  normalizeArtworkLayoutValue,
  resolveArtworkCardImageQuality,
  type ArtworkCardImageQuality,
  type ArtworkLayoutViewport,
} from '~/utils/artworkLayout'

const useGlobalArtworkLayoutSettings = createGlobalState(() => {
  const width = useLocalStorage(
    'pixivfun:artwork-layout-width',
    ARTWORK_LAYOUT_DEFAULTS.width
  )
  const columns = useLocalStorage(
    'pixivfun:artwork-layout-columns',
    ARTWORK_LAYOUT_DEFAULTS.columns
  )
  const imageQuality = useLocalStorage<ArtworkCardImageQuality>(
    'pixivfun:artwork-layout-image-quality',
    ARTWORK_LAYOUT_DEFAULTS.imageQuality
  )

  const isCompact = useMediaQuery('(max-width: 560px)')
  const isTablet = useMediaQuery('(max-width: 820px)')
  const isNarrowDesktop = useMediaQuery('(max-width: 1180px)')

  const normalizedWidth = computed(() =>
    normalizeArtworkLayoutValue(
      width.value,
      ARTWORK_LAYOUT_DEFAULTS.width,
      ARTWORK_LAYOUT_LIMITS.width
    )
  )
  const normalizedColumns = computed(() =>
    normalizeArtworkLayoutValue(
      columns.value,
      ARTWORK_LAYOUT_DEFAULTS.columns,
      ARTWORK_LAYOUT_LIMITS.columns
    )
  )
  const normalizedImageQuality = computed(() =>
    resolveArtworkCardImageQuality(imageQuality.value)
  )

  const effectiveColumns = computed(() => {
    let viewport: ArtworkLayoutViewport = 'wide'
    if (isCompact.value) viewport = 'compact'
    else if (isTablet.value) viewport = 'tablet'
    else if (isNarrowDesktop.value) viewport = 'narrow'
    return getEffectiveArtworkColumns(normalizedColumns.value, viewport)
  })

  const containerStyle = computed<CSSProperties>(() => ({
    width: `min(${normalizedWidth.value}px, calc(100% - ${
      isCompact.value ? 24 : 48
    }px))`,
  }))

  const gridStyle = computed<CSSProperties>(() => {
    const activeColumns = effectiveColumns.value
    const gap = activeColumns <= 2 ? 12 : 14

    return {
      display: 'grid',
      gridTemplateColumns: `repeat(${activeColumns}, minmax(0, 1fr))`,
      gap: `16px ${gap}px`,
      width: '100%',
      marginRight: 'auto',
      marginLeft: 'auto',
    }
  })

  function reset() {
    width.value = ARTWORK_LAYOUT_DEFAULTS.width
    columns.value = ARTWORK_LAYOUT_DEFAULTS.columns
    imageQuality.value = ARTWORK_LAYOUT_DEFAULTS.imageQuality
  }

  return {
    width,
    columns,
    imageQuality,
    normalizedWidth,
    normalizedColumns,
    normalizedImageQuality,
    effectiveColumns,
    containerStyle,
    gridStyle,
    reset,
  }
})

export function useArtworkLayoutSettings() {
  return useGlobalArtworkLayoutSettings()
}
