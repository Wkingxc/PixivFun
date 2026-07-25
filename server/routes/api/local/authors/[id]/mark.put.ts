import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readBody<{ markType?: unknown; note?: unknown }>(event)
  try {
    useLocalPersistenceRepository().setAuthorMark(
      getRouterParam(event, 'id'),
      String(body?.markType || ''),
      body?.note === null || typeof body?.note === 'string' ? body.note : null
    )
    setResponseStatus(event, 204)
    return null
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid author mark',
    })
  }
})
