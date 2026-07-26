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

  .author-actions(v-if='user.userId !== userStore.userId')
    button.follow-button(
      :class='{ followed: user.isFollowed }',
      :disabled='followLoading'
      @click='toggleFollow'
      type='button'
    ) {{ followLoading ? '处理中…' : user.isFollowed ? '已关注' : '关注' }}
    button.block-button(
      :class='{ blocked: authorBlocked }',
      :title='authorBlocked ? "解除屏蔽此作者" : "屏蔽此作者"'
      @click='toggleBlock'
      type='button'
    ) {{ authorBlocked ? '已屏蔽' : '屏蔽' }}
.modern-author-card.modern-author-card--loading(v-else)
  .author-identity
    FnbSkeleton(circle height='46px' width='46px')
    .author-copy
      FnbSkeleton(text width='8rem')
      FnbSkeleton(text width='12rem')
  FnbSkeleton(block height='36px' width='86px')
</template>

<script lang="ts" setup>
import type { User } from '~/types'
import { useUserProfileStore } from '~/stores/user-profile'
import { useUserStore } from '~/stores/session'

const props = defineProps<{ user?: User }>()
const userStore = useUserStore()
const userProfileStore = useUserProfileStore()
const toast = useToast()
const dialog = useDialog()
const followLoading = ref(false)

const { isBlocked, blockAuthor, unblockAuthor } = useAuthorBlocklist()
const authorBlocked = computed(() => isBlocked(props.user?.userId))

async function toggleBlock(): Promise<void> {
  if (!props.user) return
  try {
    if (authorBlocked.value) {
      await unblockAuthor(props.user.userId)
      toast.success(`已解除屏蔽 ${props.user.name}`)
      return
    }
    const confirmed = await dialog.open({
      title: '屏蔽作者',
      content: `屏蔽后，${props.user.name} 的作品将不再出现在任何列表中。可在侧边栏“屏蔽作者管理”中解除。`,
      positiveText: '屏蔽',
      negativeText: '取消',
    })
    if (!confirmed) return
    await blockAuthor({ id: props.user.userId, name: props.user.name })
    toast.success(`已屏蔽 ${props.user.name}`)
  } catch {
    toast.error('操作失败，请重试')
  }
}

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
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
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
    font-size: 1.12rem;
    font-weight: 700;
    text-decoration: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fnb-ellipsis {
    color: var(--modern-muted);
    font-size: 0.82rem;
  }
}

.author-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.block-button {
  min-height: 36px;
  padding: 0 14px;
  color: var(--modern-muted);
  background: transparent;
  border: 1px solid var(--modern-line, var(--pf-line));
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  white-space: nowrap;

  &.blocked {
    color: #fff;
    background: var(--modern-muted);
    border-color: var(--modern-muted);
  }
}

.follow-button {
  min-width: 86px;
  min-height: 36px;
  padding: 0 18px;
  color: #fff;
  background: var(--modern-pink);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;
  font-weight: 650;
  white-space: nowrap;

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
