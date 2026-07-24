import {
  assertSameOrigin,
  clearPixivSession,
} from '~~/server/utils/pixiv-session'

export default defineEventHandler((event) => {
  assertSameOrigin(event)
  clearPixivSession(event)
  setResponseStatus(event, 204)
  return null
})
