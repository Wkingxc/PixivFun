import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'

export default defineEventHandler((event) => {
  assertSameOrigin(event)
  useLocalPersistenceRepository().removeAuthorMark(getRouterParam(event, 'id'))
  setResponseStatus(event, 204)
  return null
})
