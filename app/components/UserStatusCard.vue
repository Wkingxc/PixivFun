<template lang="pug">
FnbCard.user-status-card(shadow='sm')
  //- Logged in
  .user-status(v-if='userStore.isLoggedIn')
    .user-identity
      RouterLink.plain(:to='"/users/" + userStore.userId')
        img.avatar(:alt='userStore.userName', :src='userStore.userProfileImg')
      .user-info
        .user-name
          RouterLink.plain(:to='"/users/" + userStore.userId') {{ userStore.userName }}
          FnbTag.premium-badge(color='#f3a221' v-if='userStore.user?.premium') Premium
        .user-id @{{ userStore.userPixivId }}
    .user-actions
      FnbButton(
        :to='`/users/${userStore.userId}?tab=public_bookmarks`'
        size='sm'
        tag='RouterLink'
      )
        template(#icon): FnbIcon: ITablerBookmark
        | 收藏
      FnbButton(
        :to='`/users/${userStore.userId}/following`'
        size='sm'
        tag='RouterLink'
      )
        template(#icon): FnbIcon: ITablerUsers
        | 关注
      FnbButton(size='sm' tag='RouterLink' to='/login')
        template(#icon): FnbIcon: ITablerKey
        | 令牌

  //- Not logged in
  .user-status.guest(v-else)
    .user-identity
      img.avatar(:src='noProfileImg' alt='游客')
      .user-info
        .user-name 游客
        .user-id 绑定令牌，同步您的 Pixiv 信息！
    .user-actions
      FnbButton(
        :to='"/login?back=/"'
        size='sm'
        tag='RouterLink'
        variant='primary'
      )
        template(#icon): FnbIcon: ITablerLogin
        | 登录
</template>

<script lang="ts" setup>
import {
  IconBookmark as ITablerBookmark,
  IconUsers as ITablerUsers,
  IconKey as ITablerKey,
  IconLogin as ITablerLogin,
} from '@tabler/icons-vue'
import { useUserStore } from '~/stores/session'
import { pximgS } from '~/utils/pximg'

const userStore = useUserStore()
const noProfileImg = pximgS('common/images/no_profile.png')
</script>

<style scoped lang="scss">
.user-status-card {
  padding: 0.75rem 1rem;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 16px;
  box-shadow: var(--pf-card-shadow);
}

.user-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.user-identity {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-width: 0;
}

.avatar {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  flex-shrink: 0;
}

.user-info {
  min-width: 0;
}

.user-name {
  font-weight: 900;
  font-size: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;

  a {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.premium-badge {
  font-size: 0.7rem;
  font-weight: 900;
}

.user-id {
  font-size: 0.8rem;
  color: var(--pf-muted);
}

.user-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: wrap;

  :deep(.fnb-button) {
    border: 1px solid var(--pf-line);
    border-radius: 10px;
    box-shadow: none;

    &:hover {
      transform: translateY(-1px);
    }
  }
}
</style>
