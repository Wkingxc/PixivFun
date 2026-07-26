<template lang="pug">
#home-view
  section.hero-section(:style='heroStyle' aria-labelledby='home-hero-title')
    .hero-overlay
    .hero-content
      h1#home-hero-title.hero-logo
        img(:src='logoUrl' alt='PixivFun')
      p.hero-subtitle Let's enjoy Pixiv Fun!

      SearchBox.big.hero-search(placeholder='搜索关键词，或输入 id:作品编号')

      nav.quick-links(aria-label='主页快捷入口')
        FnbTag(@click='$router.push("/search")' clickable)
          ITablerSearch(aria-hidden='true')
          | 搜索页
        FnbTag(@click='$router.push("/ranking")' clickable)
          ITablerChartBar(aria-hidden='true')
          | 排行榜
        FnbTag(@click='scrollToDiscovery' clickable)
          ITablerCompass(aria-hidden='true')
          | 探索
        FnbTag(@click='openNovelDiscovery' clickable)
          ITablerBook(aria-hidden='true')
          | 小说

    .hero-utilities
      button(
        @click='homeStore.fetchRandomBg()'
        aria-label='更换背景作品'
        title='更换背景作品'
      )
        ITablerShuffle(aria-hidden='true')
      button(
        @click='isShowBgInfo = true'
        aria-label='查看背景作品信息'
        title='查看背景作品信息'
        v-if='randomBg?.id'
      )
        ITablerInfoCircle(aria-hidden='true')

  .fnb-dialog-overlay(@click.self='isShowBgInfo = false' v-if='isShowBgInfo')
    .fnb-dialog-card(
      aria-labelledby='background-dialog-title'
      aria-modal='true'
      role='dialog'
    )
      button.fnb-dialog-card__close(
        @click='isShowBgInfo = false'
        aria-label='关闭'
      )
        ITablerX(aria-hidden='true')
      #background-dialog-title.fnb-dialog-card__header {{ `背景作品：${randomBg?.alt || randomBg?.title}` }}
      .fnb-dialog-card__body
        .bg-info-modal
          RouterLink.thumb(:to='`/artworks/${randomBg?.id}`')
            img(:alt='randomBg?.alt', :src='randomBgRegularUrl')
          .desc
            RouterLink(:to='`/users/${randomBg?.userId}`') @{{ randomBg?.userName }}
            span 的作品（ID: {{ randomBg?.id }}）
          .tag-list
            FnbTag(
              :key='tag'
              @click='$router.push({ path: "/search", query: { q: tag } })'
              clickable
              v-for='tag in randomBg?.tags'
            ) {{ tag }}

  main.home-main
    UserStatusCard(v-if='!userStore.isLoggedIn')

    .overview-grid
      RankingCarousel(
        :artworks='homeStore.rankingList'
        v-if='homeStore.rankingList.length'
      )
      .featured-skeleton(v-else)
        FnbSkeleton(block height='360px')

      DailyRankingPanel(
        :artworks='homeStore.rankingList',
        :loading='homeStore.loadingRanking'
      )

    section.discover(aria-labelledby='discovery-title' ref='discoverRef')
      .discover-header
        h2#discovery-title.plain
          ITablerSparkles(aria-hidden='true')
          | 探索发现
        .discover-controls
          DiscoveryTabs(
            :model-value='discoveryTab'
            @update:model-value='changeDiscoveryTab'
          )
          FnbSelect(
            :model-value='discoveryMode',
            :options='discoveryModeOptions'
            @update:model-value='changeDiscoveryMode'
            v-if='userStore.isLoggedIn'
          )
          FnbButton(
            :loading='isDiscoveryLoading'
            @click='refreshDiscovery'
            size='sm'
          )
            template(#icon)
              ITablerRefresh(aria-hidden='true')
            | {{ isDiscoveryLoading ? '加载中' : '换一批' }}

      ArtworkList(
        :image-zoom='true',
        :list='displayedDiscoveryList',
        :loading='isDiscoveryLoading ? discoveryArtworkLimit : false'
        v-if='discoveryTab !== "novel"'
      )
      NovelList(
        :list='displayedNovelDiscoveryList',
        :loading='isDiscoveryLoading ? discoveryNovelLimit : false'
        v-else
      )

  SiteFooter(compact)
</template>

<script lang="ts" setup>
import ArtworkList from '~/components/Artwork/ArtworkList.vue'
import NovelList from '~/components/Novel/NovelList.vue'
import SearchBox from '~/components/SearchBox.vue'
import RankingCarousel from '~/components/RankingCarousel.vue'
import DailyRankingPanel from '~/components/DailyRankingPanel.vue'
import UserStatusCard from '~/components/UserStatusCard.vue'
import DiscoveryTabs from '~/components/DiscoveryTabs.vue'
import logoUrl from '~/assets/PixivFun.png'
import {
  IconBook as ITablerBook,
  IconChartBar as ITablerChartBar,
  IconCompass as ITablerCompass,
  IconInfoCircle as ITablerInfoCircle,
  IconRefresh as ITablerRefresh,
  IconSearch as ITablerSearch,
  IconArrowsShuffle as ITablerShuffle,
  IconSparkles as ITablerSparkles,
  IconX as ITablerX,
} from '@tabler/icons-vue'
import { useHomeStore } from '~/stores/home'
import { useDiscoveryStore } from '~/stores/discovery'
import { useUserStore } from '~/stores/session'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import { toRegularUrl } from '~/utils/pximg'
import { setTitle } from '~/utils/setTitle'

definePageMeta({ name: 'home' })

useHead({
  bodyAttrs: { 'data-route': 'home' },
})

const isShowBgInfo = ref(false)
useBodyScrollLock(isShowBgInfo)

const homeStore = useHomeStore()
const discoveryStore = useDiscoveryStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const localPersistenceStore = useLocalPersistenceStore()
const discoverRef = ref<HTMLElement | null>(null)

const randomBg = computed(() => homeStore.randomBg)
const randomBgRegularUrl = computed(() => {
  const background = randomBg.value
  return background?.url ? toRegularUrl(background.url) : ''
})
const heroStyle = computed(() =>
  randomBgRegularUrl.value
    ? { backgroundImage: `url("${randomBgRegularUrl.value}")` }
    : undefined
)

const discoveryModeOptions = [
  { label: '混池', value: 'all' },
  { label: '全年龄', value: 'safe' },
  { label: 'R18', value: 'r18' },
]

const discoveryTab = ref(
  (route.query.tab as string) || localPersistenceStore.preferences.discovery.tab
)
const discoveryMode = ref(
  (route.query.mode as string) ||
    localPersistenceStore.preferences.discovery.mode
)

discoveryStore.discoveryMode = discoveryMode.value

const isDiscoveryLoading = computed(() =>
  discoveryTab.value === 'novel'
    ? discoveryStore.loadingNovelDiscovery
    : discoveryStore.loadingDiscovery
)

const isPhoneDiscovery = useMediaQuery('(max-width: 560px)')
const isTabletDiscovery = useMediaQuery('(max-width: 820px)')
const isCompactDiscovery = useMediaQuery('(max-width: 1180px)')
const discoveryArtworkLimit = computed(() => {
  if (isPhoneDiscovery.value) return 4
  if (isTabletDiscovery.value) return 6
  if (isCompactDiscovery.value) return 8
  return 10
})
const discoveryNovelLimit = computed(() => {
  if (isPhoneDiscovery.value) return 2
  if (isTabletDiscovery.value) return 4
  return 6
})
const displayedDiscoveryList = computed(() =>
  discoveryStore.discoveryList.slice(0, discoveryArtworkLimit.value)
)
const displayedNovelDiscoveryList = computed(() =>
  discoveryStore.novelDiscoveryList.slice(0, discoveryNovelLimit.value)
)

function syncDiscoveryQuery() {
  const query = { ...route.query } as Record<string, string>
  if (discoveryTab.value !== 'all') query.tab = discoveryTab.value
  else delete query.tab
  if (discoveryMode.value !== 'all') query.mode = discoveryMode.value
  else delete query.mode
  router.replace({ query })
}

function changeDiscoveryTab(tab: string) {
  discoveryTab.value = tab
  void localPersistenceStore
    .patchPreferences({
      discovery: {
        tab: tab as 'all' | 'novel',
      },
    })
    .catch(() => {})
  syncDiscoveryQuery()
  if (tab === 'novel' && !discoveryStore.novelDiscoveryList.length) {
    discoveryStore.fetchNovelDiscovery()
  }
}

function changeDiscoveryMode(mode: string) {
  discoveryMode.value = mode
  void localPersistenceStore
    .patchPreferences({
      discovery: {
        mode: mode as 'all' | 'safe' | 'r18',
      },
    })
    .catch(() => {})
  discoveryStore.discoveryMode = mode
  syncDiscoveryQuery()
  refreshDiscovery()
}

function refreshDiscovery() {
  if (discoveryTab.value === 'novel') {
    discoveryStore.fetchNovelDiscovery()
  } else {
    discoveryStore.fetchDiscovery()
  }
}

function scrollToDiscovery() {
  discoverRef.value?.scrollIntoView({ behavior: 'smooth' })
}

function openNovelDiscovery() {
  changeDiscoveryTab('novel')
  scrollToDiscovery()
}

onMounted(() => {
  setTitle()
  syncDiscoveryQuery()
  if (!homeStore.rankingList.length) {
    homeStore.fetchRanking()
  } else if (!homeStore.randomBg) {
    homeStore.fetchRandomBg()
  }
  if (!discoveryStore.discoveryList.length) discoveryStore.fetchDiscovery()
})
</script>

<style lang="scss">
body[data-route='home'] {
  background-color: var(--pf-bg);
  background-image: none;

  #app-full-container > main > article {
    padding-bottom: 0;
  }
}

