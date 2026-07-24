import { useUserStore } from '~/stores/session'
import { clearLegacySessionCredentials } from '~/utils/sessionCredentials'

export default defineNuxtPlugin(async () => {
  clearLegacySessionCredentials({
    local: window.localStorage,
    session: window.sessionStorage,
  })

  const userStore = useUserStore()
  try {
    await userStore.initFromSession()
  } catch {
    userStore.logout()
  }
})
