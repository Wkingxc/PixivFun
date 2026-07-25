import { useLocalPersistenceRepository } from '~~/server/persistence'

export default defineEventHandler((event) => {
  try {
    return {
      mark: useLocalPersistenceRepository().getAuthorMark(
        getRouterParam(event, 'id')
      ),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid author ID',
    })
  }
})
