import type { Artwork, ArtworkInfo } from '~/types'

export type BookmarkEditorTarget = Artwork | ArtworkInfo

const useGlobalBookmarkEditor = createGlobalState(() => {
  const isOpen = ref(false)
  const target = shallowRef<BookmarkEditorTarget | null>(null)
  const revision = ref(0)

  function openBookmarkEditor(nextTarget: BookmarkEditorTarget) {
    target.value = nextTarget
    isOpen.value = true
  }

  function closeBookmarkEditor() {
    isOpen.value = false
  }

  function markBookmarkChanged() {
    revision.value += 1
  }

  return {
    isOpen,
    target,
    revision,
    openBookmarkEditor,
    closeBookmarkEditor,
    markBookmarkChanged,
  }
})

export function useBookmarkEditor() {
  return useGlobalBookmarkEditor()
}
