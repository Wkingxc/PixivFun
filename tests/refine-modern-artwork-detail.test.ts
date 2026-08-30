import assert from 'node:assert/strict'
import { test } from 'node:test'
import routerOptions from '../app/router.options.ts'
import {
  buildAuthorArtworkEntries,
  bookmarkBelongsToVisibility,
  bookmarkPageOffset,
  getActiveBookmarkRefreshPage,
  getAuthorArtworkPage,
  getAuthorArtworkPositionPage,
  getVisibleArtworkPages,
  getWheelPageTarget,
  isArtworkGridTab,
  isBookmarkTab,
  nextExplicitTheme,
  orderAuthorArtworkPage,
  safeRankingCandidates,
  userArtworkTagPageOffset,
} from '../app/utils/refineModernArtwork.ts'
import {
  artworkDirectoryScrollKey,
  parseArtworkDirectoryScroll,
  serializeArtworkDirectoryScroll,
} from '../app/utils/artworkDirectoryNavigation.ts'
import {
  bookmarkViewStorageKey,
  createBookmarkViewState,
  parseBookmarkViewState,
  serializeBookmarkViewState,
} from '../app/utils/bookmarkViewNavigation.ts'
import { shouldNavigateArtworkTag } from '../app/utils/artworkTagNavigation.ts'
import { getAuthorArtworkVisibilityPage } from '../app/utils/authorArtworkHiding.ts'
import { ArtworkSelectionDrag } from '../app/utils/artworkSelectionDrag.ts'
import { getOriginalImageViewerUrl } from '../app/utils/pximg.ts'
import {
  clampReaderColumns,
  getArtworkDownloadFilename,
  getArtworkPageFilename,
  getReaderAlignedRows,
  getReaderImageSource,
  getViewerSpreadIndices,
  getViewerStepIndex,
  shouldOpenArtworkReaderFromKey,
} from '../app/utils/artworkWaterfallReader.ts'
import {
  clampArtworkReaderFloatingPosition,
  parseArtworkReaderFloatingPosition,
  serializeArtworkReaderFloatingPosition,
} from '../app/utils/artworkReaderFloatingPosition.ts'
import {
  ARTWORK_DIRECTORY_SCROLL_BATCH_PAGES,
  chunkArtworkDirectoryEntries,
  getArtworkDirectoryBatchEndPage,
  getArtworkDirectoryBatchStartPage,
  getArtworkDirectoryPageScrollTop,
  getArtworkDirectoryPointerRatio,
  getArtworkDirectoryScrollPage,
  normalizeArtworkDirectoryMode,
} from '../app/utils/artworkDirectoryBrowse.ts'

test('单独打开原图时进入可声明独立 favicon 的查看页', () => {
  assert.equal(
    getOriginalImageViewerUrl(
      '/-/img-original/img/2026/07/24/21/50/40/147583598_p0.jpg?cache=1'
    ),
    '/image-viewer?src=%2F-%2Fimg-original%2Fimg%2F2026%2F07%2F24%2F21%2F50%2F40%2F147583598_p0.jpg%3Fcache%3D1'
  )
})

test('跨页面打开作品立即定位顶部且不使用平滑滚动', async () => {
  const result = await routerOptions.scrollBehavior!(
    { path: '/artworks/2', hash: '' } as never,
    { path: '/', hash: '' } as never,
    null
  )

  assert.deepEqual(result, { left: 0, top: 0, behavior: 'auto' })
})

test('从作者作品目录切换作品时保留当前页面纵向位置', async () => {
  const previousHistory = Object.getOwnPropertyDescriptor(globalThis, 'history')
  Object.defineProperty(globalThis, 'history', {
    configurable: true,
    value: { state: { preserveArtworkScroll: true } },
  })

  try {
    const result = await routerOptions.scrollBehavior!(
      { path: '/artworks/3', hash: '' } as never,
      { path: '/artworks/2', hash: '' } as never,
      null
    )

    assert.equal(result, false)
  } finally {
    if (previousHistory) {
      Object.defineProperty(globalThis, 'history', previousHistory)
    } else {
      Reflect.deleteProperty(globalThis, 'history')
    }
  }
})

