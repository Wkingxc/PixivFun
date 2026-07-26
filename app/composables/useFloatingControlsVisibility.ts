const PAGE_SETTINGS_VISIBILITY_KEY = 'pixivfun:page-settings-visible'
const MARKER_BUTTON_VISIBILITY_KEY = 'pixivfun:marker-button-visible'
const ARTWORK_LAYOUT_VISIBILITY_KEY = 'pixivfun:artwork-layout-button-visible'

export function useFloatingControlsVisibility() {
  const pageSettingsVisible = useLocalStorage(
    PAGE_SETTINGS_VISIBILITY_KEY,
    false
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
    pageSettingsAvailable: import.meta.dev,
    pageSettingsVisible,
    markerButtonVisible,
    artworkLayoutButtonVisible,
  }
}
