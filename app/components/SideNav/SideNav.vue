<template lang="pug">
aside.global-side-nav(
  :aria-hidden='!sideNavStore.isOpened',
  :class='{ hidden: !sideNavStore.isOpened }'
)
  .backdrop(@click='closeSideNav' aria-hidden='true')
  nav.inner(aria-label='站点导航')
    .group
      .search-area.mobile-search
        SearchBox

    .list
      .group
        .title 导航
        ul
          SideNavListLink(link='/' text='首页')
            ITablerHome.link-icon
          SideNavListLink(link='/ranking' text='排行榜')
            ITablerCrown.link-icon
          SideNavListLink(link='/search' text='搜索')
            ITablerSearch.link-icon

      .group
        .title 探索发现
        ul
          SideNavListLink(link='/discovery/artworks' text='插画·漫画')
            ITablerPhoto.link-icon
          SideNavListLink(link='/discovery/novels' text='小说')
            ITablerBook.link-icon
          SideNavListLink(link='/discovery/users' text='用户')
            ITablerUsers.link-icon

      .group
        .title 用户
        ul
          SideNavListLink(
            :link='userStore.isLoggedIn ? "/login" : guestLoginPath',
            :text='userStore.isLoggedIn ? "查看令牌" : "设置令牌"'
          )
            ITablerKey.link-icon
          SideNavListLink(
            :link='userStore.isLoggedIn ? `/users/${userStore.userId}` : guestLoginPath'
            text='我的页面'
          )
            ITablerUserCircle.link-icon
          SideNavListLink(
            :link='userStore.isLoggedIn ? `/users/${userStore.userId}/following` : guestLoginPath'
            text='我的关注'
          )
            ITablerHeart.link-icon
          SideNavListLink(link='/following/latest' text='关注更新')
            ITablerPhoto.link-icon

      .group
        .title PixivFun
        ul
          SideNavListLink(
            externalLink='https://www.pixiv.net/'
            text='Pixiv.net'
          )
            ITablerExternalLink.link-icon
          SideNavListLink(link='/about' text='关于我们')
            ITablerInfoCircle.link-icon
</template>

<script lang="ts" setup>
import SideNavListLink from './SideNavListLink.vue'
import SearchBox from '../SearchBox.vue'
import {
  IconBook2 as ITablerBook,
  IconCrown as ITablerCrown,
  IconExternalLink as ITablerExternalLink,
  IconHeart as ITablerHeart,
  IconHome as ITablerHome,
  IconInfoCircle as ITablerInfoCircle,
  IconKey as ITablerKey,
  IconPhoto as ITablerPhoto,
  IconSearch as ITablerSearch,
  IconUserCircle as ITablerUserCircle,
  IconUsers as ITablerUsers,
} from '@tabler/icons-vue'
import { useSideNavStore, useUserStore } from '~/stores/session'
import { createLoginPath } from '~/utils/loginNavigation'

const sideNavStore = useSideNavStore()
const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const guestLoginPath = computed(() => createLoginPath(route.fullPath))
router.afterEach(() => sideNavStore.close())

sideNavStore.$subscribe((_mutation, state): void => {
  if (state.openState) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = 'visible'
  }
})

function closeSideNav() {
  sideNavStore.close()
}

useEventListener(document, 'keydown', (event) => {
  if (event.key === 'Escape') closeSideNav()
})
</script>

<style scoped lang="scss">
.global-side-nav {
  position: fixed;
  inset: 0;
  z-index: 120;
  pointer-events: none;

  &:not(.hidden) {
    pointer-events: auto;
  }
}

.backdrop {
  position: fixed;
  inset: 0;
  background: rgb(18 24 33 / 18%);
  opacity: 1;
  transition: opacity 220ms ease;
}

.inner {
  position: fixed;
  top: 64px;
  left: 0;
  width: 248px;
  max-width: min(88vw, 248px);
  height: calc(100dvh - 64px);
  padding: 20px 18px 28px;
  overflow: hidden;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-left: 0;
  border-radius: 0 18px 18px 0;
  box-shadow: 8px 0 24px rgb(74 37 77 / 18%);
  transform: translateX(0);
  transition: transform 240ms ease;
}

.list {
  height: 100%;
  overflow-x: hidden;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--pf-line) transparent;
}

.group {
  margin: 0 0 20px;

  .title {
    user-select: none;
    padding: 0 10px;
    margin: 0 0 7px;
    color: #8a7490;
    font-weight: 700;
    font-size: 0.8rem;
  }

  ul {
    display: grid;
    gap: 7px;
    margin: 0;
    list-style: none;
    padding: 0;
  }
}

.hidden {
  .inner {
    transform: translateX(-110%);
  }

  .backdrop {
    opacity: 0;
  }
}

.search-area {
  display: none;
  padding: 0;

  :deep(input) {
    height: 40px;
    border: 1px solid var(--pf-line);
    border-radius: 10px;
    box-shadow: none;
  }
}

@media (max-width: 449px) {
  .search-area {
    display: block;
    margin-bottom: 20px;
  }
}
</style>