test('作者作品目录导航位置载荷按目标作品隔离且只在有效期内恢复', () => {
  const savedAt = 1_000
  const payload = serializeArtworkDirectoryScroll(736, savedAt)

  assert.equal(artworkDirectoryScrollKey('42'), 'pixivfun:directory-scroll:42')
  assert.equal(parseArtworkDirectoryScroll(payload, savedAt + 2_000), 736)
  assert.equal(parseArtworkDirectoryScroll(payload, savedAt + 31_000), null)
  assert.equal(parseArtworkDirectoryScroll('{"scrollTop":-1}', savedAt), null)
  assert.equal(parseArtworkDirectoryScroll('not-json', savedAt), null)
})

test('作品标签只在没有文本选区且没有鼠标拖动时导航', () => {
  assert.equal(shouldNavigateArtworkTag(null, null, ''), true)
  assert.equal(
    shouldNavigateArtworkTag({ x: 20, y: 30 }, { x: 22, y: 32 }, ''),
    true
  )
  assert.equal(
    shouldNavigateArtworkTag({ x: 20, y: 30 }, { x: 52, y: 30 }, ''),
    false
  )
  assert.equal(
    shouldNavigateArtworkTag({ x: 20, y: 30 }, { x: 22, y: 32 }, '冬馬かずさ'),
    false
  )
})

test('主题单按钮根据当前解析主题切换到相反的明确主题', () => {
  assert.equal(nextExplicitTheme('light'), 'dark')
  assert.equal(nextExplicitTheme('dark'), 'light')
})

test('作者作品目录合并插画漫画、去重、排序并按六件分页', () => {
  const entries = buildAuthorArtworkEntries({
    illusts: { '14': null, '11': null, '9': null, '7': null },
    manga: { '13': null, '12': null, '9': null, '8': null },
  })

  assert.deepEqual(entries, [
    { id: '14', category: 'illust' },
    { id: '13', category: 'manga' },
    { id: '12', category: 'manga' },
    { id: '11', category: 'illust' },
    { id: '9', category: 'illust' },
    { id: '8', category: 'manga' },
    { id: '7', category: 'illust' },
  ])
  assert.deepEqual(getAuthorArtworkPage(entries, 1), entries.slice(0, 6))
  assert.deepEqual(getAuthorArtworkPage(entries, 2), entries.slice(6))
  assert.deepEqual(getAuthorArtworkPage(entries, 1, 3), entries.slice(0, 3))
  assert.deepEqual(getAuthorArtworkPage(entries, 2, 3), entries.slice(3, 6))
  assert.deepEqual(getAuthorArtworkPage(entries, 3, 3), entries.slice(6))
})

test('作者作品目录默认定位到当前作品所在页', () => {
  assert.equal(getAuthorArtworkPositionPage(1), 1)
  assert.equal(getAuthorArtworkPositionPage(6), 1)
  assert.equal(getAuthorArtworkPositionPage(7), 2)
  assert.equal(getAuthorArtworkPositionPage(194), 33)
  assert.equal(getAuthorArtworkPositionPage(null), 1)
})

test('作者作品接口响应按目录 ID 顺序恢复', () => {
  const page = [
    { id: '12', category: 'manga' as const },
    { id: '11', category: 'illust' as const },
    { id: '8', category: 'manga' as const },
  ]
  const ordered = orderAuthorArtworkPage(page, {
    '8': { id: '8', title: '八' },
    '11': { id: '11', title: '十一' },
    '12': { id: '12', title: '十二' },
  })

  assert.deepEqual(
    ordered.map((item) => item.id),
    ['12', '11', '8']
  )
})

test('翻页模式的鼠标滚轮每次只切换一页且不越界', () => {
  assert.equal(getWheelPageTarget(3, 8, 120), 4)
  assert.equal(getWheelPageTarget(3, 8, -120), 2)
  assert.equal(getWheelPageTarget(1, 8, -120), 1)
  assert.equal(getWheelPageTarget(8, 8, 120), 8)
  assert.equal(getWheelPageTarget(3, 8, 0), 3)
})

test('快速翻页模式可在页面切换完成前累计连续滚轮输入', () => {
  let target = 3
  target = getWheelPageTarget(target, 8, 120)
  target = getWheelPageTarget(target, 8, 120)
  target = getWheelPageTarget(target, 8, 120)
  assert.equal(target, 6)

  target = getWheelPageTarget(target, 8, -120)
  target = getWheelPageTarget(target, 8, -120)
  assert.equal(target, 4)
})

