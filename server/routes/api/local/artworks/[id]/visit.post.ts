import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const id = getRouterParam(event, 'id')
  const body = await readBody<{
    lastPage?: unknown
    pageCount?: unknown
  }>(event)
  try {
    return {
      status: useLocalPersistenceRepository().recordArtworkVisit(id, {
        lastPage:
          typeof body?.lastPage === 'number' ? body.lastPage : undefined,
        pageCount:
          typeof body?.pageCount === 'number' ? body.pageCount : undefined,
      }),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid artwork visit',
    })
  }
})
