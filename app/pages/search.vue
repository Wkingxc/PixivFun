<template lang="pug">
#search-view.modern-route-page
  .modern-page-shell
    SearchBox.big
    .search-filters
      .content-tabs
        button.content-tab(
          :class='{ active: selectedType === opt.value }',
          :key='opt.value'
          @click='setQuery({ type: opt.value })'
          v-for='opt in contentOptions'
        ) {{ opt.label }}
      .refine-bar(v-if='!isUsers')
        .refine-field
          span.refine-label 匹配
          FnbSelect(
            :model-value='selectedSMode',
            :options='activeSModeOptions'
            @update:model-value='(v) => setQuery({ s_mode: v })'
          )
        .refine-field
          span.refine-label 排序
          FnbSelect(
            :model-value='selectedOrder',
            :options='orderOptions'
            @update:model-value='(v) => setQuery({ order: v })'
          )
        .refine-field
          span.refine-label 分级
          FnbSelect(
            :model-value='selectedMode',
            :options='modeOptions'
            @update:model-value='(v) => setQuery({ mode: v })'
          )
        .refine-field
          span.refine-label AI
          FnbSelect(
            :model-value='selectedAiType',
            :options='aiTypeOptions'
            @update:model-value='(v) => setQuery({ ai_type: v })'
          )
        .refine-field
          span.refine-label 收藏数
          FnbSelect(
            :model-value='selectedMinBookmarks',
            :options='minBookmarksOptions'
            @update:model-value='(v) => setQuery({ min_bm: v })'
          )
        .refine-field(v-if='isNovel')
          span.refine-label 语言
          FnbSelect(
            :model-value='selectedLang',
            :options='langOptions'
            @update:model-value='(v) => setQuery({ lang: v })'
          )

  //- Error
  section(v-if='error && !searchStore.loading')
    ErrorPage(:description='error' title='出大问题')

  //- Landing: no keyword yet
  section.search-landing(v-else-if='!hasQuery')
    .modern-page-shell
      .fnb-empty(style='padding: 12vh 0; text-align: center') 输入关键词开始搜索

  //- Result (has keyword)
  section(v-else)
    //- Popular preview (free tier: embedded in the search response)
    .popular-preview(v-if='!isNovel && !isUsers && hasPopular')
      .modern-wide-shell(:style='artworkLayoutContainerStyle')
        button.popular-toggle(
          @click='popularExpanded = !popularExpanded'
          type='button'
        )
          span.popular-title 热门作品
          span.popular-hint {{ popularExpanded ? '收起' : '展开' }}
        template(v-if='popularExpanded')
          .popular-group(v-if='searchStore.popular.recent.length')
            .popular-group-label 近期热门
            ArtworkList(:list='searchStore.popular.recent' controlled)
          .popular-group(v-if='searchStore.popular.permanent.length')
            .popular-group-label 历史热门
            ArtworkList(:list='searchStore.popular.permanent' controlled)

    //- Loading skeleton
    .loading-area(v-if='searchStore.loading && !currentResults.length')
      .modern-page-shell(v-if='isUsers')
        .fnb-empty(style='padding: 8vh 0; text-align: center') 搜索用户中…
      .modern-wide-shell(
        :style='artworkLayoutContainerStyle'
        v-else-if='!isNovel'
      )
        ArtworkList(:list='[]', :loading='16' controlled)
      .modern-page-shell(v-else)
        NovelList(:list='[]', :loading='12')

    //- Empty
    .no-more(v-if='!searchStore.loading && !currentResults.length')
      FnbCard(style='padding: 15vh 0; text-align: center')
        .fnb-empty 没有了，一滴都没有了……

    //- Results
    FnbSpin.result-area(
      :show='searchStore.loading'
      v-if='currentResults.length'
    )
      .modern-wide-shell(
        :style='!isNovel && !isUsers ? artworkLayoutContainerStyle : undefined'
      )
        .pagenator
          FnbPagination(
            :item-count='currentTotal',
            :page='page',
            :page-size='currentResults.length'
            @update:page='goPage'
          )
        ul.user-result-list(v-if='isUsers')
          li.user-result-item(
            :key='item.userId'
            v-for='item in visibleUserResults'
          )
            RouterLink.user-result-avatar(:to='`/users/${item.userId}`')
              img(
                :alt='item.userName',
                :src='item.profileImageUrl'
                loading='lazy'
                v-if='item.profileImageUrl'
              )
            .user-result-copy
              RouterLink.user-result-name(:to='`/users/${item.userId}`') {{ item.userName || `用户 ${item.userId}` }}
              p.user-result-comment(v-if='item.comment') {{ item.comment }}
            .user-result-works(v-if='item.works.length')
              RouterLink(
                :key='work.id',
                :to='`/artworks/${work.id}`'
                v-for='work in item.works'
              )
                img(:alt='work.title', :src='work.url' loading='lazy')
        template(v-else)
          ArtworkList(
            :list='searchStore.artworkResults'
            controlled
            v-if='!isNovel'
          )
          NovelList(:list='searchStore.novelResults' v-else)
        .pagenator
          FnbPagination(
            :item-count='currentTotal',
            :page='page',
            :page-size='currentResults.length'
            @update:page='goPage'
          )
