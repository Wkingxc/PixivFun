import { connectGoogleDrive } from '~~/server/cloud/google-connection'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  try {
    return await connectGoogleDrive()
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage:
        error instanceof Error
          ? error.message
          : 'Unable to start Google Drive authorization',
    })
  }
})
