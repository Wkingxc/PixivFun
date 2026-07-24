# Pixiv Viewer 功能参考手册

> 参考仓库：`../pixiv-viewer`
>
> 用途：供 Agent 在扩展 PixivFun 时快速定位 Viewer 中独有或更成熟的功能实现。

## 使用原则

1. 学习功能、交互、数据流和算法，在 PixivFun 内重新实现。
2. 保持 PixivFun 的 Nuxt 4、Vue 3、TypeScript、Pinia 和 Fnb 组件体系。
3. UI 以 `~/wking/UX/pixivfun.pen` 为准，不复制 Viewer 的 Vant 风格。
4. 先核对“PixivFun 已有能力”，避免重复建设。
5. 下文路径均相对于 PixivFun 根目录。

标记说明：

- **独有**：PixivFun 当前没有对应产品能力。
- **增强**：PixivFun 已有基础能力，Viewer 提供了明显扩展。
- **条件**：依赖第三方服务、页面解析或复杂 Provider，采用前需评估。

## 优先级总览

| 优先级 | 能力 |
| --- | --- |
| P0 | 设置中心、内容过滤、黑名单 |
| P0 | IndexedDB、浏览历史、备份恢复 |
| P0 | 小说阅读设置、导出、翻译 |
| P0 | 用户搜索、以图搜图、搜索辅助 |
| P0 | 小说动态、小说收藏、账户聚合页 |
| P1 | 多布局、虚拟列表、详情滑动 |
| P1 | 漫画图片翻译 |
| P1 | PWA、Service Worker |
| P1 | Pixivision、Collections、标签故事 |
| P2 | 多登录方式、多 API Provider |
| P2 | Live、Twitter/X 媒体、更多 Ugoira 格式 |

## 1. 设置与本地数据

| 状态 | 功能清单 | 主要代码 |
| --- | --- | --- |
| 独有 | R18、R18G、AI 全局开关；标签黑名单；用户黑名单；长按屏蔽 | `../pixiv-viewer/src/views/Setting/ContentsDisplay.vue`<br>`../pixiv-viewer/src/store/index.js`<br>`../pixiv-viewer/src/utils/filter/index.js`<br>`../pixiv-viewer/src/utils/filter/ACFilter.js` |
| 独有 | 布局、画质、懒加载、详情滑动、多图展开、导航隐藏、启动页等持久化偏好 | `../pixiv-viewer/src/views/Setting/OtherSetting.vue`<br>`../pixiv-viewer/src/store/index.js` |
| 增强 | 自定义强调色和主题色 | `../pixiv-viewer/src/views/Setting/AccentColor.vue` |
| 独有 | IndexedDB 业务缓存、内存/磁盘两级读取、TTL 和过期清理 | `../pixiv-viewer/src/utils/storage/localDb.js`<br>`../pixiv-viewer/src/utils/storage/siteCache.js` |
| 独有 | 插画、小说、用户浏览历史及分类型清理 | `../pixiv-viewer/src/views/Setting/History.vue`<br>`../pixiv-viewer/src/views/Setting/HistoryIllust.vue`<br>`../pixiv-viewer/src/views/Setting/HistoryNovel.vue`<br>`../pixiv-viewer/src/views/Setting/HistoryUsers.vue` |
| 独有 | IndexedDB、LocalStorage、SessionStorage 用量展示和清理 | `../pixiv-viewer/src/views/Setting/ClearCache.vue` |
| 独有 | 设置与历史导入导出；云同步配置 | `../pixiv-viewer/src/views/Setting/OtherSetting.vue`<br>`../pixiv-viewer/src/views/Setting/SyncDialog.vue`<br>`../pixiv-viewer/src/utils/sync.js` |
| 增强 | 14 种语言动态加载及 Vant 语言同步 | `../pixiv-viewer/src/i18n.js`<br>`../pixiv-viewer/src/locales/` |

值得学习：

- `siteCache` 管理业务缓存语义，`localDb` 隔离存储实现。
- 收藏状态会同步更新详情、收藏列表和本地缓存。
- 内容过滤有统一入口，而不是由每个页面自行判断。

