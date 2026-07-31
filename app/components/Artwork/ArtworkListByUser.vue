<template lang="pug">
.artworks-by-user(ref='containerRef')
  .author-artwork-organizer(:class='{ active: batchMode }')
    .organizer-copy
      strong {{ showHidden ? '已隐藏作品' : batchMode ? '选择要隐藏的作品' : '整理作者作品' }}
      span(v-if='batchMode') 已选 {{ selectedIds.length }} 项，可按住鼠标划过卡片快速选择
      span(v-else) 隐藏只作用于当前作者主页，不会记录为已观看
    .organizer-actions
      button.organizer-button(
        :disabled='actionLoading'
        @click='openHiddenView'
        type='button'
        v-if='!batchMode && hiddenCount'
      ) 已隐藏 {{ hiddenCount }}
      button.organizer-button.organizer-button--primary(
        @click='startHideMode'
        type='button'
        v-if='!batchMode'
      ) 隐藏作品
      template(v-else)
        button.organizer-button(@click='toggleCurrentPage' type='button') {{ allCurrentPageSelected ? '取消本页' : '选择本页' }}
        button.organizer-button(
          :disabled='!selectedIds.length'
          @click='selectedIds = []'
          type='button'
        ) 清空
        button.organizer-button.organizer-button--danger(
          :disabled='!selectedIds.length || actionLoading'
          @click='confirmBatchAction'
          type='button'
        ) {{ actionLoading ? '处理中…' : showHidden ? '恢复选中' : '隐藏选中' }}
        button.organizer-button(
          :disabled='actionLoading'
          @click='cancelBatchMode'
          type='button'
        ) 退出

  .pagination-row.pagination-row--top
    FnbPagination(
      :item-count='pageState.total',
      :page='pageState.page',
      :page-size='userArtworksStore.pageSize'
      @update:page='changePage'
      v-if='pageState.total > userArtworksStore.pageSize'
    )

  ArtworkList(
    :controlled='controlled',
    :list='curArtworks',
    :loading='loading ? userArtworksStore.pageSize : false',
    :page-count-filtered='!showHidden',
    :selectable='batchMode',
    :selected-ids='selectedIds'
    @toggle-selection='toggleSelection'
    filter-disabled
  )
  .fnb-empty(v-if='!loading && !curArtworks.length') {{ showHidden ? '这个分类还没有隐藏作品' : '这个分类暂无可显示作品' }}

  .pagination-row
    FnbPagination(
      :item-count='pageState.total',
      :page='pageState.page',
      :page-size='userArtworksStore.pageSize'
      @update:page='changePage'
      v-if='pageState.total > userArtworksStore.pageSize'
    )
</template>

<script setup lang="ts">
import type { ArtworkInfo } from '~/types'
import { useUserArtworksStore } from '~/stores/user-artworks'
import { useLocalPersistenceStore } from '~/stores/local-persistence'
import { getAuthorArtworkVisibilityPage } from '~/utils/authorArtworkHiding'
import { filterArtworksByPageCount } from '~/utils/artworkLayout'

const props = withDefaults(
  defineProps<{
    userId: string
    workCategory?: 'illust' | 'manga'
    controlled?: boolean
  }>(),
  {
    workCategory: 'illust',
  }
)

const EMPTY_IDS = new Set<string>()
const containerRef = ref<HTMLElement>()
const curPage = ref(1)
const curArtworks = ref<ArtworkInfo[]>([])
const loading = ref(false)
const batchMode = ref(false)
const showHidden = ref(false)
const selectedIds = ref<string[]>([])
const actionLoading = ref(false)
const ready = ref(false)
let pageRequestId = 0

const userArtworksStore = useUserArtworksStore()
const localPersistence = useLocalPersistenceStore()
const toast = useToast()
const dialog = useDialog()
const { normalizedMinPageCount } = useArtworkLayoutSettings()

const storeAllIds = computed(() => userArtworksStore.allIds(props.workCategory))
const hiddenIds = computed<ReadonlySet<string>>(() =>
  localPersistence.hiddenArtworkAuthorId === props.userId
    ? localPersistence.hiddenAuthorArtworkIds
    : EMPTY_IDS
)
const pageState = computed(() =>
  getAuthorArtworkVisibilityPage(
    storeAllIds.value,
    hiddenIds.value,
    curPage.value,
    userArtworksStore.pageSize,
    showHidden.value
  )
)
const hiddenCount = computed(
  () => storeAllIds.value.filter((id) => hiddenIds.value.has(id)).length
)
const selectableCurrentIds = computed(() =>
  (showHidden.value
    ? curArtworks.value
    : filterArtworksByPageCount(curArtworks.value, normalizedMinPageCount.value)
  ).map((artwork) => artwork.id)
)
const allCurrentPageSelected = computed(
  () =>
    !!selectableCurrentIds.value.length &&
    selectableCurrentIds.value.every((id) => selectedIds.value.includes(id))
)

function toggleSelection(item: ArtworkInfo) {
  const selected = new Set(selectedIds.value)
  if (selected.has(item.id)) selected.delete(item.id)
  else selected.add(item.id)
  selectedIds.value = [...selected]
}

function toggleCurrentPage() {
  const selected = new Set(selectedIds.value)
  if (allCurrentPageSelected.value) {
    selectableCurrentIds.value.forEach((id) => selected.delete(id))
  } else {
    selectableCurrentIds.value.forEach((id) => selected.add(id))
  }
  selectedIds.value = [...selected]
}

