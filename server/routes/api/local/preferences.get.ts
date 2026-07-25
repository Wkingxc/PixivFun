import { useLocalPersistenceRepository } from '~~/server/persistence'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'cache-control', 'no-store')
  return {
    preferences: useLocalPersistenceRepository().getPreferences(),
  }
})
