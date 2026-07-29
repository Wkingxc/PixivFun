import assert from 'node:assert/strict'
import { test } from 'node:test'
import routerOptions from '../app/router.options.ts'
import {
  buildAuthorArtworkEntries,
  bookmarkPageOffset,
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
import { shouldNavigateArtworkTag } from '../app/utils/artworkTagNavigation.ts'
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

test('作者标签作品分页按每页 24 件生成接口偏移量', () => {
  assert.equal(userArtworkTagPageOffset(1), 0)
  assert.equal(userArtworkTagPageOffset(2), 24)
  assert.equal(userArtworkTagPageOffset(3), 48)
  assert.equal(userArtworkTagPageOffset(-1), 0)
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
