<template lang="pug">
header.global-navbar(
  :class='{ "is-artwork-route": route.name === "artworks", "not-at-top": notAtTop, "side-nav-opened": sideNavStore.isOpened }'
)
  .navbar-inner
    .brand-controls
      button.side-nav-toggle(
        :aria-expanded='sideNavStore.isOpened',
        :aria-label='sideNavStore.isOpened ? "关闭导航菜单" : "打开导航菜单"',
        :class='{ "is-active": sideNavStore.isOpened }'
        @click='toggleSideNav'
        title='导航菜单'
      )
        ITablerLayoutSidebarLeftCollapse(
          aria-hidden='true'
          v-if='sideNavStore.isOpened'
        )
        ITablerMenu2(aria-hidden='true' v-else)

      RouterLink.brand-logo(aria-label='PixivFun 首页' to='/')
        img.brand-logo__image(:src='logoUrl' alt='')

      nav.user-shortcuts(aria-label='个人快捷入口' v-if='userStore.isLoggedIn')
        RouterLink.header-shortcut(
          :to='`/users/${userStore.userId}?tab=public_bookmarks`'
          title='收藏'
        )
          ITablerBookmark(aria-hidden='true')
          span.shortcut-label 收藏
        RouterLink.header-shortcut(
          :to='`/users/${userStore.userId}/following`'
          title='关注'
        )
          ITablerUsers(aria-hidden='true')
          span.shortcut-label 关注
        RouterLink.header-shortcut(title='关注更新' to='/following/latest')
          ITablerPhoto(aria-hidden='true')
          span.shortcut-label 关注更新

    .search-area(v-if='$route.name !== "search"')
      .header-search
        FnbSelect.search-scope(
          :model-value='searchType',
          :options='contentOptions'
          @update:model-value='searchType = $event'
          v-if='wide'
        )
        SearchBox(
          :no-icon='wide',
          :type='effectiveType'
          placeholder='搜索作品、用户或输入 id:作品编号'
        )

    .header-tools
      ThemeToggle

      .user-area
        .user-link(ref='userLinkRef')
          button.dropdown-btn(
            :aria-expanded='showUserDropdown',
            :aria-label='userStore.isLoggedIn ? `用户菜单：${userStore.userName}` : "游客菜单"',
            :class='{ "show-user": showUserDropdown }',
            :title='userStore.isLoggedIn ? `${userStore.userId} (${userStore.userPixivId})` : "未登录"'
            @click='showUserDropdown = !showUserDropdown'
          )
            img.avatar(
              :alt='userStore.isLoggedIn ? userStore.userName : "游客"',
              :src='userStore.isLoggedIn ? userStore.userProfileImg : noProfileImg'
            )

          .dropdown-content(:class='{ visible: showUserDropdown }')
            ul
              li
                .nav-user-card
                  img.avatar(
                    :alt='userStore.isLoggedIn ? userStore.userName : "游客"',
                    :src='userStore.isLoggedIn ? userStore.userProfileImgBig : noProfileImg'
                  )
                  .details
                    strong.user-name(v-if='userStore.isLoggedIn') {{ userStore.userName }}
                    strong.user-name(v-else) 游客
                    .uid(v-if='userStore.isLoggedIn') @{{ userStore.userPixivId }}
                    .uid(v-else) 绑定令牌，同步 Pixiv 信息

              li
                RouterLink(:to='accountPath') 账户连接
              li(v-if='userStore.isLoggedIn')
                RouterLink(:to='`/users/${userStore.userId}`') 我的页面
              li(v-if='userStore.isLoggedIn')
                button.dropdown-action(@click='logoutUser' type='button') 用户登出
</template>

<script lang="ts" setup>
import SearchBox from './SearchBox.vue'
import {
  IconBookmark as ITablerBookmark,
  IconLayoutSidebarLeftCollapse as ITablerLayoutSidebarLeftCollapse,
  IconMenu2 as ITablerMenu2,
  IconPhoto as ITablerPhoto,
  IconUsers as ITablerUsers,
} from '@tabler/icons-vue'
import logoUrl from '~/assets/PixivFun.png'
import { contentOptions } from '~/utils/searchOptions'
import { logout } from '~/composables/userData'
import { useSideNavStore, useUserStore } from '~/stores/session'
import { pximgS } from '~/utils/pximg'
import { createLoginPath } from '~/utils/loginNavigation'

