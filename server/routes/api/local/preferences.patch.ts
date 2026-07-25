import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readBody(event)
  try {
    return {
      schemaVersion: 1,
      preferences: useLocalPersistenceRepository().updatePreferences(body),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid preferences',
    })
  }
})
