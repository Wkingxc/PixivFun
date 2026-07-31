import { useLocalPersistenceRepository } from '~~/server/persistence'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const page = Number(query.page ?? 1)
  const limit = Number(query.limit ?? 24)
  try {
    if (!Number.isInteger(page) || page < 1) {
      throw new RangeError('page must be a positive integer')
    }
    return useLocalPersistenceRepository().getFeaturedAuthors(
      (page - 1) * limit,
      limit
    )
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid pagination',
    })
  }
})
