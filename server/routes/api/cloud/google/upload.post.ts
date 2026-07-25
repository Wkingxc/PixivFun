import { useGoogleDriveSyncService } from '~~/server/cloud/google-drive-service'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  try {
    return await useGoogleDriveSyncService().upload()
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage:
        error instanceof Error ? error.message : 'Google Drive upload failed',
    })
  }
})
