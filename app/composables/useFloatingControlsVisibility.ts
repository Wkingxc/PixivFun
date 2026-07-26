import { PAGE_SETTINGS_CONFIG } from '../utils/pageSettings.ts'

const MARKER_BUTTON_VISIBILITY_KEY = 'pixivfun:marker-button-visible'
const ARTWORK_LAYOUT_VISIBILITY_KEY = 'pixivfun:artwork-layout-button-visible'

export function useFloatingControlsVisibility() {
  const pageSettingsVisible = useLocalStorage(
    PAGE_SETTINGS_CONFIG.visibilityStorageKey,
    PAGE_SETTINGS_CONFIG.visibleByDefault
  )
  const markerButtonVisible = useLocalStorage(
    MARKER_BUTTON_VISIBILITY_KEY,
    true
  )
  const artworkLayoutButtonVisible = useLocalStorage(
    ARTWORK_LAYOUT_VISIBILITY_KEY,
    true
  )

  return {
    pageSettingsAvailable: PAGE_SETTINGS_CONFIG.available,
    pageSettingsVisible,
    markerButtonVisible,
    artworkLayoutButtonVisible,
  }
}
