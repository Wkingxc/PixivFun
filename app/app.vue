<template lang="pug">
#app-full-container(
  :data-env='siteConfig.public.siteEnv',
  :data-route-name='route.name'
)
  SiteHeader

  main
    article
      NuxtPage

  SideNav
  BackToTop
  FnbDialog
  FnbToast
</template>

<script lang="ts" setup>
import SiteHeader from '~/components/SiteHeader.vue'

const SideNav = defineAsyncComponent(
  () => import('~/components/SideNav/SideNav.vue')
)

const route = useRoute()
const siteConfig = useRuntimeConfig()
</script>

<style scoped lang="scss">
#app-full-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

main {
  position: relative;
  flex: 1;

  article {
    padding-bottom: 3rem;
    z-index: 1;
  }
}
</style>
