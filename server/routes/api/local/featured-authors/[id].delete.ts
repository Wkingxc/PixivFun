import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler((event) => {
  assertSameOrigin(event)
  try {
    useLocalPersistenceRepository().removeFeaturedAuthor(
      getRouterParam(event, 'id')
    )
    setResponseStatus(event, 204)
    return null
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid author ID',
    })
  }
})
