<template lang="pug">
.follow-user-card
  .follow-user-inner(v-if='user')
    .profile
      RouterLink.avatar-link(:to='"/users/" + user.userId')
        img(:alt='user.userName', :src='user.profileImageUrl')
      .profile-copy
        h4.plain
          RouterLink(:to='"/users/" + user.userId') {{ user.userName }}
        FnbEllipsis.description.pre(:line-clamp='3', :tooltip='false') {{ user.userComment || '这个用户还没有填写简介。' }}
        .profile-actions(v-if='user.userId !== userStore.userId')
          button.follow-action(
            :class='{ followed: user.following }',
            :disabled='loadingUserFollow'
            @click='handleUserFollow'
            type='button'
          )
            IFasCheck(v-if='user.following')
            IFasPlus(v-else)
            | {{ loadingUserFollow ? '处理中' : user.following ? '已关注' : '关注' }}
          button.featured-action(
            :aria-label='isFeatured ? `将 ${user.userName} 移出精选作者` : `将 ${user.userName} 设为精选作者`',
            :class='{ featured: isFeatured }',
            :disabled='loadingFeatured',
            :title='isFeatured ? "移出精选作者" : "设为精选作者"'
            @click='handleToggleFeatured'
            type='button'
          )
            IFasStar
            | {{ loadingFeatured ? '处理中' : isFeatured ? '已精选' : '设为精选' }}
          AuthorCategoryButton(
            :author-id='user.userId',
            :author-name='user.userName'
          )
    .user-artworks
      ArtworkList(:list='user.illusts' filter-disabled inline)

  .follow-user-inner.placeholder(v-else)
    .profile
      FnbSkeleton(circle height='92px' text width='92px')
      .profile-copy
        FnbSkeleton(height='1.4em' text width='10em')
        FnbSkeleton(block height='3em' width='100%')
    .user-artworks: ArtworkList(:list='[]', :loading='4' inline)
</template>

<script lang="ts" setup>
import ArtworkList from './Artwork/ArtworkList.vue'
import type { UserListItem } from '~/types'
import IFasCheck from '~icons/fa-solid/check'
import IFasPlus from '~icons/fa-solid/plus'
import IFasStar from '~icons/fa-solid/star'
import { useUserStore } from '~/stores/session'
import { useUserProfileStore } from '~/stores/user-profile'
import { useLocalPersistenceStore } from '~/stores/local-persistence'

const userStore = useUserStore()
const userProfileStore = useUserProfileStore()
const localPersistenceStore = useLocalPersistenceStore()
const toast = useToast()

const props = defineProps<{
  user?: UserListItem
}>()

const emit = defineEmits<{
  'featured-change': [featured: boolean, userId: string]
}>()

const isFeatured = computed(() =>
  localPersistenceStore.isFeaturedAuthor(props.user?.userId)
)

watch(
  () => props.user?.userId,
  (userId) => {
    if (userId) {
      void localPersistenceStore.ensureFeaturedAuthors([userId]).catch(() => {})
    }
  },
  { immediate: true }
)

const loadingUserFollow = ref(false)
async function handleUserFollow() {
  if (!props.user || loadingUserFollow.value) return
  loadingUserFollow.value = true
  try {
    if (props.user.following) {
      await userProfileStore.unfollowUser(props.user.userId)
    } else {
      await userProfileStore.followUser(props.user.userId)
    }
    props.user.following = !props.user.following
    if (isFeatured.value) {
      void localPersistenceStore.featureAuthor(props.user).catch(() => {})
    }
  } catch {
    toast.error(
      props.user.following ? '取消关注失败，请重试' : '关注失败，请重试'
    )
  } finally {
    loadingUserFollow.value = false
  }
}

const loadingFeatured = ref(false)
async function handleToggleFeatured() {
  if (!props.user || loadingFeatured.value) return
  const removing = isFeatured.value
  loadingFeatured.value = true
  try {
    if (removing) {
      await localPersistenceStore.unfeatureAuthor(props.user.userId)
    } else {
      await localPersistenceStore.featureAuthor(props.user)
    }
    const featured = !removing
    emit('featured-change', featured, props.user.userId)
    toast.success(featured ? '已加入精选作者' : '已移出精选作者')
  } catch {
    toast.error(
      removing ? '移出精选作者失败，请重试' : '设为精选作者失败，请重试'
    )
  } finally {
    loadingFeatured.value = false
  }
}
</script>

<style scoped lang="scss">
.follow-user-card {
  overflow: hidden;
  padding: 28px 30px;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: var(--pf-card-shadow);
}

.follow-user-inner {
  display: grid;
  grid-template-columns: minmax(310px, 0.72fr) minmax(0, 1.7fr);
  align-items: center;
  gap: clamp(28px, 4vw, 68px);

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
}

.profile {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  min-width: 0;
}

.avatar-link {
  flex: none;

  img {
    display: block;
    width: 92px;
    height: 92px;
    object-fit: cover;
    border-radius: 50%;
  }
}

.profile-copy {
  display: grid;
  gap: 9px;
  min-width: 0;
}

h4 {
  margin: 0;
  padding: 0;
  font-size: 1.05rem;
  font-weight: 760;

  a {
    color: inherit;
    text-decoration: none;
  }
}

.description {
  color: var(--pf-muted);
  font-size: 0.8rem;
  line-height: 1.6;
}

.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.follow-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  justify-self: start;
  min-height: 36px;
  padding: 0 16px;
  color: #fff;
  background: var(--pf-pink);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.73rem;
  font-weight: 720;

  svg {
    width: 12px;
    height: 12px;
  }

  &.followed {
    color: var(--pf-text);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.62;
  }
}

.featured-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  padding: 0 14px;
  color: var(--pf-muted);
  background: transparent;
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.73rem;
  font-weight: 720;

  svg {
    width: 12px;
    height: 12px;
  }

  &.featured {
    color: #f3a221;
    background: color-mix(in srgb, #f3a221 10%, transparent);
    border-color: color-mix(in srgb, #f3a221 48%, var(--pf-line));
  }

  &:disabled {
    cursor: wait;
    opacity: 0.62;
  }
}

.user-artworks {
  width: 100%;
  min-width: 0;
}

:deep(.artworks-list .author) {
  display: none;
}

:deep(.artworks-list) {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: clamp(12px, 1.35vw, 20px);
  margin-top: 0;
  overflow: visible;
  white-space: normal;
}

:deep(.artworks-list li) {
  width: auto;
  max-width: none;
  margin-left: 0 !important;
}

:deep(.fnb-media-card__media) {
  border-radius: 12px;
}

@media (max-width: 980px) {
  .follow-user-card {
    padding: 24px;
  }
}

@media (max-width: 560px) {
  .follow-user-card {
    padding: 18px;
  }

  .profile {
    gap: 12px;
  }

  .avatar-link img {
    width: 76px;
    height: 76px;
  }

  :deep(.artworks-list) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
