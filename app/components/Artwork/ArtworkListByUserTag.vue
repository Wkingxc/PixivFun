<template lang="pug">
.artworks-by-user-tag(ref='containerRef')
  .tag-result-heading
    .tag-result-title
      span 作者作品标签
      strong {{ '#' + tag }}
    span.tag-result-count(v-if='!loading') {{ total }} 件

  ArtworkList(
    :controlled='controlled',
    :list='artworks',
    :loading='loading ? pageSize : false'
    filter-disabled
    page-count-filtered
  )
  .fnb-empty(v-if='error && !loading') {{ error }}
  .fnb-empty(v-else-if='!loading && !artworks.length') 此标签下暂无作品

  FnbPagination.tag-result-pagination(
    :item-count='total',
    :page='page',
    :page-size='pageSize'
    @update:page='page = $event'
    v-if='total > pageSize'
  )
</template>

<script lang="ts" setup>
import ArtworkList from './ArtworkList.vue'
import type { ArtworkInfo } from '~/types'
import { useUserArtworksStore } from '~/stores/user-artworks'

const props = defineProps<{
  userId: string
  tag: string
  controlled?: boolean
}>()

const containerRef = ref<HTMLElement>()
const page = ref(1)
const total = ref(0)
const artworks = ref<ArtworkInfo[]>([])
const loading = ref(false)
const error = ref('')
const userArtworksStore = useUserArtworksStore()
const pageSize = userArtworksStore.pageSize
let requestId = 0

async function loadPage(scroll = false) {
  const currentRequest = ++requestId
  loading.value = true
  error.value = ''
  artworks.value = []

  try {
    const result = await userArtworksStore.fetchTagPage(
      props.userId,
      props.tag,
      page.value
    )
    if (currentRequest !== requestId) return
    artworks.value = result.works
    total.value = result.total
    if (scroll) {
      containerRef.value?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }
  } catch {
    if (currentRequest !== requestId) return
    artworks.value = []
    total.value = 0
    error.value = '作者标签作品加载失败，请稍后重试'
  } finally {
    if (currentRequest === requestId) loading.value = false
  }
}

watch(page, () => loadPage(true))
watch(
  () => [props.userId, props.tag],
  () => {
    if (page.value !== 1) {
      page.value = 1
    } else {
      void loadPage()
    }
  }
)

onMounted(() => loadPage())
</script>

<style scoped lang="scss">
.artworks-by-user-tag {
  scroll-margin-top: 130px;
}

.tag-result-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin: 0 0 18px;
  padding: 15px 18px;
  color: var(--pf-text);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 14px;
  box-shadow: var(--pf-card-shadow);
}

.tag-result-title {
  display: flex;
  align-items: baseline;
  gap: 0.65rem;
  min-width: 0;
  font-size: 0.78rem;

  span {
    color: var(--pf-muted);
  }

  strong {
    overflow: hidden;
    color: var(--pf-pink);
    font-size: 1rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.tag-result-count {
  flex: none;
  color: var(--pf-muted);
  font-size: 0.76rem;
}

.tag-result-pagination {
  margin: 28px auto 10px;
}

.fnb-empty {
  margin: 10vh auto;
  color: var(--pf-muted);
  text-align: center;
}
</style>
