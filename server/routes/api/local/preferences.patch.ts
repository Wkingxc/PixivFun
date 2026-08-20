import { useLocalPersistenceRepository } from '~~/server/persistence'
import { assertSameOrigin } from '~~/server/utils/pixiv-session'
import { setRuntimeUpstreamProxy } from '~~/server/utils/system-proxy'

export default defineEventHandler(async (event) => {
  assertSameOrigin(event)
  const body = await readBody(event)
  try {
    const preferences = useLocalPersistenceRepository().updatePreferences(body)
    setRuntimeUpstreamProxy(preferences.networkProxy)
    return {
      preferences,
    }
  } catch (error) {
    throw createError({
      statusCode: 400,
      statusMessage:
        error instanceof Error ? error.message : 'Invalid preferences',
    })
  }
})
