# PixivFun UI 设计规范

PixivFun 统一使用柔和表面、细描边和圆角构成的新版界面。旧版经典硬边框、硬阴影、零圆角和按压位移样式已删除，不应重新引入。

## 设计令牌

新版页面与组件统一使用 `app/assets/styles/_variables.scss` 中的 `--pf-*` 令牌：

- `--pf-bg`：页面背景
- `--pf-surface`：卡片与浮层表面
- `--pf-text` / `--pf-muted`：主次文字
- `--pf-line`：细描边与分隔线
- `--pf-blue` / `--pf-pink`：主要操作与强调色
- `--pf-soft-blue` / `--pf-soft-pink`：悬浮、选中等弱强调背景
- `--pf-card-shadow`：卡片和浮层的柔和阴影
- `--pf-skeleton`：图片与内容加载占位背景
- `--pf-font-sans` / `--pf-font-mono`：正文与等宽字体

## 组件规则

- 操作按钮使用 `FnbButton`，采用圆角、细描边与柔和悬浮反馈，不使用硬阴影或按压位移。
- 分页使用 `FnbPagination`，页面不得自行实现经典方形分页。
- 卡片、输入框、选择器、标签、弹窗和提示优先复用 `app/components/ui/` 下的共享组件。
- 插画、漫画、相关作品和推荐作品列表复用 `ArtworkList` / `ArtworkCard` 与 `fnb-media-card` 结构。
- 作品图片独立显示在上方，标题和作者信息置于图片下方，不得用信息面板遮挡图片。
- 多图数量使用图片右上角深色半透明胶囊徽标。

## 页面布局

- 常规页面使用 `.modern-route-page` 与 `.modern-page-shell`。
- 宽作品列表使用 `.modern-wide-shell`，最大宽度为 `1840px`。
- 关注更新桌面端固定六列，每页最多 60 件，即最多十行；响应式断点可降为三列或两列。
- 作品详情仅保留 `ArtworkDetailModern`，所有运行环境使用同一套新版界面。

## 主题

深色主题通过 `html.dark` 覆盖同一组 `--pf-*` 令牌。组件不得硬编码仅适用于亮色背景的边框、文字或阴影。
