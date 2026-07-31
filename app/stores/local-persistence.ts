import { defineStore } from 'pinia'
import {
  cloneLocalPreferences,
  DEFAULT_LOCAL_PREFERENCES,
  mergeLocalPreferences,
  type LocalPreferences,
  type LocalPreferencesPatch,
} from '~~/shared/local-preferences'
import type { UserListItem } from '~/types'
import { toFeaturedAuthorSnapshot } from '~/utils/featuredAuthors'

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
  const featuredAuthorIds = reactive(new Set<string>())
  const checkedFeaturedAuthorIds = new Set<string>()
  const featuredAuthorRevisions = new Map<string, number>()
  const hiddenArtworkAuthorId = ref('')
  const hiddenAuthorArtworkIds = reactive(new Set<string>())
  const hiddenArtworkRevision = ref(0)
  let initialization: Promise<void> | undefined
  let hiddenArtworkLoad:
    { authorId: string; promise: Promise<void> } | undefined
  let hiddenArtworkLoadRequestId = 0
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

  async function ensureFeaturedAuthors(
    ids: Array<string | number>
  ): Promise<void> {
    const pending = Array.from(
      new Set(ids.map(String).filter((id) => /^\d+$/.test(id)))
    ).filter((id) => !checkedFeaturedAuthorIds.has(id))
    if (!pending.length) return
    pending.forEach((id) => checkedFeaturedAuthorIds.add(id))
    const revisions = new Map(
      pending.map((id) => [id, featuredAuthorRevisions.get(id) ?? 0])
    )
    try {
      const responses = await Promise.all(
        Array.from({ length: Math.ceil(pending.length / 500) }, (_, index) =>
          pending.slice(index * 500, index * 500 + 500)
        ).map((ids) =>
          $fetch<{ featuredIds: string[] }>(
            '/api/local/featured-authors/status',
            {
              method: 'POST',
              body: { ids },
            }
          )
        )
      )
      for (const response of responses) {
        response.featuredIds.forEach((id) => {
          if ((featuredAuthorRevisions.get(id) ?? 0) === revisions.get(id)) {
            featuredAuthorIds.add(id)
          }
        })
      }
    } catch (error) {
      pending.forEach((id) => checkedFeaturedAuthorIds.delete(id))
      throw error
    }
  }

  function isFeaturedAuthor(id: string | number | undefined): boolean {
    if (id === undefined) return false
    return featuredAuthorIds.has(String(id))
  }

  function rememberFeaturedAuthors(ids: Array<string | number>): void {
    ids
      .map(String)
      .filter((id) => /^\d+$/.test(id))
      .forEach((id) => {
        featuredAuthorRevisions.set(
          id,
          (featuredAuthorRevisions.get(id) ?? 0) + 1
        )
        checkedFeaturedAuthorIds.add(id)
        featuredAuthorIds.add(id)
      })
  }

  async function featureAuthor(author: UserListItem): Promise<void> {
    const snapshot = toFeaturedAuthorSnapshot(author)
    const authorId = String(snapshot.userId)
    featuredAuthorRevisions.set(
      authorId,
      (featuredAuthorRevisions.get(authorId) ?? 0) + 1
    )
    checkedFeaturedAuthorIds.add(authorId)
    featuredAuthorIds.add(authorId)
    try {
      await $fetch(`/api/local/featured-authors/${authorId}`, {
        method: 'PUT',
        body: { author: snapshot },
      })
    } catch (error) {
      featuredAuthorIds.delete(authorId)
      checkedFeaturedAuthorIds.delete(authorId)
      throw error
    }
  }

  async function unfeatureAuthor(id: string | number): Promise<void> {
    const authorId = String(id)
    featuredAuthorRevisions.set(
      authorId,
      (featuredAuthorRevisions.get(authorId) ?? 0) + 1
    )
    const wasFeatured = featuredAuthorIds.delete(authorId)
    checkedFeaturedAuthorIds.add(authorId)
    try {
      await $fetch(`/api/local/featured-authors/${authorId}`, {
        method: 'DELETE',
      })
    } catch (error) {
      if (wasFeatured) featuredAuthorIds.add(authorId)
      throw error
    }
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

  function applyHiddenAuthorArtworkIds(authorId: string, ids: string[]): void {
    hiddenArtworkAuthorId.value = authorId
    hiddenAuthorArtworkIds.clear()
    ids.forEach((id) => hiddenAuthorArtworkIds.add(id))
    hiddenArtworkRevision.value += 1
  }

  async function loadHiddenAuthorArtworks(
    authorIdValue: string | number,
    force = false
  ): Promise<void> {
    const authorId = String(authorIdValue)
    if (!force && hiddenArtworkAuthorId.value === authorId) return
    if (!force && hiddenArtworkLoad?.authorId === authorId) {
      return hiddenArtworkLoad.promise
    }

    const requestId = ++hiddenArtworkLoadRequestId
    const promise = $fetch<{ hiddenIds: string[] }>(
      `/api/local/authors/${authorId}/hidden-artworks`
    )
      .then((response) => {
        if (requestId === hiddenArtworkLoadRequestId) {
          applyHiddenAuthorArtworkIds(authorId, response.hiddenIds)
        }
      })
      .finally(() => {
        if (hiddenArtworkLoad?.promise === promise) {
          hiddenArtworkLoad = undefined
        }
      })
    hiddenArtworkLoad = { authorId, promise }
    return promise
  }

  function isAuthorArtworkHidden(
    authorIdValue: string | number,
    artworkIdValue: string | number
  ): boolean {
    return (
      hiddenArtworkAuthorId.value === String(authorIdValue) &&
      hiddenAuthorArtworkIds.has(String(artworkIdValue))
    )
  }

  async function hideAuthorArtworks(
    authorIdValue: string | number,
    artworkIds: Array<string | number>
  ): Promise<void> {
    const authorId = String(authorIdValue)
    hiddenArtworkLoadRequestId += 1
    hiddenArtworkLoad = undefined
    const response = await $fetch<{ hiddenIds: string[] }>(
      `/api/local/authors/${authorId}/hidden-artworks`,
      {
        method: 'POST',
        body: { artworkIds: artworkIds.map(String) },
      }
    )
    applyHiddenAuthorArtworkIds(authorId, response.hiddenIds)
  }

  async function restoreAuthorArtworks(
    authorIdValue: string | number,
    artworkIds: Array<string | number>
  ): Promise<void> {
    const authorId = String(authorIdValue)
    hiddenArtworkLoadRequestId += 1
    hiddenArtworkLoad = undefined
    const response = await $fetch<{ hiddenIds: string[] }>(
      `/api/local/authors/${authorId}/hidden-artworks`,
      {
        method: 'DELETE',
        body: { artworkIds: artworkIds.map(String) },
      }
    )
    applyHiddenAuthorArtworkIds(authorId, response.hiddenIds)
  }

  return {
    preferences,
    initialized,
    viewedMarker,
    visitedArtworkIds,
    visitedAuthorIds,
    featuredAuthorIds,
    hiddenArtworkAuthorId,
    hiddenAuthorArtworkIds,
    hiddenArtworkRevision,
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
    ensureFeaturedAuthors,
    isFeaturedAuthor,
    rememberFeaturedAuthors,
    featureAuthor,
    unfeatureAuthor,
    refreshCheckedArtworkVisits,
    refreshCheckedAuthorVisits,
    loadHiddenAuthorArtworks,
    isAuthorArtworkHidden,
    hideAuthorArtworks,
    restoreAuthorArtworks,
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
