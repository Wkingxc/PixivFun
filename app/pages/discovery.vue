<template lang="pug">
#discovery-view.modern-route-page
  .modern-page-shell(
    :style='activeKey === "artworks" ? artworkLayoutContainerStyle : undefined'
  )
    .discover-header
      h2
        FnbIcon: ITablerCompass
        |
        | 探索发现
      .discover-controls
        .tab-nav
          RouterLink.tab-item(
            :class='{ active: activeKey === t.key }',
            :key='t.key',
            :to='t.to'
            v-for='t in tabs'
          ) {{ t.label }}
        FnbSelect(
          :model-value='discoveryMode',
          :options='discoveryModeOptions'
          @update:model-value='changeMode'
          v-if='showModeSelect && userStore.isLoggedIn'
        )
        FnbButton(:loading='isLoading' @click='refresh' size='sm')
          template(#icon): IFasRandom
          | {{ isLoading ? '加载中' : '换一批' }}
    NuxtPage
</template>

<script lang="ts" setup>
import IFasRandom from '~icons/fa-solid/random'
import { IconCompass as ITablerCompass } from '@tabler/icons-vue'
import { useDiscoveryStore } from '~/stores/discovery'
import { useUserStore } from '~/stores/session'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import { setTitle } from '~/utils/setTitle'

definePageMeta({ name: 'discovery' })

const discoveryStore = useDiscoveryStore()
const userStore = useUserStore()
const route = useRoute()
const localPersistenceStore = useLocalPersistenceStore()
const { containerStyle: artworkLayoutContainerStyle } =
  useArtworkLayoutSettings()

const discoveryModeOptions = [
  { label: '混池', value: 'all' },
  { label: '全年龄', value: 'safe' },
  { label: 'R18', value: 'r18' },
]

const discoveryMode = ref(localPersistenceStore.preferences.discovery.mode)
discoveryStore.discoveryMode = discoveryMode.value

const tabs = [
  { key: 'artworks', label: '插画·漫画', to: '/discovery/artworks' },
  { key: 'novels', label: '小说', to: '/discovery/novels' },
  { key: 'users', label: '用户', to: '/discovery/users' },
]

const activeKey = computed(() => {
  if (route.path.startsWith('/discovery/novels')) return 'novels'
  if (route.path.startsWith('/discovery/users')) return 'users'
  return 'artworks'
})

const showModeSelect = computed(() => activeKey.value !== 'users')

const isLoading = computed(() => {
  if (activeKey.value === 'novels') return discoveryStore.loadingNovelDiscovery
  if (activeKey.value === 'users') return discoveryStore.loadingUserDiscovery
  return discoveryStore.loadingDiscovery
})

function refresh() {
  if (activeKey.value === 'novels') discoveryStore.fetchNovelDiscovery()
  else if (activeKey.value === 'users') discoveryStore.fetchUserDiscovery()
  else discoveryStore.fetchDiscovery()
}

function changeMode(mode: string) {
  discoveryMode.value = mode
  void localPersistenceStore
    .patchPreferences({
      discovery: { mode: mode as 'all' | 'safe' | 'r18' },
    })
    .catch(() => {})
  discoveryStore.discoveryMode = mode
  refresh()
}

onMounted(() => setTitle('探索发现'))
</script>

<style lang="scss" scoped>
#discovery-view {
  min-height: calc(100vh - 64px);
}

.discover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 1rem;
  margin-bottom: 1rem;

  h2 {
    font-family: inherit;
    font-weight: 780;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
  }
}

.discover-controls {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.tab-nav {
  display: flex;
  gap: 0.25rem;
}

.tab-item {
  padding: 0.3rem 1rem;
  border: 1px solid transparent;
  border-radius: 999px;
  font-weight: 700;
  color: var(--pf-muted);
  text-decoration: none;
  transition:
    color 150ms,
    background 150ms;

  &:hover {
    color: var(--pf-blue);
    background: var(--pf-soft-blue);
  }

  &.active {
    color: #fff;
    background: var(--pf-blue);
    border-color: var(--pf-blue);
  }
}
</style>
