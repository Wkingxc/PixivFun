import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

const MAX_IMPORT_BYTES = 32 * 1024 * 1024

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const length = Number(getHeader(event, 'content-length') || 0)
  if (length > MAX_IMPORT_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Backup is too large' })
  }
  const body = await readBody(event)
  try {
    return {
      schemaVersion: 1,
      imported: useLocalPersistenceRepository().importData(body),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid PixivFun backup',
    })
  }
})