PixivFun 中建议重新设计为：

- 类型化、带版本和迁移函数的设置 Schema。
- 独立的 `settings`、`history`、`content-policy` Store。
- 带统一 Key、TTL、版本和失效策略的 IndexedDB Repository。

## 2. 搜索、动态与作者页

### 搜索增强

| 状态 | 功能清单 | 主要代码 |
| --- | --- | --- |
| 独有 | 用户搜索、推荐用户、相关用户 | `../pixiv-viewer/src/views/Search/SearchUser.vue`<br>`../pixiv-viewer/src/views/Search/SearchUserRes.vue`<br>`../pixiv-viewer/src/views/Search/components/RecommUser.vue` |
| 独有 | 标签自动补全、热门词、标签封面 | `../pixiv-viewer/src/views/Search/index.vue`<br>`../pixiv-viewer/src/views/Search/components/Tags.vue`<br>`../pixiv-viewer/src/views/Search/components/TagsNovel.vue` |
| 增强 | 收藏数区间、投稿日期等搜索条件 | `../pixiv-viewer/src/views/Search/searchOptions.js`<br>`../pixiv-viewer/src/views/Search/SearchRes.vue`<br>`../pixiv-viewer/src/views/Search/SearchNovel.vue` |
| 独有 | 非会员热门插画/小说预览 | `../pixiv-viewer/src/views/Search/components/PopularPreview.vue`<br>`../pixiv-viewer/src/views/Search/components/PopularPreviewNovel.vue` |
| 独有 | 上传图片、按哈希缓存、按相似度展示并识别 Pixiv ID | `../pixiv-viewer/src/views/Search/components/ImageSearch.vue` |

相关 API：

- `../pixiv-viewer/src/api/index.js`：`searchUser`、`getRecommendedUser`、`getRelatedUser`
- `../pixiv-viewer/src/api/index.js`：`getTagsAutocomplete`、`getPopularPreview`、`getPopularPreviewNovel`
- `../pixiv-viewer/src/api/client/pixiv-api.js`：自动补全、收藏区间和用户搜索

以图搜图依赖 `PIXIV_NEXT_URL/api/sauce/` 和 SauceNAO。迁移时应通过 PixivFun 服务端代理，并增加文件类型、大小、频率和缓存限制。

### 账户聚合页

| 状态 | 功能清单 | 主要代码 |
| --- | --- | --- |
| 增强 | 关注用户的插画动态 | `../pixiv-viewer/src/views/Account/components/FeedsIllusts.vue` |
| 独有 | 关注用户的小说动态 | `../pixiv-viewer/src/views/Account/components/FeedsNovels.vue` |
| 增强 | 我的插画收藏及收藏标签 | `../pixiv-viewer/src/views/Account/MyBookmarks.vue`<br>`../pixiv-viewer/src/views/Account/components/BookmarkTags.vue` |
| 独有 | 我的小说收藏及收藏标签 | `../pixiv-viewer/src/views/Account/MyBookmarksNovel.vue` |
| 独有 | 已关注用户、推荐用户、全站最新 | `../pixiv-viewer/src/views/Account/components/FollowedUsers.vue`<br>`../pixiv-viewer/src/views/Account/components/LatestAllSite.vue` |

聚合入口：

- `../pixiv-viewer/src/views/Account/Following.vue`

小说收藏 API：

- `../pixiv-viewer/src/api/index.js`：`novelBookmarkAdd`、`novelBookmarkDelete`、`userBookmarkTags`
- `../pixiv-viewer/src/api/client/pixiv-api.js`：`bookmarkNovel`、`unbookmarkNovel`、`userBookmarkNovelTags`

### 作者页增强

