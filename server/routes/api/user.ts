import type { PixivUser } from '~~/app/types'
import { getPixivSession } from '~~/server/utils/pixiv-session'
import { normalizePixivUserImages } from '~~/server/utils/pixiv-user'

export default defineEventHandler((event) => {
  const session = getPixivSession(event)
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
  }

  setResponseHeader(event, 'cache-control', 'no-store')
  return {
    userData: normalizePixivUserImages(
      session.userData
    ) as unknown as PixivUser,
  }
})
