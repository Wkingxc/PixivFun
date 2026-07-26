import { useLocalPersistenceStore } from '~/stores/local-persistence'

export function useAuthorViewedState(
  authorId: MaybeRefOrGetter<string | number | undefined>,
  disabled: MaybeRefOrGetter<boolean> = false
) {
  const store = useLocalPersistenceStore()
  const id = computed(() => toValue(authorId))
  const isViewed = computed(
    () => !toValue(disabled) && store.isAuthorViewed(id.value)
  )
  const markName = computed(
    () => isViewed.value && store.viewedMarker.markAuthorName
  )
  const authorStyle = computed(() => {
    if (!markName.value) return undefined
    const { r, g, b, a } = store.viewedMarker.authorVisitedColor
    return { color: `rgb(${r} ${g} ${b} / ${a})` }
  })

  watch(
    id,
    (value) => {
      if (value !== undefined && !toValue(disabled)) {
        void store.ensureAuthorVisits([value]).catch(() => {})
      }
    },
    { immediate: true }
  )

  return { authorStyle, isViewed, markName }
}