| 状态 | 功能清单 | 主要代码 |
| --- | --- | --- |
| 独有 | 作者常用标签及按标签筛选 | `../pixiv-viewer/src/views/Users/components/AuthorIllusts.vue` |
| 独有 | 作者插画/漫画系列 | `../pixiv-viewer/src/views/Users/components/AuthorIllustSeries.vue`<br>`../pixiv-viewer/src/views/Users/IllustSeries.vue` |
| 增强 | 作者小说系列独立列表 | `../pixiv-viewer/src/views/Users/components/AuthorNovelSeries.vue`<br>`../pixiv-viewer/src/views/Users/NovelSeries.vue` |
| 独有 | 作者小说收藏、珍藏册、相关用户 | `../pixiv-viewer/src/views/Users/components/FavoriteNovels.vue`<br>`../pixiv-viewer/src/views/Users/components/AuthorCollections.vue`<br>`../pixiv-viewer/src/views/Users/index.vue` |
| 条件 | 作者 Twitter/X 图片和视频 | `../pixiv-viewer/src/views/Users/components/AuthorTwitterMedia.vue`<br>`../pixiv-viewer/src/api/index.js`：`getTwitterMedias` |

相关 API 位于 `../pixiv-viewer/src/api/index.js`：

- `getMemberTags`
- `getMemberIllustSeries`、`getIllustSeries`
- `getMemberNovelSeries`、`getMemberFavoriteNovel`
- `getUserCollections`

系列、标签和相关用户较稳定；Twitter/X 应放进可关闭、可替换的独立 Provider。

## 3. 小说阅读、翻译与导出

### 阅读器

| 状态 | 功能清单 | 主要代码 |
| --- | --- | --- |
| 独有 | 字号、字体、行高、字重、首行缩进 | `../pixiv-viewer/src/views/Artwork/components/NovelTextConfig.vue` |
| 独有 | 文字颜色、背景色、横排和竖排 | `../pixiv-viewer/src/views/Artwork/components/NovelTextConfig.vue` |
| 独有 | 自定义字体选择和加载 | `../pixiv-viewer/src/views/Artwork/components/PageFontSelect.vue`<br>`../pixiv-viewer/src/utils/font.js` |
| 增强 | 上一篇/下一篇、独立正文视图 | `../pixiv-viewer/src/views/Artwork/Novel.vue`<br>`../pixiv-viewer/src/views/Artwork/components/NovelView.vue` |

阅读设置状态：

- `../pixiv-viewer/src/store/index.js`：`novelTextConfig`

### 小说导出

Viewer 支持：

- [ ] TXT
- [ ] HTML
- [ ] Markdown
- [ ] DOC
- [ ] PDF
- [ ] EPUB
- [ ] 保留或移除阅读样式

代码入口：

- `../pixiv-viewer/src/views/Artwork/Novel.vue`：`downloadNovel`
- `../pixiv-viewer/src/utils/novel.js`

迁移时应把每种格式拆成独立导出器，并单独验证中文字体、插图、长文分页和内存占用。

### 小说翻译

Viewer 支持：

- [ ] 多翻译服务
- [ ] 浏览器原生翻译
- [ ] AI 流式翻译
- [ ] 不翻译词表
- [ ] 翻译缓存
- [ ] 原文/译文切换

代码入口：

- `../pixiv-viewer/src/views/Artwork/Novel.vue`
- `../pixiv-viewer/src/utils/translate/index.js`

## 4. 漫画翻译与下载工具

### 漫画图片翻译

| 状态 | 功能清单 | 主要代码 |
| --- | --- | --- |
| 独有 | 当前漫画页调用多模态模型、SSE 流式输出、按作品和页码缓存 | `../pixiv-viewer/src/utils/translate/manga.js` |
| 独有 | 桌面右侧面板、移动底部面板、失败重试 | `../pixiv-viewer/src/views/Artwork/components/PicTranslatePanel.vue`<br>`../pixiv-viewer/src/views/Artwork/components/PanelContent.vue` |
| 独有 | 详情页按当前页发起翻译 | `../pixiv-viewer/src/views/Artwork/index.vue`<br>`../pixiv-viewer/src/views/Artwork/components/ImageView.vue` |

安全要求：

