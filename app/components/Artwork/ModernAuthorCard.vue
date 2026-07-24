<template lang="pug">
.modern-author-card(v-if='user')
  .author-identity
    RouterLink.author-avatar(
      :aria-label='`查看作者：${user.name}`',
      :to='`/users/${user.userId}`'
    )
      img(:alt='`${user.name} 的头像`', :src='user.imageBig')
    .author-copy
      RouterLink(:to='`/users/${user.userId}`') {{ user.name }}
      FnbEllipsis(:line-clamp='1') {{ user.comment || '作者暂未填写简介' }}

  button.follow-button(
    :class='{ followed: user.isFollowed }',
    :disabled='followLoading'
    @click='toggleFollow'
    type='button'
    v-if='user.userId !== userStore.userId'
  ) {{ followLoading ? '处理中…' : user.isFollowed ? '已关注' : '关注' }}
.modern-author-card.modern-author-card--loading(v-else)
  .author-identity
    FnbSkeleton(circle height='46px' width='46px')
    .author-copy
      FnbSkeleton(text width='8rem')
      FnbSkeleton(text width='12rem')
  FnbSkeleton(block height='40px' width='100%')
</template>

<script lang="ts" setup>
import type { User } from '~/types'
import { useUserProfileStore } from '~/stores/user-profile'
import { useUserStore } from '~/stores/session'

const props = defineProps<{ user?: User }>()
const userStore = useUserStore()
const userProfileStore = useUserProfileStore()
const toast = useToast()
const followLoading = ref(false)

async function toggleFollow(): Promise<void> {
  if (!props.user || followLoading.value) return
  followLoading.value = true
  try {
    if (props.user.isFollowed) {
      await userProfileStore.unfollowUser(props.user.userId)
    } else {
      await userProfileStore.followUser(props.user.userId)
    }
    props.user.isFollowed = !props.user.isFollowed
  } catch {
    toast.error(
      props.user.isFollowed ? '取消关注失败，请重试' : '关注失败，请重试'
    )
  } finally {
    followLoading.value = false
  }
}
</script>

<style scoped lang="scss">
.modern-author-card {
  display: grid;
  gap: 14px;
}

.author-identity {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.author-avatar {
  flex: 0 0 auto;

  img {
    display: block;
    width: 46px;
    height: 46px;
    object-fit: cover;
    border-radius: 50%;
  }
}

.author-copy {
  display: grid;
  min-width: 0;
  gap: 4px;

  a {
    overflow: hidden;
    color: var(--modern-text);
    font-size: 0.95rem;
    font-weight: 700;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fnb-ellipsis {
    color: var(--modern-muted);
    font-size: 0.7rem;
  }
}

.follow-button {
  min-height: 40px;
  color: #fff;
  background: var(--modern-pink);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 650;

  &.followed {
    color: var(--modern-pink);
    background: var(--modern-soft-pink);
  }

  &:focus-visible {
    outline: 2px solid var(--modern-pink);
    outline-offset: 2px;
  }

  &:disabled {
    cursor: default;
    opacity: 0.65;
  }
}
</style>
