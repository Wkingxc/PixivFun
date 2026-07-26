<template lang="pug">
section.user-artwork-overview
  .author-summary
    button.author-avatar(
      @click='$emit("show-profile")'
      aria-label='查看作者资料'
      type='button'
    )
      img(:alt='user.name', :src='user.imageBig')

    .author-copy
      .author-name-row
        h1 {{ user.name }}
        span.premium(v-if='user.premium') Premium
      RouterLink.following(:to='`/users/${user.userId}/following`')
        strong {{ user.following }}
        |
        | 已关注
      button.profile-link(@click='$emit("show-profile")' type='button')
        | 查看个人资料

    .author-actions
      button.follow-button(
        :class='{ followed: user.isFollowed }',
        :disabled='followLoading'
        @click='$emit("follow")'
        type='button'
        v-if='!isSelf'
      )
        IFasCheck(v-if='user.isFollowed')
        IFasPlus(v-else)
        | {{ user.isFollowed ? '已关注' : '关注' }}
      span.follow-loading(v-if='followLoading') 处理中
      span.self-badge(v-else-if='isSelf') 这是你自己

  .artwork-tag-section(v-if='showTags')
    .tag-heading
      .tag-title
        strong 作品标签
        span(v-if='tags.length') {{ tags.length }}
        button.clear-tag(
          @click='$emit("update:selectedTag", "")'
          type='button'
          v-if='selectedTag'
        ) {{ '清除 #' + selectedTag }}
      button.advanced-search(
        :class='{ active: advancedOpen }'
        @click='advancedOpen = !advancedOpen'
        type='button'
      )
        ITablerAdjustments(aria-hidden='true')
        span 高级搜索

    .tag-search-tools(v-if='advancedOpen')
      input(
        aria-label='筛选作者作品标签'
        placeholder='搜索标签、译名或读音'
        type='search'
        v-model.trim='tagQuery'
      )
      span 最多显示 80 项，选择标签后仅检索当前作者的作品

    .tag-loading(v-if='tagsLoading') 正在加载作者作品标签…
    .tag-cloud(v-else-if='visibleTags.length')
      button.author-tag(
        :class='{ selected: selectedTag === tag.tag }',
        :key='tag.tag'
        @click='selectTag(tag.tag)'
        type='button'
        v-for='tag in visibleTags'
      )
        strong {{ tag.tag }}
        small(v-if='tag.tag_translation') {{ '#' + tag.tag_translation }}
        span {{ tag.cnt }}
    p.tag-empty(v-else-if='tagQuery') 没有匹配的作者作品标签
    p.tag-empty(v-else) 作者没有可显示的作品标签
</template>

<script lang="ts" setup>
import { IconAdjustmentsHorizontal as ITablerAdjustments } from '@tabler/icons-vue'
import IFasCheck from '~icons/fa-solid/check'
import IFasPlus from '~icons/fa-solid/plus'
import type { User, UserArtworkTag } from '~/types'

const props = defineProps<{
  user: User
  tags: UserArtworkTag[]
  selectedTag?: string
  tagsLoading?: boolean
  showTags?: boolean
  followLoading?: boolean
  isSelf?: boolean
}>()

const emit = defineEmits<{
  follow: []
  'show-profile': []
  'update:selectedTag': [value: string]
}>()

const advancedOpen = ref(false)
const tagQuery = ref('')
const visibleTags = computed(() => {
  const query = tagQuery.value.toLocaleLowerCase()
  const filtered = query
    ? props.tags.filter((tag) =>
        [tag.tag, tag.tag_translation, tag.tag_yomigana].some((value) =>
          value?.toLocaleLowerCase().includes(query)
        )
      )
    : props.tags
  const limit = advancedOpen.value ? 80 : 18
  const visible = filtered.slice(0, limit)

  if (
    props.selectedTag &&
    !visible.some((tag) => tag.tag === props.selectedTag)
  ) {
    const selected = props.tags.find((tag) => tag.tag === props.selectedTag)
    if (selected) visible.unshift(selected)
  }

  return visible
})

function selectTag(tag: string) {
  emit('update:selectedTag', props.selectedTag === tag ? '' : tag)
}
</script>