- Viewer 把 AI API Key 注入前端，此设计不可复制。
- PixivFun 应通过服务端代理模型请求，并增加鉴权、限流、超时和成本控制。
- 翻译结果应使用独立缓存命名空间，并允许手动失效。

### 通用下载

| 状态 | 功能清单 | 主要代码 |
| --- | --- | --- |
| 独有 | 单图/多图下载、列表长按下载 | `../pixiv-viewer/src/views/Artwork/index.vue` |
| 独有 | 文件名模板、单图省略 `_p0`、按作者分目录 | `../pixiv-viewer/src/store/actions/filename.js`<br>`../pixiv-viewer/src/views/Setting/OtherSetting.vue` |
| 独有 | 收藏后下载、下载后收藏 | `../pixiv-viewer/src/store/index.js`<br>`../pixiv-viewer/src/views/Artwork/index.vue` |
| 独有 | File System Access API、目录句柄和直接写入 | `../pixiv-viewer/src/utils/fsa.js` |
| 增强 | Ugoira ZIP、WebM、APNG、服务端 MP4、AVIF | `../pixiv-viewer/src/utils/ugoira.js` |

PixivFun 已有 Ugoira 播放、GIF 和浏览器端 MP4 导出；更多格式属于低优先级增量。

### 作品详情交互

Viewer 额外提供：

- [ ] 左右滑动切换作品
- [ ] 图片横向滚动或轮播
- [ ] 多页作品默认展开
- [ ] 复制作品 ID、作者 ID
- [ ] 多平台分享
- [ ] 详情弹窗模式
- [ ] Medium、Large、WebP、Original 等画质选择

代码入口：

- `../pixiv-viewer/src/views/Artwork/index.vue`
- `../pixiv-viewer/src/views/Artwork/components/ImageView.vue`
- `../pixiv-viewer/src/components/ImageSlide.vue`
- `../pixiv-viewer/src/components/VirtualSwiper.vue`

## 5. 内容发现入口

| 状态 | 功能清单 | 主要代码 |
| --- | --- | --- |
| 独有 | Pixivision/特辑列表、分类、详情、故事页 | `../pixiv-viewer/src/views/Spotlights/Spotlights.vue`<br>`../pixiv-viewer/src/views/Spotlights/Spotlight.vue`<br>`../pixiv-viewer/src/views/Spotlights/SpotlightDetail.vue`<br>`../pixiv-viewer/src/views/Spotlights/PixivisionStory.vue` |
| 独有 | Collections 推荐、搜索、详情、相关内容、作者珍藏册 | `../pixiv-viewer/src/views/Collections/CollectionTop.vue`<br>`../pixiv-viewer/src/views/Collections/Collections.vue`<br>`../pixiv-viewer/src/views/Collections/Collection.vue`<br>`../pixiv-viewer/src/views/Collections/components/` |
| 独有 | 标签故事及轮播 | `../pixiv-viewer/src/views/Search/TagStory.vue`<br>`../pixiv-viewer/src/views/Search/components/TagStorySlides.vue` |
| 增强 | 分类型首页、专门的热门/推荐/随机页 | `../pixiv-viewer/src/views/Home/`<br>`../pixiv-viewer/src/views/Discovery/PopularIllust.vue`<br>`../pixiv-viewer/src/views/Discovery/RecommendIllust.vue`<br>`../pixiv-viewer/src/views/Home/components/RandomIllustPage.vue` |
| 条件 | Pixiv Live 列表和详情 | `../pixiv-viewer/src/views/Lives/`<br>`../pixiv-viewer/src/api/index.js`：`getLiveList` |

相关 API 均在 `../pixiv-viewer/src/api/index.js`：

- Pixivision：`getSpotlights`、`getAllSpotlights`、`getSpotlightTypeList`、`getSpotlightDetail`
- Collections：`getCollectionTop`、`searchCollections`、`getCollectionDetail`、`getCollectionRelated`
- 标签故事：`getTagStories`、`getTagStoryDetails`、`getTagStoryPage`

PixivFun 首页已聚合排行、关注和发现。增加新入口前应判断是否确实提升导航效率。

## 6. 布局、性能与 PWA

