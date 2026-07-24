<template lang="pug">
.following-latest
  FnbCard(shadow='sm')
    .panel-header
      h2.plain
        ITablerUsers(aria-hidden='true')
        | 关注更新
      RouterLink(to='/following/latest') 查看全部

    //- Loading
    template(v-if='loading')
      .following-item(:key='i' v-for='i in 4')
        FnbSkeleton(circle height='32px' width='32px')
        .following-item-info
          FnbSkeleton(height='1em' text width='8em')
          FnbSkeleton(height='0.8em' text width='5em')

    //- Logged in with artworks
    template(v-else-if='artworks.length')
      RouterLink.following-item(
        :key='item.id',
        :to='"/artworks/" + item.id'
        v-for='item in artworks.slice(0, 5)'
      )
        img.following-avatar(:alt='item.userName', :src='item.profileImageUrl')
        .following-item-info
          .following-item-title {{ item.userName }}
          .following-item-author 发布了「{{ item.title }}」

    //- Not logged in
    .following-empty(v-else-if='!loggedIn')
      p 登录后查看关注用户的最新作品
      FnbButton(
        size='sm'
        tag='RouterLink'
        to='/login?back=/'
        variant='primary'
      )
        template(#icon): FnbIcon: ITablerLogin
        | 登录

    //- Logged in but no follows
    .following-empty(v-else)
      p 还没有关注任何用户
</template>

<script lang="ts" setup>
import {
  IconUsers as ITablerUsers,
  IconLogin as ITablerLogin,
} from '@tabler/icons-vue'
import type { ArtworkInfo } from '~/types'

defineProps<{
  artworks: ArtworkInfo[]
  loading: boolean
  loggedIn: boolean
}>()
</script>

<style scoped lang="scss">
.following-latest,
:deep(.fnb-card) {
  height: 360px;
}

:deep(.fnb-card) {
  overflow: hidden;
  padding: 18px;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 20px;
  box-shadow: var(--pf-card-shadow);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;

  h2 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 0;
    font-size: 1rem;
    font-weight: 700;

    svg {
      width: 18px;
      height: 18px;
      color: var(--pf-pink);
    }
  }

  a {
    color: var(--pf-muted);
    font-size: 0.75rem;
    text-decoration: none;

    &:hover {
      color: var(--pf-blue);
    }
  }
}

.following-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 0;
  text-decoration: none;
  color: var(--pf-text);
  transition:
    color 150ms ease,
    background 150ms ease;

  &:hover {
    color: var(--pf-blue);
    background: var(--pf-soft-blue);
  }

  & + .following-item {
    border-top: 1px solid var(--pf-line);
  }
}

.following-avatar {
  width: 32px;
  height: 32px;
  object-fit: cover;
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  flex-shrink: 0;
  background: var(--fnb-skeleton);
}

.following-item-info {
  min-width: 0;
  flex: 1;
}

.following-item-title {
  font-weight: 650;
  font-size: 0.75rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.following-item-author {
  color: var(--pf-muted);
  font-size: 0.625rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.following-empty {
  display: grid;
  align-content: center;
  justify-items: center;
  min-height: 250px;
  padding: 1rem;
  color: var(--pf-muted);
  text-align: center;

  p {
    margin-bottom: 0.75rem;
  }

  :deep(.fnb-button) {
    border: 0;
    border-radius: 10px;
    box-shadow: none;
  }
}
</style>
