<template lang="pug">
#discovery-artworks
  ArtworkList(
    :list='discoveryStore.discoveryList',
    :loading='discoveryStore.loadingDiscovery'
    controlled
  )
  .discover-footer(v-if='!discoveryStore.loadingDiscovery')
    .loading-more(
      v-if='userStore.isLoggedIn && discoveryStore.loadingMoreDiscovery'
    )
      FnbSkeleton(block height='2rem' width='200px')
    .login-prompt(
      v-else-if='!userStore.isLoggedIn && discoveryStore.discoveryList.length'
    )
      p 登录后解锁无限浏览
      FnbButton(
        size='sm'
        tag='RouterLink'
        to='/login?back=/discovery/artworks'
        variant='primary'
      )
        template(#icon): ITablerLogin
        | 登录
    div(ref='scrollSentinel' v-else-if='userStore.isLoggedIn')
</template>

<script lang="ts" setup>
import ArtworkList from '~/components/Artwork/ArtworkList.vue'
import { IconLogin as ITablerLogin } from '@tabler/icons-vue'
import { useDiscoveryStore } from '~/stores/discovery'
import { useUserStore } from '~/stores/session'

const discoveryStore = useDiscoveryStore()
const userStore = useUserStore()
const scrollSentinel = ref<HTMLElement | null>(null)

useIntersectionObserver(scrollSentinel, ([{ isIntersecting }]) => {
  if (isIntersecting && userStore.isLoggedIn) {
    discoveryStore.appendDiscovery()
  }
})

onMounted(() => {
  if (!discoveryStore.discoveryList.length) {
    discoveryStore.fetchDiscovery()
  }
})
</script>

<style lang="scss" scoped>
.discover-footer {
  margin-top: 2rem;
  text-align: center;

  .loading-more {
    display: flex;
    justify-content: center;
  }

  .login-prompt {
    padding: 2rem;
    color: var(--pf-muted);

    p {
      margin-bottom: 0.75rem;
      font-weight: 700;
    }
  }
}
</style>
