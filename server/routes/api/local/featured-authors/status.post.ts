import { useLocalPersistenceRepository } from '~~/server/persistence'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ ids?: unknown }>(event)
  if (!Array.isArray(body?.ids) || body.ids.length > 500) {
    throw createError({
      statusCode: 400,
      statusMessage: 'ids must be an array with at most 500 entries',
    })
  }
  try {
    return {
      featuredIds: useLocalPersistenceRepository().getFeaturedAuthorIds(
        body.ids
      ),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid author IDs',
    })
  }
})