<style scoped lang="scss">
.user-artwork-overview {
  margin-bottom: 22px;
  overflow: hidden;
  color: var(--pf-text);
  background: color-mix(in srgb, var(--pf-surface) 96%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 18px;
  box-shadow: var(--pf-card-shadow);
}

.author-summary {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  min-height: 128px;
  padding: 22px 26px;
}

.author-avatar {
  display: block;
  width: 88px;
  height: 88px;
  padding: 0;
  overflow: hidden;
  background: var(--pf-bg);
  border: 3px solid var(--pf-surface);
  border-radius: 50%;
  box-shadow: 0 8px 22px rgb(67 41 59 / 18%);
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.author-copy {
  min-width: 0;
}

.author-name-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;

  h1 {
    min-width: 0;
    margin: 0;
    overflow: hidden;
    font-size: clamp(1.25rem, 2.2vw, 1.75rem);
    font-weight: 780;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.premium {
  padding: 0.16rem 0.48rem;
  color: #fff;
  background: #f3a221;
  border-radius: 999px;
  font-size: 0.66rem;
  font-weight: 750;
  text-transform: uppercase;
}

.following {
  display: inline-flex;
  gap: 0.3rem;
  margin-top: 0.3rem;
  color: var(--pf-muted);
  font-size: 0.82rem;
  text-decoration: none;
}

.profile-link {
  display: block;
  margin-top: 0.45rem;
  padding: 0;
  color: var(--pf-muted);
  background: none;
  border: 0;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 650;

  &:hover {
    color: var(--pf-pink);
  }
}

.author-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.follow-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-width: 104px;
  min-height: 42px;
  padding: 0 18px;
  color: #fff;
  background: var(--pf-blue);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 750;

  svg {
    width: 14px;
    height: 14px;
  }

  &.followed {
    color: var(--pf-text);
    background: var(--pf-bg);
    border: 1px solid var(--pf-line);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.64;
  }
}

.follow-loading,
.self-badge {
  color: var(--pf-muted);
  font-size: 0.74rem;
}

.artwork-tag-section {
  padding: 18px 26px 22px;
  background: color-mix(in srgb, var(--pf-bg) 78%, var(--pf-surface));
  border-top: 1px solid var(--pf-line);
}

.tag-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.8rem;
}

.tag-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;

  strong {
    font-size: 1rem;
    font-weight: 780;
  }

  > span {
    display: grid;
    min-width: 1.35rem;
    height: 1.35rem;
    padding: 0 0.3rem;
    color: #fff;
    background: var(--pf-text);
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 750;
    place-items: center;
  }
}

.clear-tag {
  padding: 4px 9px;
  color: var(--pf-pink);
  background: color-mix(in srgb, var(--pf-pink) 11%, transparent);
  border: 0;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
}

.advanced-search {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 5px 8px;
  color: var(--pf-muted);
  background: transparent;
  border: 0;
  border-radius: 7px;
  cursor: pointer;
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;

  svg {
    width: 1rem;
    height: 1rem;
  }

  &:hover,
  &.active {
    color: var(--pf-pink);
    background: color-mix(in srgb, var(--pf-pink) 9%, transparent);
  }
}

.tag-search-tools {
  display: grid;
  grid-template-columns: minmax(180px, 360px) minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;

  input {
    min-height: 38px;
    padding: 0 12px;
    color: var(--pf-text);
    background: var(--pf-surface);
    border: 1px solid var(--pf-line);
    border-radius: 10px;
    font: inherit;
    font-size: 0.78rem;
    outline: 0;

    &:focus {
      border-color: var(--pf-pink);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--pf-pink) 13%, transparent);
    }
  }

  span {
    color: var(--pf-muted);
    font-size: 0.68rem;
  }
}

.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem;
}

.author-tag {
  position: relative;
  display: grid;
  min-width: 118px;
  max-width: 220px;
  padding: 0.55rem 2rem 0.55rem 0.9rem;
  color: #3d3440;
  background: #d9c4ed;
  border: 1px solid rgb(61 52 64 / 10%);
  border-radius: 9px;
  cursor: pointer;
  font: inherit;
  text-align: center;
  transition:
    transform 140ms ease,
    box-shadow 140ms ease;

  strong {
    overflow: hidden;
    font-size: 0.78rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    margin-top: 0.12rem;
    opacity: 0.74;
    font-size: 0.64rem;
  }

  > span {
    position: absolute;
    top: 7px;
    right: 8px;
    opacity: 0.62;
    font-size: 0.62rem;
    font-weight: 750;
  }

  &:nth-child(6n + 2) {
    background: #efd3a5;
  }

  &:nth-child(6n + 3) {
    background: #bfe6c7;
  }

  &:nth-child(6n + 4) {
    background: #bcd8ed;
  }

  &:nth-child(6n + 5) {
    background: #e9b7cc;
  }

  &:nth-child(6n) {
    background: #ded493;
  }

  &:hover {
    box-shadow: 0 5px 12px rgb(61 52 64 / 14%);
    transform: translateY(-2px);
  }

  &.selected {
    outline: 2px solid var(--pf-pink);
    outline-offset: 2px;
  }
}

.tag-empty,
.tag-loading {
  margin: 0;
  color: var(--pf-muted);
  font-size: 0.8rem;
}

@media (max-width: 640px) {
  .author-summary {
    grid-template-columns: auto minmax(0, 1fr);
    padding: 1rem;
  }

  .author-actions {
    grid-column: 1 / -1;
  }

  .author-avatar {
    width: 68px;
    height: 68px;
  }

  .artwork-tag-section {
    padding: 0.9rem 1rem 1rem;
  }

  .author-tag {
    flex: 1 1 120px;
  }

  .tag-search-tools {
    grid-template-columns: 1fr;
  }
}
</style>
