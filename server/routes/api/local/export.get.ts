import { useLocalPersistenceRepository } from '~~/server/persistence'

export default defineEventHandler((event) => {
  setResponseHeader(
    event,
    'content-disposition',
    `attachment; filename="pixivfun-data-${new Date()
      .toISOString()
      .slice(0, 10)}.json"`
  )
  setResponseHeader(event, 'cache-control', 'no-store')
  return useLocalPersistenceRepository().exportData()
})