test('作者作品目录记忆三种合法模式并回退非法存储值', () => {
  assert.equal(normalizeArtworkDirectoryMode('scroll'), 'scroll')
  assert.equal(normalizeArtworkDirectoryMode('page'), 'page')
  assert.equal(normalizeArtworkDirectoryMode('quick-page'), 'quick-page')
  assert.equal(normalizeArtworkDirectoryMode('unknown'), 'page')
  assert.equal(normalizeArtworkDirectoryMode(null), 'page')
})

test('滚动目录按完整高度实时换算大概页数并支持反向定位', () => {
  assert.equal(getArtworkDirectoryScrollPage(0, 10_000, 1_000, 20), 1)
  assert.equal(getArtworkDirectoryScrollPage(4_500, 10_000, 1_000, 20), 11)
  assert.equal(getArtworkDirectoryScrollPage(9_000, 10_000, 1_000, 20), 20)
  assert.equal(getArtworkDirectoryScrollPage(500, 1_000, 1_000, 20), 1)

  assert.equal(getArtworkDirectoryPageScrollTop(1, 20, 10_000, 1_000), 0)
  assert.equal(getArtworkDirectoryPageScrollTop(20, 20, 10_000, 1_000), 9_000)
  assert.equal(
    Math.round(getArtworkDirectoryPageScrollTop(11, 20, 10_000, 1_000)),
    4_737
  )
})

test('自定义目录滑块按固定胶囊中心实时换算轨道位置', () => {
  assert.equal(getArtworkDirectoryPointerRatio(124, 100, 500, 48), 0)
  assert.equal(getArtworkDirectoryPointerRatio(576, 100, 500, 48), 1)
  assert.equal(getArtworkDirectoryPointerRatio(350, 100, 500, 48), 0.5)
  assert.equal(getArtworkDirectoryPointerRatio(362, 100, 500, 48, 12), 0.5)
})

test('页数过滤元数据按固定批量切分，避免一次请求过大', () => {
  const entries = Array.from({ length: 101 }, (_, index) => index + 1)
  const chunks = chunkArtworkDirectoryEntries(entries, 48)
  assert.deepEqual(
    chunks.map((chunk) => chunk.length),
    [48, 48, 5]
  )
  assert.deepEqual(chunkArtworkDirectoryEntries([1, 2], 0), [[1], [2]])
})

test('滚动目录固定按五十页分批并夹紧最后一批', () => {
  assert.equal(ARTWORK_DIRECTORY_SCROLL_BATCH_PAGES, 50)
  assert.equal(getArtworkDirectoryBatchStartPage(1, 126), 1)
  assert.equal(getArtworkDirectoryBatchStartPage(50, 126), 1)
  assert.equal(getArtworkDirectoryBatchStartPage(51, 126), 51)
  assert.equal(getArtworkDirectoryBatchStartPage(126, 126), 101)
  assert.equal(getArtworkDirectoryBatchStartPage(999, 126), 101)
  assert.equal(getArtworkDirectoryBatchEndPage(1, 126), 50)
  assert.equal(getArtworkDirectoryBatchEndPage(51, 126), 100)
  assert.equal(getArtworkDirectoryBatchEndPage(101, 126), 126)
})

test('新版多图作品默认只展示首图，展开后显示全部图片', () => {
  const pages = [{ id: 1 }, { id: 2 }, { id: 3 }]

  assert.deepEqual(getVisibleArtworkPages(pages, false), [{ id: 1 }])
  assert.deepEqual(getVisibleArtworkPages(pages, true), pages)
  assert.deepEqual(getVisibleArtworkPages([], false), [])
})

test('瀑布阅读器支持小图、高清与原图并允许一至十二列', () => {
  const page = {
    urls: {
      small: 'small.jpg',
      regular: 'regular.jpg',
      original: 'original.jpg',
    },
  }

  assert.equal(getReaderImageSource(page, 'small'), 'small.jpg')
  assert.equal(getReaderImageSource(page, 'regular'), 'regular.jpg')
  assert.equal(getReaderImageSource(page, 'original'), 'original.jpg')
  assert.equal(clampReaderColumns(0), 1)
  assert.equal(clampReaderColumns(2), 2)
  assert.equal(clampReaderColumns(4), 4)
  assert.equal(clampReaderColumns(13), 12)
})

