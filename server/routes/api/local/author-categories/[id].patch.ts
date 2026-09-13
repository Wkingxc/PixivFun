import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const repository = useLocalPersistenceRepository()
  try {
    const body = await readBody<{ name?: unknown }>(event)
    repository.renameAuthorCategory(getRouterParam(event, 'id'), body?.name)
    return { categories: repository.getAuthorCategories() }
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof RangeError))
      throw error
    throw createError({
      statusCode: 400,
      message: error.message,
    })
  }
})