</template>

<script lang="ts" setup>
definePageMeta({ name: 'search' })
import ArtworkList from '~/components/Artwork/ArtworkList.vue'
import NovelList from '~/components/Novel/NovelList.vue'
import ErrorPage from '~/components/ErrorPage.vue'
import SearchBox from '~/components/SearchBox.vue'
import { useSearchStore, type SearchContentType } from '~/stores/search'
import { effect } from 'vue'
import { setTitle } from '~/utils/setTitle'
import { contentOptions } from '~/utils/searchOptions'

// ── Filter options ──

const artworkSModeOptions = [
  { label: '标签（部分一致）', value: 's_tag' },
  { label: '标签（完全一致）', value: 's_tag_full' },
  { label: '标题、说明文字', value: 's_tc' },
  { label: '标签、标题、说明', value: 's_tag_tc' },
]

const novelSModeOptions = [
  { label: '标签、标题、说明', value: 's_tag' },
  { label: '标签（部分一致）', value: 's_tag_only' },
  { label: '标签（完全一致）', value: 's_tag_full' },
  { label: '正文', value: 's_tc' },
]

const orderOptions = [
  { label: '新到旧', value: 'date_d' },
  { label: '旧到新', value: 'date' },
]

const minBookmarksOptions = [
  { label: '不限', value: '' },
  { label: '1000+', value: '1000' },
  { label: '5000+', value: '5000' },
  { label: '10000+', value: '10000' },
  { label: '50000+', value: '50000' },
]

const modeOptions = [
  { label: '混池', value: 'all' },
  { label: '全年龄', value: 'safe' },
  { label: 'R18', value: 'r18' },
]

const aiTypeOptions = [
  { label: '含AI作品', value: '' },
  { label: '隐藏AI作品', value: '1' },
]

const langOptions = [
  { label: '全部语言', value: '' },
  { label: '中文', value: 'zh-cn' },
  { label: '日本語', value: 'ja' },
  { label: 'English', value: 'en' },
  { label: '한국어', value: 'ko' },
]

// ── State ──

const error = ref('')
const route = useRoute()
const router = useRouter()
const searchStore = useSearchStore()
const popularExpanded = ref(true)

const hasPopular = computed(
  () =>
    searchStore.popular.recent.length > 0 ||
    searchStore.popular.permanent.length > 0
)
const { containerStyle: artworkLayoutContainerStyle } =
  useArtworkLayoutSettings()

const keyword = computed(() => (route.query.q as string) || '')
const hasQuery = computed(() => !!keyword.value)
const page = computed(() => {
  const p = parseInt((route.query.p as string) || '1')
  return p > 0 ? p : 1
})

const selectedType = computed(() => (route.query.type as string) || 'artworks')
const selectedSMode = computed(() => (route.query.s_mode as string) || 's_tag')
const selectedOrder = computed(() => (route.query.order as string) || 'date_d')
const selectedMode = computed(() => (route.query.mode as string) || 'all')
const selectedAiType = computed(() => (route.query.ai_type as string) || '')
const selectedLang = computed(() => (route.query.lang as string) || '')
const selectedMinBookmarks = computed(
  () => (route.query.min_bm as string) || ''
)

// Bookmark-count floor via community `Nusers入り` tags — the only
// server-side popularity filter available without premium.
const effectiveKeyword = computed(() =>
  selectedMinBookmarks.value
    ? `${keyword.value} ${selectedMinBookmarks.value}users入り`
    : keyword.value
)

const isNovel = computed(() => selectedType.value === 'novels')
const isUsers = computed(() => selectedType.value === 'users')

const { filterBlocked } = useAuthorBlocklist()
const visibleUserResults = computed(() =>
  filterBlocked(searchStore.userResults)
)

const activeSModeOptions = computed(() =>
  isNovel.value ? novelSModeOptions : artworkSModeOptions
)

const currentResults = computed(() => {
  if (isUsers.value) return searchStore.userResults
  return isNovel.value ? searchStore.novelResults : searchStore.artworkResults
})

const currentTotal = computed(() => {
  if (isUsers.value) return searchStore.userTotal
  return isNovel.value ? searchStore.novelTotal : searchStore.artworkTotal
})

// ── Query helpers ──

const defaults: Record<string, string> = {
  type: 'artworks',
  s_mode: 's_tag',
  order: 'date_d',
  mode: 'all',
  ai_type: '',
  lang: '',
  min_bm: '',
}

