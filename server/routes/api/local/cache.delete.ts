import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readBody<{ namespace?: unknown }>(event)
  if (body?.namespace !== undefined && typeof body.namespace !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'namespace must be a string',
    })
  }
  return {
    deleted: useLocalPersistenceRepository().clearCache(body?.namespace),
  }
})