#home-view {
  min-height: 100vh;
  color: var(--pf-text);
  background: var(--pf-bg);

  .hero-section {
    position: relative;
    display: grid;
    height: 610px;
    margin-top: -64px;
    padding: 64px 24px 0;
    overflow: hidden;
    place-items: start center;
    color: #fff;
    background-color: #142028;
    background-position: center;
    background-repeat: no-repeat;
    background-size: cover;
  }

  .hero-overlay {
    position: absolute;
    inset: 0;
    background: rgb(11 20 26 / 78%);
  }

  .hero-content {
    position: relative;
    z-index: 1;
    display: grid;
    justify-items: center;
    width: min(700px, 100%);
    margin-top: 61px;
    text-align: center;
  }

  .hero-logo {
    margin: 0;
    line-height: 0;

    img {
      display: block;
      width: min(250px, 64vw);
      height: auto;
    }
  }

  .hero-subtitle {
    margin: 2px 0 20px;
    font-size: 1.125rem;
  }

  .hero-search {
    width: min(640px, 100%);
    margin: 0;
    color: #172033;
    text-align: left;

    input {
      height: 64px;
      padding-inline: 54px 18px;
      color: #172033;
      background: #fff;
      border: 1px solid rgb(255 255 255 / 82%);
      border-radius: 16px;
      box-shadow: 0 12px 34px rgb(20 25 34 / 18%);
      font-size: 1.05rem;

      &::placeholder {
        color: #73777e;
      }
    }

    .icon,
    [data-icon] {
      left: 18px;
      width: 28px;
      height: 28px;
      color: #666a70;
    }
  }

  .quick-links {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-top: 20px;

    .fnb-tag {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 34px;
      padding: 0 12px;
      color: #fff;
      background: rgb(16 22 28 / 86%);
      border: 1px solid rgb(255 255 255 / 82%);
      border-radius: 999px;
      box-shadow: none;
      font-size: 0.875rem;
      font-weight: 400;

      svg {
        width: 17px;
        height: 17px;
      }

      &:hover {
        color: #fff;
        background: var(--pf-blue);
        transform: translateY(-1px);
      }
    }
  }

  .hero-utilities {
    position: absolute;
    z-index: 2;
    right: 20px;
    bottom: 18px;
    display: flex;
    gap: 8px;

    button {
      display: grid;
      width: 34px;
      height: 34px;
      padding: 0;
      color: #fff;
      background: rgb(11 20 26 / 42%);
      border: 1px solid rgb(255 255 255 / 22%);
      border-radius: 9px;
      cursor: pointer;
      place-items: center;

      &:hover {
        background: var(--pf-blue);
      }

      svg {
        width: 20px;
        height: 20px;
      }
    }
  }

  .home-main {
    width: min(1440px, 100%);
    margin: 0 auto;
    padding: 36px 28px 48px 40px;
  }

  .user-status-card {
    margin-bottom: 18px;
  }

  .overview-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
    gap: 16px;
    align-items: stretch;
    margin-bottom: 18px;
  }

  .featured-skeleton {
    height: 360px;
    overflow: hidden;
    border: 1px solid var(--pf-line);
    border-radius: 20px;
  }

  .discover {
    padding: 16px 12px 24px;
    color: var(--pf-text);
    background: color-mix(in srgb, var(--pf-surface) 92%, transparent);
    border: 1px solid var(--pf-line);
    border-radius: 20px;
    box-shadow: var(--pf-card-shadow);
  }

  .discover-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    min-height: 32px;
    margin-bottom: 12px;

    h2 {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      margin: 0;
      color: var(--pf-text);
      font-size: 1.125rem;
      font-weight: 700;

      svg {
        width: 18px;
        height: 18px;
        color: var(--pf-pink);
      }
    }
  }

  .discover-controls {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;

    .discovery-tabs {
      gap: 4px;
    }

    .discovery-tab,
    .fnb-select-trigger,
    .fnb-button {
      min-height: 32px;
      padding: 6px 12px;
      color: var(--pf-muted);
      background: transparent;
      border: 0;
      border-radius: 999px;
      box-shadow: none;
      font-size: 0.75rem;
      font-weight: 500;

      &:hover {
        color: var(--pf-blue);
        background: var(--pf-soft-blue);
        box-shadow: none;
        transform: none;
      }
    }

    .discovery-tab.active,
    .fnb-button--primary {
      color: #fff;
      background: var(--pf-blue);
      transform: none;
    }

    .fnb-select-dropdown {
      color: var(--pf-text);
      background: var(--pf-surface);
      border: 1px solid var(--pf-line);
      border-radius: 10px;
      box-shadow: var(--pf-card-shadow);
    }
  }

  .artworks-list {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
    justify-content: stretch;
    margin: 0;

    li {
      display: block;
      width: auto;
      max-width: none;
      min-width: 0;
    }

    .artwork-card-container {
      height: 100%;
    }

    .artwork-card {
      height: 100%;
      transition: transform 180ms ease;

      &:hover {
        transform: translateY(-2px);
      }
    }

    a {
      text-decoration: none;
    }

    .artwork-image {
      animation: none;
    }
  }

  .novel-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin: 0;
  }
}