function setQuery(updates: Record<string, string>) {
  const q = { ...route.query } as Record<string, string>
  const isTypeSwitch = 'type' in updates

  for (const [key, value] of Object.entries(updates)) {
    if (value === defaults[key] || value === '') {
      delete q[key]
    } else {
      q[key] = value
    }
  }

  if (isTypeSwitch) {
    delete q.s_mode
    delete q.lang
  }

  delete q.p
  router.push({ query: q })
}

function goPage(value: number) {
  const target = value < 1 ? 1 : value
  const q = { ...route.query } as Record<string, string>
  if (target === 1) delete q.p
  else q.p = String(target)
  router.push({ query: q })
}

// ── Search execution ──

async function makeSearch(): Promise<void> {
  error.value = ''
  if (!keyword.value) return

  try {
    if (isUsers.value) {
      await searchStore.searchUsers(keyword.value, { p: page.value })
    } else if (isNovel.value) {
      await searchStore.searchNovels(effectiveKeyword.value, {
        p: page.value,
        s_mode: selectedSMode.value,
        order: selectedOrder.value,
        mode: selectedMode.value,
        ai_type: selectedAiType.value || undefined,
        work_lang: selectedLang.value || undefined,
      })
    } else {
      await searchStore.searchArtworks(
        effectiveKeyword.value,
        selectedType.value as SearchContentType,
        {
          p: page.value,
          s_mode: selectedSMode.value,
          order: selectedOrder.value,
          mode: selectedMode.value,
          ai_type: selectedAiType.value || undefined,
        }
      )
    }
  } catch (err) {
    if (err instanceof Error) {
      error.value = err.message
    } else {
      error.value = '哎呀，出错了！'
    }
  }
}

// ── Watchers ──

watch(() => route.query, makeSearch, { deep: true })
watch(page, () => window.scrollTo({ top: 0, behavior: 'auto' }))

effect(() =>
  keyword.value
    ? setTitle(`${keyword.value} (第${page.value}页)`, 'Search')
    : setTitle('搜索')
)

onMounted(() => makeSearch())
</script>

<style lang="scss" scoped>
.search-filters {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  margin-top: 1rem;
}

// ── Primary axis: content type ──
.content-tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.content-tab {
  padding: 0.4rem 0.95rem;
  color: var(--pf-muted);
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 999px;
  font-family: inherit;
  font-size: 0.9rem;
  font-weight: 800;
  cursor: pointer;
  transition: all 150ms;

  &.active {
    background: var(--pf-blue);
    color: #fff;
    border-color: var(--pf-blue);
    box-shadow: none;
  }

  &:hover:not(.active) {
    background: var(--pf-soft-blue);
    color: var(--pf-blue);
  }
}

// ── Secondary axis: refinement ──
.refine-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem 1.15rem;
}

.refine-field {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
}

.refine-label {
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--pf-muted);
  white-space: nowrap;
}

.pagenator {
  display: flex;
  justify-content: center;
  margin: 1rem auto;
}

// ── Popular preview (non-premium hot works) ──
.popular-preview {
  margin-top: 1rem;
}

.popular-toggle {
  display: flex;
  align-items: baseline;
  gap: 0.6rem;
  width: 100%;
  padding: 0.35rem 0;
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: left;
}

.popular-title {
  font-size: 1rem;
  font-weight: 800;
  color: var(--pf-text);
}

.popular-hint {
  font-size: 0.78rem;
  color: var(--pf-muted);
}

.popular-group {
  margin-bottom: 0.6rem;
}

.popular-group-label {
  margin: 0.4rem 0;
  font-size: 0.8rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: var(--pf-muted);
}

.no-more {
  text-align: center;
  padding: 1rem;
  opacity: 0.75;
}

.search-box {
  margin: 1rem auto;
  margin-top: 2rem;
  box-shadow: none;
}

.fnb-empty {
  color: var(--pf-muted);
  padding: 1rem;
}

// ── User search results ──
.user-result-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.user-result-item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: var(--pf-surface);
  border: 1px solid var(--pf-line);
  border-radius: 14px;
}

.user-result-avatar img {
  display: block;
  width: 52px;
  height: 52px;
  object-fit: cover;
  border-radius: 50%;
}

.user-result-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.user-result-name {
  overflow: hidden;
  color: var(--pf-text);
  font-weight: 750;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:hover {
    color: var(--pf-pink);
  }
}

.user-result-comment {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0;
  color: var(--pf-muted);
  font-size: 0.78rem;
}

.user-result-works {
  display: flex;
  gap: 6px;

  img {
    display: block;
    width: 72px;
    height: 72px;
    object-fit: cover;
    border-radius: 8px;
  }
}

@media (max-width: 640px) {
  .user-result-works {
    display: none;
  }
}
</style>
