import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ state?: unknown }>(event)
  if (body?.state !== 'viewed' && body?.state !== 'unread') {
    throw createError({ statusCode: 400, statusMessage: 'Invalid state' })
  }
  try {
    return {
      status: useLocalPersistenceRepository().setArtworkState(id, body.state),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid artwork state',
    })
  }
})