function startHideMode() {
  showHidden.value = false
  selectedIds.value = []
  batchMode.value = true
}

function openHiddenView() {
  showHidden.value = true
  curPage.value = 1
  selectedIds.value = []
  batchMode.value = true
}

function cancelBatchMode() {
  batchMode.value = false
  showHidden.value = false
  selectedIds.value = []
}

async function confirmBatchAction() {
  if (!selectedIds.value.length || actionLoading.value) return
  const restoring = showHidden.value
  const count = selectedIds.value.length
  const confirmed = await dialog.open({
    title: restoring ? '恢复隐藏作品' : '隐藏作品',
    content: restoring
      ? `恢复选中的 ${count} 个作品？它们会重新出现在这个作者主页。`
      : `隐藏选中的 ${count} 个作品？仅影响这个作者主页，不会记录为已观看。`,
    positiveText: restoring ? '恢复' : '隐藏',
    negativeText: '取消',
  })
  if (!confirmed) return

  actionLoading.value = true
  try {
    if (restoring) {
      await localPersistence.restoreAuthorArtworks(
        props.userId,
        selectedIds.value
      )
    } else {
      await localPersistence.hideAuthorArtworks(props.userId, selectedIds.value)
    }
    selectedIds.value = []
    if (restoring && !hiddenCount.value) cancelBatchMode()
    toast.success(
      restoring ? `已恢复 ${count} 个作品` : `已隐藏 ${count} 个作品`
    )
  } catch (error) {
    console.warn('author artwork batch action failed', error)
    toast.error(restoring ? '恢复作品失败，请重试' : '隐藏作品失败，请重试')
  } finally {
    actionLoading.value = false
  }
}

async function loadPage() {
  if (!ready.value) return
  const currentRequest = ++pageRequestId
  let state = pageState.value
  if (curPage.value !== state.page) {
    curPage.value = state.page
    state = pageState.value
  }

  loading.value = true
  try {
    const works = await userArtworksStore.fetchWorksByIds(
      props.userId,
      state.ids,
      props.workCategory
    )
    if (currentRequest !== pageRequestId) return
    curArtworks.value = works
  } catch (error) {
    if (currentRequest !== pageRequestId) return
    console.warn('author artwork page load failed', error)
    curArtworks.value = []
    toast.error('作者作品加载失败，请重试')
  } finally {
    if (currentRequest === pageRequestId) loading.value = false
  }
}

function changePage(page: number) {
  curPage.value = page
  selectedIds.value = []
  backToTop()
  void loadPage()
}

function backToTop() {
  const container = containerRef.value
  if (!container) return
  const top = container.getBoundingClientRect().top + window.scrollY - 120
  window.scrollTo({ top, behavior: 'auto' })
}

async function firstInit() {
  ready.value = false
  curPage.value = 1
  curArtworks.value = []
  cancelBatchMode()
  await userArtworksStore.fetchAllIds(props.userId, props.workCategory)
  try {
    await localPersistence.loadHiddenAuthorArtworks(props.userId)
  } catch (error) {
    console.warn('hidden author artwork load failed', error)
    toast.error('隐藏作品记录加载失败')
  }
  ready.value = true
  await loadPage()
}

watch(
  () => [props.userId, props.workCategory],
  () => void firstInit()
)
watch(
  () => [localPersistence.hiddenArtworkRevision, showHidden.value],
  () => {
    if (ready.value) void loadPage()
  }
)

onMounted(() => void firstInit())
</script>

<style scoped lang="scss">
.author-artwork-organizer {
  position: sticky;
  z-index: 12;
  top: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 6px 0 18px;
  padding: 13px 15px;
  background: color-mix(in srgb, var(--pf-surface) 94%, transparent);
  border: 1px solid var(--pf-line);
  border-radius: 14px;
  box-shadow: var(--pf-card-shadow);
  backdrop-filter: blur(14px);

  &.active {
    border-color: color-mix(in srgb, var(--pf-pink) 34%, var(--pf-line));
  }
}

.organizer-copy {
  display: grid;
  gap: 3px;
  min-width: 0;

  strong {
    color: var(--pf-text);
    font-size: 0.86rem;
  }

  span {
    overflow: hidden;
    color: var(--pf-muted);
    font-size: 0.7rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.organizer-actions {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 7px;
}

.organizer-button {
  min-height: 34px;
  padding: 0 12px;
  color: var(--pf-text);
  background: var(--pf-bg);
  border: 1px solid var(--pf-line);
  border-radius: 10px;
  cursor: pointer;
  font: inherit;
  font-size: 0.72rem;
  font-weight: 700;

  &:disabled {
    cursor: wait;
    opacity: 0.5;
  }

  &--primary {
    color: #fff;
    background: var(--pf-pink);
    border-color: var(--pf-pink);
  }

  &--danger {
    color: #fff;
    background: #d94d67;
    border-color: #d94d67;
  }
}

.pagination-row {
  display: flex;
  min-height: 36px;
  margin: 4px 0 22px;
  align-items: center;
  justify-content: center;

  &:last-child {
    margin: 28px 0 6px;
  }
}

.fnb-empty {
  margin: 10vh auto;
  color: var(--pf-muted);
  text-align: center;
}

@media (max-width: 760px) {
  .author-artwork-organizer {
    position: static;
    align-items: stretch;
    flex-direction: column;
  }

  .organizer-actions {
    justify-content: flex-start;
  }
}
</style>
