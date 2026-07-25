import { useLocalPersistenceStore } from '~/stores/local-persistence'

export default defineNuxtPlugin(async () => {
  const store = useLocalPersistenceStore()
  try {
    await store.init()
    await store.migrateLegacyPreferences()
    useColorMode().value = store.preferences.appearance.theme
  } catch (error) {
    console.warn('[local-persistence] failed to initialize', error)
  }
})
