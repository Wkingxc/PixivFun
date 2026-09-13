import { useLocalPersistenceRepository } from '~~/server/persistence'
import { createAuthorDirectoryCache } from '~~/server/utils/author-directory-cache'
import { getPixivSession } from '~~/server/utils/pixiv-session'
import { pixivFetch } from '~~/server/utils/pixiv'

const loadDirectory = createAuthorDirectoryCache()

export default defineEventHandler(async (event) => {
  const viewerId = String(getPixivSession(event)?.userData.id ?? '')
  if (!/^\d+$/.test(viewerId))
    throw createError({ statusCode: 401, statusMessage: 'Login required' })
  const authorId = getRouterParam(event, 'id') ?? ''
  if (!/^\d{1,20}$/.test(authorId))
    throw createError({ statusCode: 400, statusMessage: 'Invalid author ID' })
  setHeader(event, 'Cache-Control', 'no-store')
  return loadDirectory(
    useLocalPersistenceRepository(),
    viewerId,
    authorId,
    async () => {
      const { data, status } = await pixivFetch({
        event,
        url: `/ajax/user/${authorId}/profile/all`,
      })
      if (
        status !== 200 ||
        data?.error ||
        !data?.body ||
        !('illusts' in data.body) ||
        !('manga' in data.body)
      ) {
        throw createError({
          statusCode: 502,
          statusMessage: 'Author directory unavailable',
        })
      }
      return data.body
    }
  )
})