test('作品页仅在非交互区域按下 Enter 时进入阅读模式', () => {
  assert.equal(
    shouldOpenArtworkReaderFromKey({
      key: 'Enter',
      repeat: false,
      isComposing: false,
      target: null,
    }),
    true
  )
  assert.equal(
    shouldOpenArtworkReaderFromKey({
      key: 'Enter',
      repeat: true,
      isComposing: false,
      target: null,
    }),
    false
  )
  assert.equal(
    shouldOpenArtworkReaderFromKey({
      key: 'Enter',
      repeat: false,
      isComposing: true,
      target: null,
    }),
    false
  )
  assert.equal(
    shouldOpenArtworkReaderFromKey({
      key: 'Enter',
      repeat: false,
      isComposing: false,
      target: { tagName: 'INPUT' },
    }),
    false
  )
  assert.equal(
    shouldOpenArtworkReaderFromKey({
      key: 'Enter',
      repeat: false,
      isComposing: false,
      target: { closest: () => ({}) },
    }),
    false
  )
})

test('阅读按钮位置可持久化并在窗口范围内恢复', () => {
  const stored = serializeArtworkReaderFloatingPosition({
    left: 516.4,
    top: 284.7,
  })
  assert.deepEqual(parseArtworkReaderFloatingPosition(stored), {
    left: 516,
    top: 285,
  })
  assert.deepEqual(
    clampArtworkReaderFloatingPosition(
      { left: 980, top: -20 },
      { width: 1000, height: 700 },
      { width: 90, height: 44 }
    ),
    { left: 902, top: 8 }
  )
  assert.equal(parseArtworkReaderFloatingPosition('{"left":"x"}'), null)
})

test('行对齐阅读模式按列数分行并保留横竖图原始顺序', () => {
  const pages = [
    { width: 1000, height: 1800 },
    { width: 1800, height: 1000 },
    { width: 1600, height: 900 },
    { width: 900, height: 1600 },
    { width: 800, height: 1200 },
  ]

  assert.deepEqual(getReaderAlignedRows(pages, 2), [[0, 1], [2, 3], [4]])
  assert.deepEqual(getReaderAlignedRows(pages, 3), [
    [0, 1, 2],
    [3, 4],
  ])
  assert.deepEqual(
    getReaderAlignedRows(
      [
        { width: 1800, height: 1000 },
        { width: 1600, height: 900 },
      ],
      4
    ),
    [[0, 1]]
  )
})

test('作品下载使用安全的作品名并保留每页原图扩展名', () => {
  assert.equal(
    getArtworkDownloadFilename('标题 / 测试:*?', '147583598', true),
    '标题 _ 测试___-147583598.zip'
  )
  assert.equal(
    getArtworkDownloadFilename('标题', '147583598', false, 'png'),
    '标题-147583598.png'
  )
  assert.equal(
    getArtworkPageFilename(
      '147583598',
      2,
      '/-/img-original/example_p2.png?cache=1'
    ),
    '147583598_p2.png'
  )
  assert.equal(
    getArtworkPageFilename('147583598', 0, '/image-without-extension'),
    '147583598_p0.jpg'
  )
})

test('原图查看器的双页模式固定配对并以跨页为单位翻页', () => {
  assert.deepEqual(getViewerSpreadIndices(6, 0, true), [0, 1])
  assert.deepEqual(getViewerSpreadIndices(6, 3, true), [2, 3])
  assert.deepEqual(getViewerSpreadIndices(5, 4, true), [3, 4])
  assert.deepEqual(getViewerSpreadIndices(1, 0, true), [0])
  assert.deepEqual(getViewerSpreadIndices(6, 3, false), [3])

  assert.equal(getViewerStepIndex(6, 0, 1, true), 2)
  assert.equal(getViewerStepIndex(6, 2, -1, true), 0)
  assert.equal(getViewerStepIndex(5, 2, 1, true), 4)
  assert.equal(getViewerStepIndex(5, 4, -1, true), 2)
  assert.equal(getViewerStepIndex(5, 4, 1, true), 4)
  assert.equal(getViewerStepIndex(5, 2, 1, false), 3)
})

test('收藏标签判定只覆盖公开与私密收藏', () => {
  assert.equal(isBookmarkTab('public_bookmarks'), true)
  assert.equal(isBookmarkTab('hidden_bookmarks'), true)
  assert.equal(isBookmarkTab('illusts'), false)
})

