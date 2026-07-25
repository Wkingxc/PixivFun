import { useLocalPersistenceStore } from '~/stores/local-persistence'

export function useArtworkViewedState(
  artworkId: MaybeRefOrGetter<string | number | undefined>,
  disabled: MaybeRefOrGetter<boolean> = false
) {
  const store = useLocalPersistenceStore()
  const id = computed(() => toValue(artworkId))
  const isViewed = computed(
    () => !toValue(disabled) && store.isArtworkViewed(id.value)
  )
  const markTitle = computed(
    () => isViewed.value && store.viewedMarker.markArtworkTitle
  )
  const titleStyle = computed(() => {
    if (!markTitle.value) return undefined
    const { r, g, b, a } = store.viewedMarker.artworkVisitedColor
    return { color: `rgb(${r} ${g} ${b} / ${a})` }
  })

  watch(
    id,
    (value) => {
      if (value !== undefined && !toValue(disabled)) {
        void store.ensureArtworkStatuses([value]).catch(() => {})
      }
    },
    { immediate: true }
  )

  return { isViewed, markTitle, titleStyle }
}
