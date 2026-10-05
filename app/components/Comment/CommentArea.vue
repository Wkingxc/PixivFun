<template lang="pug">
.comments-area(v-if='disabled')
  p.comments-closed 作者关闭了评论区
.comments-area(ref='commentsArea' v-else)
  //- CommentSubmit(:id="id" @push-comment="pushComment")
  em.stats
    | 共{{ count || comments.length || 0 }}条评论
  p(v-if='!comments.length && !loading') 还没有人发表评论呢~
  ul.comments-list(v-if='comments.length')
    comment(
      :author-id='authorId',
      :comment='item',
      :key='item.id',
      :type='type'
      v-for='item in comments'
    )
    .show-more.comment-more
      FnbButton(
        :loading='loading'
        @click='init(true)'
        size='sm'
        v-if='comments.length && hasNext'
      )
        | {{ loading ? '正在加载' : '浏览更多' }}
  .align-center(v-if='!comments.length && loading')
    placeholder
</template>

<script lang="ts" setup>
import Comment from './Comment.vue'
import type { Comments } from '~/types'
import { useArtworkStore } from '~/stores/artwork'
import { useNovelStore } from '~/stores/novel'

const artworkStore = useArtworkStore()
const novelStore = useNovelStore()
const loading = ref(false)
const comments = ref<Comments[]>([])
const hasNext = ref(false)
const isVisible = ref(false)
let initialized = false
let requestVersion = 0

const props = defineProps<{
  id: string
  count: number
  type?: 'illust' | 'novel'
  disabled?: boolean
  authorId?: string
}>()

async function init(loadMore = false): Promise<void> {
  if (loading.value || props.disabled || (initialized && !loadMore)) return
  if (!props.count) {
    hasNext.value = false
    comments.value = []
    loading.value = false
    initialized = true
    return
  }

  const version = requestVersion
  try {
    loading.value = true
    const fetchComments =
      props.type === 'novel'
        ? novelStore.fetchComments
        : artworkStore.fetchComments
    const data = await fetchComments(props.id, {
      limit: comments.value.length ? 30 : 3,
      offset: comments.value.length,
    })
    if (version !== requestVersion) return
    hasNext.value = data.hasNext
    comments.value = comments.value.concat(data.comments)
    initialized = true
  } catch (err) {
    if (version === requestVersion) console.warn('Comments fetch error', err)
  } finally {
    if (version === requestVersion) loading.value = false
  }
}

function pushComment(data: Comments) {
  console.log(data)
  comments.value.unshift(data)
}

const commentsArea = ref<HTMLDivElement | null>(null)

watch(
  () => [props.id, props.type, props.disabled, props.count],
  () => {
    requestVersion++
    comments.value = []
    hasNext.value = false
    loading.value = false
    initialized = false
    if (isVisible.value) void init()
  }
)

useIntersectionObserver(commentsArea, ([entry]) => {
  isVisible.value = entry?.isIntersecting ?? false
  if (isVisible.value) void init()
})

onScopeDispose(() => {
  requestVersion++
})
</script>

<style scoped lang="scss">
.comments-list {
  list-style: none;
  padding-left: 0;
}

.comment-more {
  display: flex;
  justify-content: center;
  margin-top: 12px;
}

.comments-closed {
  color: var(--pf-muted);
}
</style>
