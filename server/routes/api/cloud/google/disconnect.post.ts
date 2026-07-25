import { disconnectGoogleDrive } from '~~/server/cloud/google-connection'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  try {
    await disconnectGoogleDrive()
    return { connected: false }
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage:
        error instanceof Error
          ? error.message
          : 'Unable to disconnect Google Drive',
    })
  }
})
