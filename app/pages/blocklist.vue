<template lang="pug">
#blocklist-view.modern-route-page.modern-page-shell
  h1 屏蔽作者管理
  Card(title='已屏蔽的作者')
    p.blocklist-tip 被屏蔽作者的作品与卡片不会出现在首页、发现、排行、搜索、关注更新和相关作品中；你自己的收藏列表不受影响。
    .fnb-empty(v-if='!blockedAuthors.length') 还没有屏蔽任何作者
    ul.blocklist(v-else)
      li.blocklist-item(:key='entry.id' v-for='entry in sortedAuthors')
        .blocklist-copy
          RouterLink.blocklist-name(:to='`/users/${entry.id}`') {{ entry.name || `用户 ${entry.id}` }}
          span.blocklist-meta ID {{ entry.id }} · 屏蔽于 {{ formatDate(entry.addedAt) }}
        button.blocklist-remove(
          :disabled='removingId === entry.id'
          @click='handleUnblock(entry)'
          type='button'
        ) {{ removingId === entry.id ? '处理中…' : '解除屏蔽' }}
</template>

<script lang="ts" setup>
definePageMeta({ name: 'blocklist' })
import Card from '~/components/Card.vue'
import type { BlockedAuthor } from '~~/shared/local-preferences'
import { setTitle } from '~/utils/setTitle'

const { blockedAuthors, unblockAuthor } = useAuthorBlocklist()
const toast = useToast()
const removingId = ref('')

const sortedAuthors = computed(() =>
  [...blockedAuthors.value].sort((a, b) => b.addedAt - a.addedAt)
)

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('zh-CN')
}

async function handleUnblock(entry: BlockedAuthor): Promise<void> {
  removingId.value = entry.id
  try {
    await unblockAuthor(entry.id)
    toast.success(`已解除屏蔽 ${entry.name || entry.id}`)
  } catch {
    toast.error('操作失败，请重试')
  } finally {
    removingId.value = ''
  }
}

onMounted(() => setTitle('屏蔽作者管理'))
</script>

<style scoped lang="scss">
#blocklist-view {
  display: grid;
  align-content: start;
  gap: 18px;
}

.blocklist-tip {
  color: var(--pf-muted);
  font-size: 0.82rem;
}

.blocklist {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.blocklist-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--pf-line);

  &:last-child {
    border-bottom: 0;
  }
}

.blocklist-copy {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.blocklist-name {
  overflow: hidden;
  color: var(--pf-text);
  font-weight: 700;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--pf-pink);
  }
}

.blocklist-meta {
  color: var(--pf-muted);
  font-size: 0.76rem;
}

.blocklist-remove {
  flex-shrink: 0;
  padding: 6px 16px;
  color: var(--pf-muted);
  background: transparent;
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 0.8rem;

  &:hover:not(:disabled) {
    color: var(--pf-pink);
    border-color: var(--pf-pink);
  }

  &:disabled {
    cursor: wait;
    opacity: 0.6;
  }
}
</style>
