<template lang="pug">
.artwork-author-popover-host(
  @focusin='showPopover'
  @focusout='scheduleHide'
  @mouseenter='scheduleShow'
  @mouseleave='scheduleHide'
  ref='triggerRef'
)
  RouterLink.author-popover-trigger(
    :class='{ "is-viewed": viewed }',
    :style='viewedStyle',
    :to='`/users/${userId}`'
  )
    img.avatar(:alt='`${userName} 的头像`', :src='profileImageUrl' lazyload)
    span {{ userName }}

  Teleport(to='body')
    Transition(name='author-popover')
      aside.artwork-author-popover(
        :style='popoverStyle'
        @focusin='cancelHide'
        @focusout='scheduleHide'
        @mouseenter='cancelHide'
        @mouseleave='scheduleHide'
        ref='popoverRef'
        v-if='visible'
      )
        .author-popover-loading(v-if='loading && !user')
          FnbSkeleton(circle height='64px' width='64px')
          .author-popover-loading__copy
            FnbSkeleton(text width='9rem')
            FnbSkeleton(:repeat='2' text)

        template(v-else)
          .author-popover-profile
            RouterLink(:to='`/users/${userId}`')
              img.author-popover-avatar(
                :alt='`${displayName} 的头像`',
                :src='displayAvatar'
              )
            .author-popover-copy
              RouterLink.author-popover-name(:to='`/users/${userId}`') {{ displayName }}
              p.author-popover-comment {{ user?.comment || '作者暂未填写简介' }}
              RouterLink.author-popover-profile-link(:to='`/users/${userId}`') 查看个人资料

          .author-popover-error(v-if='loadFailed') 作者资料加载失败

          .author-popover-actions(
            v-if='user && user.userId !== sessionUser.userId'
          )
            button.author-popover-follow(
              :class='{ followed: user.isFollowed }',
              :disabled='followLoading'
              @click='toggleFollow'
              type='button'
            ) {{ followLoading ? '处理中…' : user.isFollowed ? '已关注' : '关注' }}

          .author-popover-works(v-if='profileArtworks.length')
            RouterLink.author-popover-work(
              :aria-label='artwork.title',
              :key='artwork.id',
              :to='`/artworks/${artwork.id}`'
              v-for='artwork in profileArtworks'
            )
              img(
                :alt='artwork.alt || artwork.title',
                :src='artwork.url'
                lazyload
              )
              span.author-popover-page-count(v-if='artwork.pageCount > 1')
                ITablerCopy(aria-hidden='true')
                | {{ artwork.pageCount }}
</template>

<script lang="ts" setup>
import { IconCopyFilled as ITablerCopy } from '@tabler/icons-vue'
import type { ArtworkInfo, User } from '~/types'
import { useUserProfileStore } from '~/stores/user-profile'
import { useUserStore } from '~/stores/session'

const props = defineProps<{
  userId: string
  userName: string
  profileImageUrl: string
  viewed?: boolean
  viewedStyle?: Record<string, string>
}>()

const userProfileStore = useUserProfileStore()
const sessionUser = useUserStore()
const toast = useToast()
const triggerRef = ref<HTMLElement | null>(null)
const popoverRef = ref<HTMLElement | null>(null)
const visible = ref(false)
const loading = ref(false)
const loadFailed = ref(false)
const followLoading = ref(false)
const user = ref<User>()
const popoverStyle = ref<Record<string, string>>({
  top: '0',
  left: '0',
  visibility: 'hidden',
})
let hideTimer: ReturnType<typeof setTimeout> | undefined
let showTimer: ReturnType<typeof setTimeout> | undefined

const displayName = computed(() => user.value?.name || props.userName)
const displayAvatar = computed(
  () => user.value?.imageBig || user.value?.image || props.profileImageUrl
)
const profileArtworks = computed<ArtworkInfo[]>(() => {
  if (!user.value) return []

  const unique = new Map<string, ArtworkInfo>()
  for (const artwork of [...user.value.illusts, ...user.value.manga]) {
    if (!unique.has(artwork.id)) unique.set(artwork.id, artwork)
  }
  return [...unique.values()]
    .sort((left, right) => Number(right.id) - Number(left.id))
    .slice(0, 3)
})

async function loadUser(): Promise<void> {
  const cached = userProfileStore.getCachedUser(props.userId)
  if (cached) {
    user.value = cached
    return
  }
  if (loading.value) return

  loading.value = true
  loadFailed.value = false
  try {
    user.value = await userProfileStore.fetchUser(props.userId)
  } catch {
    loadFailed.value = true
  } finally {
    loading.value = false
    if (visible.value) {
      await nextTick()
      updatePosition()
    }
  }
}

