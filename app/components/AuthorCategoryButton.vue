<template>
  <button
    class="author-category-button"
    :class="{ assigned: selected.length }"
    :title="
      selected.map((category) => category.name).join('、') || '设置作者分类'
    "
    :aria-label="`设置 ${authorName} 的作者分类`"
    type="button"
    @click="open = true"
  >
    <IconTags aria-hidden="true" />
    <span>{{ selected[0]?.name || '分类' }}</span>
    <small v-if="selected.length > 1">+{{ selected.length - 1 }}</small>
  </button>
  <AuthorCategoryEditor
    v-if="open"
    :key="authorId"
    :author-id="authorId"
    :author-name="authorName"
    @close="open = false"
  />
</template>

<script setup lang="ts">
import { IconTags } from '@tabler/icons-vue'
import { useAuthorCategoriesStore } from '~/stores/author-categories'

const props = defineProps<{ authorId: string; authorName: string }>()
const store = useAuthorCategoriesStore()
const open = ref(false)
const selected = computed(() => store.forAuthor(props.authorId))
onMounted(() => {
  void store.init().catch(() => {})
})
</script>

<style scoped lang="scss">
.author-category-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  max-width: 190px;
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
    width: 14px;
    height: 14px;
    flex: none;
  }
  span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  small {
    flex: none;
  }
  &:hover,
  &.assigned {
    color: var(--pf-pink);
    background: var(--pf-soft-pink);
    border-color: var(--pf-pink);
  }
}
</style>
