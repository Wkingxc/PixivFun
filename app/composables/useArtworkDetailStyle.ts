import {
  ARTWORK_DETAIL_STYLE_KEY,
  resolveArtworkDetailStyle,
  type ArtworkDetailStyle,
} from '~/utils/artworkDetailStyle'

export function useArtworkDetailStyle() {
  const stored = useLocalStorage<string>(ARTWORK_DETAIL_STYLE_KEY, 'classic')
  const isDevelopment = import.meta.dev

  const style = computed<ArtworkDetailStyle>({
    get: () => resolveArtworkDetailStyle(isDevelopment, stored.value),
    set: (value) => {
      stored.value = isDevelopment ? value : 'classic'
    },
  })

  return { style, isDevelopment }
}
