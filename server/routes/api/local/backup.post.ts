import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'
import { MAX_BACKUP_BYTES, summarizeLocalBackup } from '~~/shared/local-backup'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  setResponseHeader(event, 'cache-control', 'no-store')
  const length = Number(getHeader(event, 'content-length') || 0)
  if (length > MAX_BACKUP_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'Backup is too large' })
  const raw = await readRawBody(event, 'utf8')
  if (!raw || Buffer.byteLength(raw, 'utf8') > MAX_BACKUP_BYTES)
    throw createError({
      statusCode: 413,
      statusMessage: 'Backup is empty or too large',
    })
  try {
    const body = JSON.parse(raw)
    if (typeof body.restorePreferences !== 'boolean')
      throw new TypeError('恢复选项无效')
    const repository = useLocalPersistenceRepository()
    const imported = repository.importLocalBackup(
      body.backup,
      body.restorePreferences
    )
    return {
      imported,
      summary: summarizeLocalBackup(repository.exportLocalBackup()),
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid backup',
      message: error instanceof Error ? error.message : '备份无效',
    })
  }
})