.fnb-dialog-overlay {
  position: fixed;
  z-index: 9000;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(11 20 26 / 58%);
}

.fnb-dialog-card {
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(600px, 100%);
  max-height: 84vh;
  overflow: hidden;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 20px;
  box-shadow: 0 24px 70px rgb(11 20 26 / 28%);

  &__close {
    position: absolute;
    z-index: 1;
    top: 12px;
    right: 12px;
    display: grid;
    width: 34px;
    height: 34px;
    padding: 0;
    color: var(--pf-muted);
    background: var(--pf-bg);
    border: 0;
    border-radius: 9px;
    cursor: pointer;
    place-items: center;

    &:hover {
      color: var(--pf-text);
    }
  }

  &__header {
    padding: 20px 56px 12px 22px;
    font-size: 1.05rem;
    font-weight: 700;
  }

  &__body {
    flex: 1;
    overflow-y: auto;
    padding: 0 22px 22px;
  }
}

.bg-info-modal {
  .thumb {
    display: block;
    overflow: hidden;
    border-radius: 14px;

    img {
      display: block;
      width: 100%;
      max-height: 58vh;
      object-fit: contain;
      background: var(--pf-bg);
    }
  }

  .desc {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 14px;
    color: var(--pf-muted);
    font-size: 0.8rem;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
}

@media (max-width: 1180px) {
  #home-view {
    .artworks-list {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }
  }
}

@media (max-width: 820px) {
  #home-view {
    .hero-section {
      height: 560px;
      place-items: center;
    }

    .hero-content {
      margin-top: 0;
    }

    .home-main {
      padding: 24px 16px 40px;
    }

    .overview-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .discover-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .discover-controls {
      justify-content: flex-start;
    }

    .artworks-list {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .novel-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

@media (max-width: 560px) {
  #home-view {
    .hero-section {
      height: 520px;
      padding-inline: 16px;
    }

    .hero-logo img {
      width: min(220px, 68vw);
    }

    .hero-subtitle {
      margin-bottom: 18px;
      font-size: 1rem;
    }

    .hero-search input {
      height: 56px;
      padding-left: 46px;
      font-size: 0.9rem;
    }

    .hero-search .icon,
    .hero-search [data-icon] {
      left: 15px;
      width: 23px;
      height: 23px;
    }

    .quick-links {
      gap: 7px;

      .fnb-tag {
        padding-inline: 10px;
        font-size: 0.78rem;
      }
    }

    .hero-utilities {
      right: 12px;
      bottom: 12px;
    }

    .artworks-list {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .novel-list {
      grid-template-columns: minmax(0, 1fr);
    }
  }
}
</style>
