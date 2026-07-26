import { defineStore } from 'pinia'
import {
  cloneLocalPreferences,
  DEFAULT_LOCAL_PREFERENCES,
  mergeLocalPreferences,
  type LocalPreferences,
  type LocalPreferencesPatch,
} from '~~/shared/local-preferences'

interface PreferencesResponse {
  preferences: LocalPreferences
}

export const useLocalPersistenceStore = defineStore('local-persistence', () => {
  const preferences = ref<LocalPreferences>(
    cloneLocalPreferences(DEFAULT_LOCAL_PREFERENCES)
  )
  const initialized = ref(false)
  const visitedArtworkIds = reactive(new Set<string>())
  const visitedAuthorIds = reactive(new Set<string>())
  const checkedArtworkIds = new Set<string>()
  const checkedAuthorIds = new Set<string>()
  let initialization: Promise<void> | undefined
  let preferenceRevision = 0
  let preferenceWriteQueue: Promise<void> = Promise.resolve()

  const viewedMarker = computed(() => preferences.value.viewedMarker)

  async function init(): Promise<void> {
    if (initialized.value) return
    if (initialization) return initialization
    initialization = $fetch<PreferencesResponse>('/api/local/preferences')
      .then((response) => {
        preferences.value = response.preferences
        initialized.value = true
      })
      .finally(() => {
        initialization = undefined
      })
    return initialization
  }

  function applyPreferencesPatch(patch: LocalPreferencesPatch): number {
    preferences.value = mergeLocalPreferences(preferences.value, patch)
    preferenceRevision += 1
    return preferenceRevision
  }

  function persistPreferences(): Promise<void> {
    const snapshot = cloneLocalPreferences(preferences.value)
    const operation = preferenceWriteQueue
      .catch(() => {})
      .then(async () => {
        await $fetch<PreferencesResponse>('/api/local/preferences', {
          method: 'PATCH',
          body: snapshot,
        })
      })
    preferenceWriteQueue = operation
    return operation
  }

  async function patchPreferences(patch: LocalPreferencesPatch): Promise<void> {
    const previous = preferences.value
    const revision = applyPreferencesPatch(patch)
    try {
      await persistPreferences()
    } catch (error) {
      if (revision === preferenceRevision) preferences.value = previous
      throw error
    }
  }

  async function migrateLegacyPreferences(): Promise<void> {
    if (!import.meta.client) return
    const patch: LocalPreferencesPatch = {}
    const keysToRemove: string[] = []

    try {
      const readerRaw = localStorage.getItem(
        'pixivfun:artwork-waterfall-reader'
      )
      if (readerRaw) {
        const reader = JSON.parse(readerRaw) as Record<string, unknown>
        const values: Record<string, unknown> = {}
        for (const key of [
          'columns',
          'imageQuality',
          'preloadOriginals',
          'doublePageMode',
          'layoutMode',
        ]) {
          if (reader[key] !== undefined) values[key] = reader[key]
        }
        if (Object.keys(values).length) {
          patch.artworkReader = values as LocalPreferencesPatch['artworkReader']
          keysToRemove.push('pixivfun:artwork-waterfall-reader')
        }
      }
    } catch {
      // Ignore a malformed reader value while still migrating other keys.
    }

    const discoveryTab = readLegacyString('pixivnow:discovery-tab')
    const discoveryMode = readLegacyString('pixivnow:discovery-mode')
    if (discoveryTab || discoveryMode) {
      patch.discovery = {
        ...(discoveryTab ? { tab: discoveryTab as 'all' | 'novel' } : {}),
        ...(discoveryMode
          ? { mode: discoveryMode as 'all' | 'safe' | 'r18' }
          : {}),
      }
      if (discoveryTab) keysToRemove.push('pixivnow:discovery-tab')
      if (discoveryMode) keysToRemove.push('pixivnow:discovery-mode')
    }

    const legacyTheme = readLegacyString('vueuse-color-scheme')
    if (legacyTheme && ['auto', 'light', 'dark'].includes(legacyTheme)) {
      patch.appearance = {
        theme: legacyTheme as 'auto' | 'light' | 'dark',
      }
      keysToRemove.push('vueuse-color-scheme')
    }

    if (!Object.keys(patch).length) return
    const response = await $fetch<{
      preferences: LocalPreferences
      imported: string[]
    }>('/api/local/preferences/migrate', {
      method: 'POST',
      body: { preferences: patch },
    })
    preferences.value = response.preferences
    for (const key of keysToRemove) localStorage.removeItem(key)
  }

  async function ensureArtworkVisits(
    ids: Array<string | number>
  ): Promise<void> {
    const pending = Array.from(
      new Set(ids.map(String).filter((id) => /^\d+$/.test(id)))
    ).filter((id) => !checkedArtworkIds.has(id))
    if (!pending.length) return
    pending.forEach((id) => checkedArtworkIds.add(id))
    try {
      const responses = await Promise.all(
        Array.from({ length: Math.ceil(pending.length / 500) }, (_, index) =>
          pending.slice(index * 500, index * 500 + 500)
        ).map((ids) =>
          $fetch<{ visitedIds: string[] }>('/api/local/artworks/status', {
            method: 'POST',
            body: { ids },
          })
        )
      )
      for (const response of responses) {
        response.visitedIds.forEach((id) => visitedArtworkIds.add(id))
      }
    } catch (error) {
      pending.forEach((id) => checkedArtworkIds.delete(id))
      throw error
    }
  }

  function isArtworkViewed(id: string | number | undefined): boolean {
    if (id === undefined) return false
    return visitedArtworkIds.has(String(id))
  }

  async function ensureAuthorVisits(
    ids: Array<string | number>
  ): Promise<void> {
    const pending = Array.from(
      new Set(ids.map(String).filter((id) => /^\d+$/.test(id)))
    ).filter((id) => !checkedAuthorIds.has(id))
    if (!pending.length) return
    pending.forEach((id) => checkedAuthorIds.add(id))
    try {
      const responses = await Promise.all(
        Array.from({ length: Math.ceil(pending.length / 500) }, (_, index) =>
          pending.slice(index * 500, index * 500 + 500)
        ).map((ids) =>
          $fetch<{ visitedIds: string[] }>('/api/local/authors/status', {
            method: 'POST',
            body: { ids },
          })
        )
      )
      for (const response of responses) {
        response.visitedIds.forEach((id) => visitedAuthorIds.add(id))
      }
    } catch (error) {
      pending.forEach((id) => checkedAuthorIds.delete(id))
      throw error
    }
  }

  function isAuthorViewed(id: string | number | undefined): boolean {
    if (id === undefined) return false
    return visitedAuthorIds.has(String(id))
  }

  async function recordArtworkVisit(id: string | number): Promise<void> {
    const artworkId = String(id)
    checkedArtworkIds.add(artworkId)
    visitedArtworkIds.add(artworkId)
    await $fetch(`/api/local/artworks/${artworkId}/visit`, { method: 'POST' })
  }

  async function recordAuthorVisit(id: string | number): Promise<void> {
    const authorId = String(id)
    checkedAuthorIds.add(authorId)
    visitedAuthorIds.add(authorId)
    await $fetch(`/api/local/authors/${authorId}/visit`, { method: 'POST' })
  }

  async function refreshCheckedArtworkVisits(): Promise<void> {
    const ids = Array.from(checkedArtworkIds)
    ids.forEach((id) => visitedArtworkIds.delete(id))
    checkedArtworkIds.clear()
    await ensureArtworkVisits(ids)
  }

  async function refreshCheckedAuthorVisits(): Promise<void> {
    const ids = Array.from(checkedAuthorIds)
    ids.forEach((id) => visitedAuthorIds.delete(id))
    checkedAuthorIds.clear()
    await ensureAuthorVisits(ids)
  }

  return {
    preferences,
    initialized,
    viewedMarker,
    visitedArtworkIds,
    visitedAuthorIds,
    init,
    applyPreferencesPatch,
    persistPreferences,
    patchPreferences,
    migrateLegacyPreferences,
    ensureArtworkVisits,
    ensureAuthorVisits,
    isArtworkViewed,
    isAuthorViewed,
    recordArtworkVisit,
    recordAuthorVisit,
    refreshCheckedArtworkVisits,
    refreshCheckedAuthorVisits,
  }
})

function readLegacyString(key: string): string {
  const value = localStorage.getItem(key)
  if (!value) return ''
  try {
    const parsed: unknown = JSON.parse(value)
    return typeof parsed === 'string' ? parsed : ''
  } catch {
    return value
  }
}
