import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const authorId = getRouterParam(event, 'id')
  const body = await readBody<{ author?: unknown }>(event)
  try {
    useLocalPersistenceRepository().saveFeaturedAuthor(authorId, body?.author)
    setResponseStatus(event, 204)
    return null
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid author snapshot',
    })
  }
})
