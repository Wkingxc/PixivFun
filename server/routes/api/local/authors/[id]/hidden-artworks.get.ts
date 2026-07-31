import { useLocalPersistenceRepository } from '~~/server/persistence'

export default defineEventHandler((event) => {
  const authorId = getRouterParam(event, 'id')
  try {
    return {
      hiddenIds:
        useLocalPersistenceRepository().getHiddenAuthorArtworkIds(authorId),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid author ID',
    })
  }
})