test('用户页插画、漫画与收藏使用全宽作品布局', () => {
  for (const tab of [
    'illusts',
    'mangas',
    'public_bookmarks',
    'hidden_bookmarks',
  ]) {
    assert.equal(isArtworkGridTab(tab), true)
  }
  assert.equal(isArtworkGridTab('novels'), false)
})

test('收藏分页每页固定 48 件并生成正确接口偏移量', () => {
  assert.equal(bookmarkPageOffset(1), 0)
  assert.equal(bookmarkPageOffset(2), 48)
  assert.equal(bookmarkPageOffset(3), 96)
  assert.equal(bookmarkPageOffset(-2), 0)
})

test('收藏变更保留当前页并让已取消或移出当前范围的卡片消失', () => {
  assert.equal(getActiveBookmarkRefreshPage(5, 30, false), 5)
  assert.equal(getActiveBookmarkRefreshPage(5, 30, true), 30)

  assert.equal(bookmarkBelongsToVisibility(null, false), false)
  assert.equal(bookmarkBelongsToVisibility({ private: true }, false), false)
  assert.equal(bookmarkBelongsToVisibility({ private: false }, false), true)
  assert.equal(bookmarkBelongsToVisibility({ private: true }, true), true)
})

test('从作品页后退时按用户和收藏类型恢复原页码、标签与滚动位置', () => {
  const state = createBookmarkViewState({
    userId: '42',
    tab: 'public_bookmarks',
    page: 3,
    tag: '风景',
    scrollTop: 1280,
    savedAt: 1_000,
  })
  const serialized = serializeBookmarkViewState(state)

  assert.equal(
    bookmarkViewStorageKey('42', 'public_bookmarks'),
    'pixivfun:bookmark-view:42:public_bookmarks'
  )
  assert.deepEqual(
    parseBookmarkViewState(serialized, '42', 'public_bookmarks', 2_000),
    state
  )
  assert.equal(
    parseBookmarkViewState(serialized, '42', 'hidden_bookmarks', 2_000),
    null
  )
  assert.equal(
    parseBookmarkViewState(
      serialized,
      'another-user',
      'public_bookmarks',
      2_000
    ),
    null
  )
})

test('作者作品分页按默认六列八行的每页 48 件生成接口偏移量', () => {
  assert.equal(userArtworkTagPageOffset(1), 0)
  assert.equal(userArtworkTagPageOffset(2), 48)
  assert.equal(userArtworkTagPageOffset(3), 96)
  assert.equal(userArtworkTagPageOffset(-1), 0)
})

test('作者隐藏作品在分页前过滤并在末页清空后夹紧页码', () => {
  const allIds = ['9', '8', '7', '6', '5', '4', '3', '2', '1']
  const hiddenIds = new Set(['8', '7', '6', '2'])

  assert.deepEqual(
    getAuthorArtworkVisibilityPage(allIds, hiddenIds, 2, 3, false),
    {
      ids: ['3', '1'],
      page: 2,
      total: 5,
    }
  )
  assert.deepEqual(
    getAuthorArtworkVisibilityPage(allIds, hiddenIds, 9, 3, false),
    {
      ids: ['3', '1'],
      page: 2,
      total: 5,
    }
  )
  assert.deepEqual(
    getAuthorArtworkVisibilityPage(allIds, hiddenIds, 1, 3, true),
    {
      ids: ['8', '7', '6'],
      page: 1,
      total: 4,
    }
  )
})

test('鼠标划选沿同一轨迹统一选中或取消且每张卡片只处理一次', () => {
  const drag = new ArtworkSelectionDrag()

  assert.equal(drag.start('1', false), true)
  assert.equal(drag.enter('1', true), false)
  assert.equal(drag.enter('2', false), true)
  assert.equal(drag.enter('2', false), false)
  assert.equal(drag.enter('3', true), false)

  drag.stop()
  assert.equal(drag.enter('4', false), false)
  assert.equal(drag.start('5', true), true)
  assert.equal(drag.enter('6', true), true)
  assert.equal(drag.enter('7', false), false)
})

test('主页横幅候选只从今日排行前十名中筛选全年龄作品', () => {
  const ranking = Array.from({ length: 12 }, (_, index) => ({
    id: String(index + 1),
    xRestrict: index === 2 ? 1 : 0,
  }))

  const candidates = safeRankingCandidates(ranking, 10)

  assert.deepEqual(
    candidates.map((item) => item.id),
    ['1', '2', '4', '5', '6', '7', '8', '9', '10']
  )
})
