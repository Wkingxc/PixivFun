import type { RouterConfig } from '@nuxt/schema'

export default {
  scrollBehavior(to, from, savedPosition) {
    if (to.path === from.path) {
      return false
    }
    if (savedPosition) {
      return savedPosition
    } else if (
      typeof history !== 'undefined' &&
      history.state?.preserveArtworkScroll === true
    ) {
      return false
    } else if (to.hash) {
      return {
        el: to.hash,
        behavior: 'auto',
      }
    } else {
      return {
        left: 0,
        top: 0,
        behavior: 'auto',
      }
    }
  },
} satisfies RouterConfig