### 多布局和虚拟化

| 状态 | 功能 | 主要代码 |
| --- | --- | --- |
| 增强 | CSS Grid/Flex Masonry | `../pixiv-viewer/src/components/ImageLayout.vue`<br>`../pixiv-viewer/src/components/MasonryGrid.vue`<br>`../pixiv-viewer/src/components/FlexWaterfall.vue` |
| 独有 | Justified Layout | `../pixiv-viewer/src/components/JustifiedLayout.vue` |
| 独有 | 虚拟瀑布流、虚拟 Justified | `../pixiv-viewer/src/components/VirtualWaterfall.vue`<br>`../pixiv-viewer/src/components/VirtualJustified.vue` |
| 独有 | 虚拟轮播和图片预加载 | `../pixiv-viewer/src/components/VirtualSwiper.vue`<br>`../pixiv-viewer/src/components/Preload.vue` |
| 增强 | KeepAlive、滚动位置和路由层级 | `../pixiv-viewer/src/layouts/BaseLayout.vue`<br>`../pixiv-viewer/src/layouts/MainLayout.vue`<br>`../pixiv-viewer/src/router/routes.js` |

只迁移布局算法和交互思想；Vue 2 生命周期和渲染代码需要重写。应先用真实作品量建立性能基准，再决定是否虚拟化。

### PWA

Viewer 支持：

- [ ] Web App Manifest
- [ ] Service Worker 注册和更新提示
- [ ] App Shell、HTML、CDN、字体缓存
- [ ] 桌面安装
- [ ] 搜索、排行、动态、设置快捷入口

代码入口：

- `../pixiv-viewer/vue.config.js`
- `../pixiv-viewer/src/lib/registerServiceWorker.js`
- `../pixiv-viewer/public/manifest.json`

迁移前必须设计缓存版本、退出登录清理和敏感数据隔离；不应盲目缓存 Pixiv 图片与登录 API。

## 7. 登录、API 与图片 Provider

### 多登录方式

| 状态 | 功能 | 主要代码 |
| --- | --- | --- |
| 增强 | Cookie/PHPSESSID 登录 | `../pixiv-viewer/src/views/Account/Session.vue`<br>`../pixiv-viewer/src/api/user.js` |
| 独有 | RefreshToken 登录 | `../pixiv-viewer/src/views/Account/Login.vue`<br>`../pixiv-viewer/src/api/client/pixiv-auth.js` |
| 独有 | Pixiv OAuth/PKCE | `../pixiv-viewer/src/views/Account/OAuthCallback.vue`<br>`../pixiv-viewer/src/api/client/login.js`<br>`../pixiv-viewer/src/api/client/pixiv-api.js` |

### 多 Provider

Viewer 支持 HibiAPI、Pixiv App API、PixivNow/PxveAPI、多 API 实例、多图片代理、图片直连和请求重试。

代码入口：

- `../pixiv-viewer/src/api/index.js`
- `../pixiv-viewer/src/api/http.js`
- `../pixiv-viewer/src/api/client/action.js`
- `../pixiv-viewer/src/api/client/pixiv-api.js`
- `../pixiv-viewer/src/consts/index.js`
- `../pixiv-viewer/src/views/Setting/OtherSetting.vue`

这是 Viewer 最复杂、最不适合直接复制的部分。PixivFun 当前同源 Web API 代理更简单；如确需多 Provider，应先定义统一 TypeScript 接口，再使用 Adapter 实现。

## 8. 不应复制的设计

- Vue 2、Vuex 3、Vue Router 3、Vue CLI、Vant 2 技术栈。
- 超过 2600 行的 `../pixiv-viewer/src/api/index.js` 单体 facade。
- 页面组件直接判断当前使用哪个 API Provider。
- 单个 Store 容纳大量无版本设置。
- 哈希形式的国际化 Key。
- 在前端构建产物中注入第三方 AI API Key。
- 把 Pixivision、Collections、Twitter 的解析逻辑与页面 UI 耦合。
- Viewer 的视觉风格。