const noProfileImg = pximgS('common/images/no_profile.png')
const notAtTop = ref(false)
const showUserDropdown = ref(false)
const userLinkRef = ref<HTMLElement | null>(null)
const sideNavStore = useSideNavStore()
const userStore = useUserStore()
const toast = useToast()
const searchType = ref('artworks')
const wide = useMediaQuery('(min-width: 768px)')
const effectiveType = computed(() =>
  wide.value ? searchType.value : 'artworks'
)
const route = useRoute()
const accountPath = computed(() =>
  userStore.isLoggedIn ? '/login' : createLoginPath(route.fullPath)
)
onClickOutside(userLinkRef, () => {
  showUserDropdown.value = false
})

const router = useRouter()
router.afterEach(() => {
  showUserDropdown.value = false
})

function toggleSideNav() {
  sideNavStore.toggle()
}

async function logoutUser() {
  try {
    if (await logout()) userStore.logout()
  } catch {
    toast.error('退出失败，请稍后重试')
  }
}

useEventListener(window, 'scroll', () => {
  notAtTop.value = document.documentElement.scrollTop > 50
})
</script>

<style lang="scss">
.global-navbar {
  position: sticky;
  z-index: 130;
  top: 0;
  width: 100%;
  height: 64px;
  color: var(--pf-text);
  background: var(--pf-surface);
  border-bottom: 1px solid var(--pf-line);
  transition:
    color 220ms ease,
    background 220ms ease,
    border-color 220ms ease;

  &.is-artwork-route {
    position: relative;
  }

  .navbar-inner {
    display: grid;
    grid-template-columns: minmax(280px, auto) minmax(240px, 640px) auto;
    align-items: center;
    gap: 20px;
    width: 100%;
    height: 100%;
    padding: 0 20px;
  }

  .brand-controls {
    display: flex;
    align-items: center;
    gap: 14px;
    justify-self: start;
  }

  .user-shortcuts,
  .header-tools {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-shortcut {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 36px;
    padding: 0 10px;
    color: var(--pf-muted);
    border-radius: 9px;
    font-size: 0.82rem;
    font-weight: 650;
    text-decoration: none;

    &:hover,
    &.router-link-active {
      color: var(--pf-blue);
      background: var(--pf-soft-blue);
    }

    svg {
      width: 18px;
      height: 18px;
    }
  }

  .side-nav-toggle,
  .dropdown-btn,
  .dropdown-action {
    padding: 0;
    color: inherit;
    font: inherit;
    background: transparent;
    border: 0;
    cursor: pointer;
  }

  .side-nav-toggle {
    display: grid;
    width: 32px;
    height: 32px;
    place-items: center;
    border-radius: 9px;

    svg {
      width: 28px;
      height: 28px;
    }

    &:hover,
    &.is-active {
      background: rgb(255 255 255 / 14%);
    }

    &:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }
  }

  .brand-logo {
    display: inline-flex;
    align-items: center;
    text-decoration: none;
  }

  .brand-logo__image {
    display: block;
    width: 112px;
    height: auto;
  }

  .search-area {
    min-width: 0;
    opacity: 1;
    transition: opacity 220ms ease;
  }

  .header-search {
    display: flex;
    align-items: stretch;
    width: 100%;
    min-height: 40px;
    overflow: visible;
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    border-radius: 10px;
    box-shadow: 0 4px 18px rgb(32 48 71 / 8%);

    .search-scope {
      flex: 0 0 auto;
      min-width: auto;
    }

    .fnb-select-trigger {
      height: 100%;
      padding-inline: 12px;
      background: transparent;
      border: 0;
      border-right: 1px solid var(--pf-line);
      border-radius: 10px 0 0 10px;
      box-shadow: none;

      &:hover {
        color: var(--pf-blue);
        background: var(--pf-soft-blue);
        box-shadow: none;
        transform: none;
      }
    }

    .fnb-select-dropdown {
      border: 1px solid var(--pf-line);
      border-radius: 10px;
      box-shadow: var(--pf-card-shadow);
    }

    .search-box {
      flex: 1;
      min-width: 0;

      input {
        height: 100%;
        color: var(--pf-text);
        background: transparent;
        border: 0;
        border-radius: 0 10px 10px 0;
        box-shadow: none;
      }
    }
  }

  .header-tools {
    justify-self: end;
  }

  .user-link {
    position: relative;
  }

  .dropdown-btn {
    display: flex;
    align-items: center;
    border-radius: 999px;

    &:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 3px;
    }
  }

  .avatar {
    display: block;
    width: 40px;
    height: 40px;
    object-fit: cover;
    background: #e7eff5;
    border: 2px solid #fff;
    border-radius: 999px;
  }

  .dropdown-btn .avatar {
    box-shadow: 0 3px 12px rgb(25 35 48 / 18%);
    transition:
      box-shadow 180ms ease,
      transform 180ms ease;
  }

  .dropdown-btn:hover .avatar,
  .dropdown-btn.show-user .avatar {
    box-shadow: 0 0 0 3px rgb(35 136 255 / 28%);
    transform: translateY(-1px);
  }

  .dropdown-content {
    position: absolute;
    top: 52px;
    right: 0;
    width: 240px;
    color: var(--pf-text);
    opacity: 0;
    pointer-events: none;
    transform: translateY(-8px);
    transition:
      opacity 180ms ease,
      transform 180ms ease;

    &.visible {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    ul {
      overflow: hidden;
      margin: 0;
      padding: 8px;
      list-style: none;
      background: var(--pf-surface);
      border: 1px solid var(--pf-line);
      border-radius: 16px;
      box-shadow: var(--pf-card-shadow);
    }

    li > a,
    .dropdown-action {
      display: block;
      width: 100%;
      padding: 9px 10px;
      color: var(--pf-text);
      border-radius: 8px;
      text-align: left;
      text-decoration: none;

      &:hover {
        color: var(--pf-blue);
        background: var(--pf-soft-blue);
      }
    }
  }

  .nav-user-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 12px;
    margin-bottom: 4px;
    border-bottom: 1px solid var(--pf-line);

    .avatar {
      width: 48px;
      height: 48px;
      border-color: var(--pf-line);
    }

    .details {
      min-width: 0;
    }

    .user-name {
      display: block;
      overflow: hidden;
      color: var(--pf-text);
      font-size: 0.94rem;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .uid {
      overflow: hidden;
      color: var(--pf-muted);
      font-size: 0.72rem;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

@media (max-width: 1080px) {
  .global-navbar {
    .navbar-inner {
      grid-template-columns: minmax(220px, auto) minmax(180px, 1fr) auto;
      gap: 12px;
    }

    .shortcut-label {
      display: none;
    }

    .header-shortcut {
      justify-content: center;
      width: 34px;
      padding: 0;
    }
  }
}

@media (max-width: 760px) {
  .global-navbar {
    .navbar-inner {
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      padding-inline: 12px;
    }

    .search-area {
      display: none;
    }

    .brand-logo__image {
      width: 96px;
    }
  }
}

@media (max-width: 620px) {
  .global-navbar {
    .user-shortcuts,
    .artwork-style-control {
      display: none;
    }

    .brand-controls {
      gap: 10px;
    }

    .header-tools {
      gap: 6px;
    }
  }
}

[data-route='home'] {
  .global-navbar {
    color: #fff;
    background: rgb(11 20 26 / 42%);
    border-bottom-color: transparent;
    backdrop-filter: blur(8px);

    .search-area {
      opacity: 0;
      pointer-events: none;
    }

    &.not-at-top,
    &.side-nav-opened {
      background: rgb(11 20 26 / 88%);
      border-bottom-color: rgb(255 255 255 / 12%);
    }

    &.not-at-top {
      .search-area {
        opacity: 1;
        pointer-events: auto;
      }
    }
  }
}

@media (max-width: 760px) {
  .global-navbar {
    .navbar-inner {
      grid-template-columns: auto 1fr auto;
      gap: 12px;
      padding-inline: 14px;
    }

    .brand-logo__image {
      width: 100px;
    }

    .search-area {
      min-width: 0;
    }

    .header-search {
      min-height: 38px;
    }
  }
}

@media (max-width: 560px) {
  .global-navbar {
    .navbar-inner {
      grid-template-columns: 1fr auto;
    }

    .search-area {
      display: none;
    }
  }
}
</style>