function updatePosition(): void {
  if (!import.meta.client || !triggerRef.value || !visible.value) return

  const trigger = triggerRef.value.getBoundingClientRect()
  const popover = popoverRef.value
  const viewportPadding = 12
  const gap = 10
  const width = Math.min(430, window.innerWidth - viewportPadding * 2)
  const height = popover?.offsetHeight || 330
  const preferredLeft = trigger.left + trigger.width / 2 - width / 2
  const left = Math.min(
    Math.max(preferredLeft, viewportPadding),
    window.innerWidth - width - viewportPadding
  )
  const below = trigger.bottom + gap
  const top =
    below + height <= window.innerHeight - viewportPadding
      ? below
      : Math.max(viewportPadding, trigger.top - height - gap)

  popoverStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    visibility: 'visible',
  }
}

async function showPopover(): Promise<void> {
  cancelHide()
  if (!visible.value) {
    visible.value = true
    await nextTick()
    updatePosition()
  }
  void loadUser()
}

function cancelHide(): void {
  if (!hideTimer) return
  clearTimeout(hideTimer)
  hideTimer = undefined
}

function cancelShow(): void {
  if (!showTimer) return
  clearTimeout(showTimer)
  showTimer = undefined
}

function scheduleShow(): void {
  cancelHide()
  cancelShow()
  if (visible.value) return

  showTimer = setTimeout(() => {
    showTimer = undefined
    void showPopover()
  }, 300)
}

function scheduleHide(): void {
  cancelShow()
  cancelHide()
  hideTimer = setTimeout(() => {
    visible.value = false
  }, 140)
}

async function toggleFollow(): Promise<void> {
  if (!user.value || followLoading.value) return

  followLoading.value = true
  try {
    if (user.value.isFollowed) {
      await userProfileStore.unfollowUser(user.value.userId)
    } else {
      await userProfileStore.followUser(user.value.userId)
    }
    user.value.isFollowed = !user.value.isFollowed
  } catch {
    toast.error(
      user.value.isFollowed ? '取消关注失败，请重试' : '关注失败，请重试'
    )
  } finally {
    followLoading.value = false
  }
}

watch(
  () => props.userId,
  () => {
    visible.value = false
    user.value = undefined
    loadFailed.value = false
  }
)

onMounted(() => {
  window.addEventListener('resize', updatePosition)
  window.addEventListener('scroll', updatePosition, true)
})

onBeforeUnmount(() => {
  cancelShow()
  cancelHide()
  window.removeEventListener('resize', updatePosition)
  window.removeEventListener('scroll', updatePosition, true)
})
</script>

<style scoped lang="scss">
.artwork-author-popover-host,
.author-popover-trigger {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-width: 0;
}

.author-popover-trigger {
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.artwork-author-popover {
  position: fixed;
  z-index: 1200;
  overflow: hidden;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: 0 18px 54px rgb(35 20 29 / 24%);
}

.author-popover-loading,
.author-popover-profile {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 20px;
}

.author-popover-loading__copy {
  display: grid;
  flex: 1;
  gap: 9px;
}

.author-popover-avatar {
  display: block;
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 50%;
}

.author-popover-copy {
  display: grid;
  min-width: 0;
  gap: 5px;
}

.author-popover-name {
  overflow: hidden;
  color: var(--pf-text);
  font-size: 1.08rem;
  font-weight: 760;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.author-popover-comment {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--pf-muted);
  font-size: 0.82rem;
  line-height: 1.55;
  overflow-wrap: anywhere;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.author-popover-profile-link {
  width: fit-content;
  color: var(--pf-muted);
  font-size: 0.78rem;
  text-decoration: none;

  &:hover {
    color: var(--pf-pink);
  }
}

.author-popover-actions {
  padding: 0 20px 16px;
  text-align: center;
}

.author-popover-follow {
  min-width: 112px;
  min-height: 38px;
  padding: 0 20px;
  color: #fff;
  background: var(--pf-blue);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.84rem;
  font-weight: 700;

  &.followed {
    color: var(--pf-blue);
    background: var(--pf-soft-blue);
  }

  &:disabled {
    cursor: default;
    opacity: 0.65;
  }
}

.author-popover-error {
  padding: 0 20px 16px;
  color: var(--pf-muted);
  font-size: 0.78rem;
  text-align: center;
}

.author-popover-works {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  background: var(--pf-line);
  border-top: 1px solid var(--pf-line);
}

.author-popover-work {
  position: relative;
  display: block;
  min-width: 0;
  aspect-ratio: 1;
  overflow: hidden;
  background: var(--pf-skeleton);

  img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 160ms ease;
  }

  &:hover img {
    transform: scale(1.04);
  }
}

.author-popover-page-count {
  position: absolute;
  top: 7px;
  right: 7px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 4px 7px;
  color: #fff;
  background: rgb(18 28 31 / 72%);
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  line-height: 1;
  backdrop-filter: blur(5px);

  svg {
    width: 12px;
    height: 12px;
  }
}

.author-popover-enter-active,
.author-popover-leave-active {
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.author-popover-enter-from,
.author-popover-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

@media (max-width: 620px), (hover: none) {
  .artwork-author-popover {
    display: none;
  }
}
</style>