## 9. PixivFun 已有能力

以下能力无需从 Viewer 重做：

- 插画、漫画、动图、小说搜索及主要筛选项。
- 综合、插画、动图、漫画、小说的多模式排行榜。
- 插画、小说、用户发现。
- 作品详情、多图、评论、收藏、点赞、关注。
- 插画和小说相关推荐。
- 作者插画、漫画、小说、公开/私密插画收藏。
- 小说详情、系列目录、上一篇/下一篇。
- Ugoira 播放、GIF、MP4 导出。
- 图片代理、Pixiv Web API 同源代理。
- 浅色、深色、自动主题。
- Fnb UI 组件和设计令牌。

对应 PixivFun 入口：

- `app/api/pixiv-client.ts`
- `app/stores/`
- `app/pages/search.vue`
- `app/pages/ranking.vue`
- `app/pages/artworks/[id].vue`
- `app/pages/novels/[id].vue`
- `app/pages/users/[id]/index.vue`
- `app/components/UgoiraViewer.vue`
- `server/middleware/pixiv-proxy.ts`
- `server/middleware/pximg-proxy.ts`
- `docs/design-guide.md`

## 10. Agent 按任务阅读

表中路径以 Viewer 根目录为基准，实际读取时加 `../pixiv-viewer/`。

| 任务 | 推荐阅读顺序 |
| --- | --- |
| 设置/黑名单 | `src/views/Setting/ContentsDisplay.vue` → `src/store/index.js` → `src/utils/filter/index.js` → `src/utils/storage/index.js` |
| 历史/缓存 | `src/views/Setting/History.vue` → `src/views/Setting/HistoryIllust.vue` → `src/utils/storage/siteCache.js` → `src/utils/storage/localDb.js` → `src/views/Setting/ClearCache.vue` |
| 小说阅读 | `src/views/Artwork/Novel.vue` → `src/views/Artwork/components/NovelView.vue` → `src/views/Artwork/components/NovelTextConfig.vue` → `src/utils/novel.js` |
| 小说翻译 | `src/views/Artwork/Novel.vue` → `src/utils/translate/index.js` → `src/utils/storage/siteCache.js` |
| 漫画翻译 | `src/views/Artwork/index.vue` → `src/views/Artwork/components/ImageView.vue` → `src/views/Artwork/components/PicTranslatePanel.vue` → `src/utils/translate/manga.js` |
| 搜索增强 | `src/views/Search/index.vue` → `src/views/Search/components/ImageSearch.vue` → `src/views/Search/SearchUserRes.vue` → `src/views/Search/searchOptions.js` → `src/api/index.js` |
| 账户动态 | `src/views/Account/Following.vue` → `src/views/Account/components/FeedsIllusts.vue` → `src/views/Account/components/FeedsNovels.vue` → `src/views/Account/MyBookmarks.vue` → `src/views/Account/MyBookmarksNovel.vue` |
| 多布局 | `src/components/ImageLayout.vue` → `src/components/VirtualWaterfall.vue` → `src/components/VirtualJustified.vue` → `src/components/VirtualSwiper.vue` |
| PWA | `vue.config.js` → `src/lib/registerServiceWorker.js` → `public/manifest.json` → `src/views/Setting/ClearCache.vue` |

## 11. 推荐扩展顺序

1. 类型化设置中心、内容过滤、黑名单。
2. IndexedDB Repository、历史、缓存管理、备份恢复。
3. 小说阅读设置、导出、翻译。
4. 用户搜索、以图搜图、搜索补全。
5. 小说收藏、小说动态、账户聚合页。
6. 多布局、详情滑动、虚拟列表。
7. PWA。
8. Pixivision、Collections、标签故事。
9. 按需评估 App API、Live、Twitter/X 和更多 Ugoira 格式。

## 12. 许可

Viewer 使用 MIT License。若直接复制或实质性改写其代码，应保留：

```text
../pixiv-viewer/LICENSE
```

推荐流程：**阅读实现 → 提炼需求与数据流 → 在 PixivFun 架构内重新设计。**
