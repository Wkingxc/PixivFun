import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const authorId = getRouterParam(event, 'id')
  const body = await readBody<{ artworkIds?: unknown }>(event)
  try {
    const repository = useLocalPersistenceRepository()
    repository.restoreAuthorArtworks(authorId, body?.artworkIds as unknown[])
    return {
      hiddenIds: repository.getHiddenAuthorArtworkIds(authorId),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid artwork IDs',
    })
  }
})
