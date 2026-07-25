import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = getRouterParam(event, 'id')
  try {
    useLocalPersistenceRepository().recordArtworkVisit(id)
    setResponseStatus(event, 204)
    return null
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid artwork visit',
    })
  }
})
