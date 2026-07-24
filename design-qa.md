# Design QA

## Visual truth

- Source: `.design-qa/l2lWz.png` (`主页-x`, 1440 × 1581)
- Source: `.design-qa/uCWSI.png` (`主页-x-侧边栏`, 1440 × 1581)
- Source: `.design-qa/reference-login-narrow.png` (reviewed login layout, 2796 × 1632; normalized to 2048 × 1195)
- Source: `.design-qa/reference-artwork-card-target.png` (Pixiv-style target card, 476 × 524)
- Source: `.design-qa/reference-artwork-card-old.png` (reviewed obstructive card state)
- Source: `.design-qa/reference-page-count-pill.png` (reviewed multi-image count badge, 122 × 80 at 2× source density)
- Implementation: `.design-qa/home-logo-footer-fixed.png`
- Implementation: `.design-qa/home-sidebar-open.png`
- Responsive implementation: `.design-qa/home-logo-footer-mobile.png`
- Implementation: `.design-qa/login-wide-fixed-2048.png`
- Responsive implementation: `.design-qa/login-mobile-fixed.png`
- Implementation focused card: `.design-qa/artwork-card-focused-fixed.png`
- Full-view comparison: `.design-qa/home-logo-footer-comparison.png`
- Focused sidebar comparison: `.design-qa/sidebar-comparison.png`
- Login layout comparison: `.design-qa/login-layout-comparison.png`
- Artwork card comparison: `.design-qa/artwork-card-comparison.png`
- Artwork count badge implementation: `.design-qa/artwork-badge-fixed.png`
- Artwork count badge comparison: `.design-qa/page-count-pill-comparison.png`

## Verified states

- Desktop viewport: 1440 × 960 CSS pixels, light theme, guest session, home route.
- Home comparison: first 1581 pixels of the desktop page, sidebar closed.
- Sidebar comparison: first 960 pixels of the desktop page, sidebar open.
- Mobile viewport: 390 × 813 CSS pixels, light theme, guest session.
- Login comparison: 2048 × 1195 CSS pixels at density 1. The 2796 × 1632 source capture was normalized to the matching 2048 × 1195 viewport before comparison.
- Artwork card comparison: target source 476 × 524; implementation element 160 × 225 at density 1, resized proportionally to 524px height for focused structural comparison.
- Artwork count badge comparison: source and implementation are shown together in a focused 264 × 80 comparison. The source carries 144dpi metadata; the comparison preserves its supplied pixel size because the user selected the visible screenshot treatment rather than a CSS-size specification.

## Required fidelity surfaces

- Typography: Geist is used throughout; logo, headings, body text, metadata, and muted labels follow the reference hierarchy.
- Spacing: hero height is 610px; desktop hero content begins at 125px; content cards use the reference 16px rhythm; sidebar is 248px wide and begins below the 64px header.
- Spacing: the login surface is 1040px wide at desktop with two columns; below 860px it becomes one column. Artwork thumbnails keep a 1:1 media area with metadata below.
- Colors: background, surface, primary blue, muted text, borders, soft panels, pink accent, and dark hero overlay use the extracted Pencil tokens.
- Image quality: the reference placeholders are replaced by live Pixiv artwork images with cover cropping and responsive sizing. The page header and hero both use the supplied transparent `app/assets/PixivFun.png` brand asset rather than an HTML text approximation.
- Copy: navigation and content labels follow the reference language while mapping to routes and actions that exist in the application.
- Image quality: artwork cards no longer use a fixed 120px image strip. Images use square cover cropping inside an independent 16px rounded media region; title and author never cover the image.
- Icons: multi-image counts use a filled overlapping-page icon and number inside a compact translucent dark badge at the image's top-right corner.

## Interaction checks

- Numeric artwork ID search routes directly to `/artworks/:id`.
- Keyword search behavior remains available.
- Quick link switches the home feed to novels.
- Featured carousel advances and updates its artwork target.
- Sidebar opens as an overlay, shows the active route, and closes normally.
- Guest status card and following panel retain visible login actions near the start of the page.
- Guest discovery is intentionally capped to ten artwork cards and six novel cards.
- Mobile layout has no horizontal overflow; overview panels stack and artwork cards use two columns.
- The global “探索更多 / 相关资源” link groups remain absent. The home page ends with a compact copyright-only footer.
- The discovery section no longer repeats the guest login prompt at the end of the page.
- Opening “我的页面” from the login-page sidebar keeps a single `/login?back=/` route; clicking cancel then routes to `/`.
- A manually nested `/login?back=/login?back=/` route also cancels directly to `/`.
- Desktop login layout measures 1040px with two columns; mobile login layout measures 362px with one column and no horizontal overflow.
- Desktop artwork cards measure 260 × 260 for the media region; mobile cards measure 160 × 160, with title and author below in both states.
- Browser console contains no warnings or errors.
- Production build passes with `pnpm build`.

## Comparison history

- P1: yellow page heading and underlined artwork links from the previous home page were removed.
- P1: vertically centered hero content was moved to the reference 125px top position.
- P2: header search no longer appears while the sidebar is open at the top of the home page.
- P2: guest discovery no longer renders an excessively long artwork feed.
- P1: the temporary HTML text wordmark was replaced with the supplied transparent PixivFun logo in both the header and hero.
- P1: the global “探索更多 / 相关资源” footer identified in review was removed from the application shell.
- P1: the fixed 400px login column created excessive vertical length; it was replaced by a responsive 1040px two-column surface with post-fix evidence in `.design-qa/login-layout-comparison.png`.
- P1: sidebar personal links could create `/login?back=/login?back=/`, causing cancel to reopen the login page; return targets are now sanitized and login exits use `router.replace`.
- P1: homepage overrides compressed artwork images to 120px and enclosed image plus metadata in an outer card; the shared `fnb-media-card` structure now keeps square rounded media above title and author, evidenced in `.design-qa/artwork-card-comparison.png`.
- P2: the former multi-image label was a small solid rectangle with a generic image icon; it now uses the reference's translucent dark treatment, filled overlapping-page icon, compact number, and rounded 12px shape, evidenced in `.design-qa/page-count-pill-comparison.png`.
- P2: the discovery section repeated the guest login CTA after one was already shown above; the duplicate was removed and a copyright-only footer now provides a quiet page ending.
- P3 accepted: live artwork data differs from placeholder artwork in the Pencil source.
- P3 accepted: the explicit guest status card adds one compact row before the overview panels because preserving the logged-out prompt is a product requirement.
- P3 accepted: quick-link wording uses currently implemented routes and actions.
- P3 accepted: the supplied PixivFun brand artwork contains orbiting-star details that are not present in the simplified Pencil wordmark; the supplied brand asset takes precedence.

## 2026-07-24 · 作品详情页刷新回归与新版布局

### Visual truth

- Source: `/Users/bytedance/wking/UX/pixivfun.pen#s2UUt`（`作品详情页`，1440 × 1880；通过 Pencil MCP 读取）
- Implementation full page: `.design-qa/artwork-layout-switcher/implementation-modern-1440-final-top.png`
- Implementation mobile focus: `.design-qa/artwork-layout-switcher/implementation-modern-mobile-390x844.png`

### Verified states

- Desktop: 1440 × 1000 CSS pixels，density 1，亮色主题，已登录会话，`/artworks/147480179`，`UI 新版`
- Mobile: 390 × 844 CSS pixels，density 1，亮色主题，已登录会话，`/artworks/147480179`，`UI 新版`
- Refresh: 主页与作品页均执行浏览器强制刷新；作品页刷新后继续恢复 `UI 新版`
- Console: 修复后桌面、移动端均无 `error` 日志

### Required fidelity surfaces

- 双栏桌面结构与 Pencil 一致：作品图片、作品信息、评论在左侧，作者和作品目录在右侧。
- 相关作品位于主体下方，并继续使用公共 `ArtworkList` / `ArtworkCard` 样式。
- 真实作品比例使用 `contain` 完整展示，不为匹配占位图而裁切作品内容。
- 窄屏自动切为单栏，390px 视口 `scrollWidth === clientWidth`，没有水平溢出。
- 亮色背景、粉色强调、白色面板、圆角边框与 Pencil 的视觉层级一致。

### Interaction checks

- 主页刷新后 `#__nuxt` 正常挂载，顶栏和主页内容可见。
- 作品页经典模式可加载；切换 `UI 新版` 后主图、作品信息、作者、目录、评论和相关作品可见。
- `UI 新版` 刷新后本地选择保持，页面正常挂载。
- 相关作品滚动进入视口后完成懒加载，最终全页截图无骨架占位。

### Comparison history

- P0 fixed: 风格开关模板中的 TypeScript `as` 断言被输出到普通 JavaScript 模板模块，刷新时报 `SyntaxError: Unexpected identifier 'as'` 并阻止 Nuxt 挂载；已改为 script 内的类型安全更新函数。
- P2 verified: 屏幕外相关作品初始保持懒加载骨架；滚动进入视口后全部图片正常加载，属于预期行为。
- P3 accepted: Pencil 使用示例作品和作者作品网格；实现使用实时 Pixiv 数据，并以当前作品的页面目录替代示例网格，以满足多页浏览需求。
- P3 accepted: 移动端隐藏搜索和开发风格选择文字，保留菜单、主题和账户入口，以避免顶栏溢出。

final result: passed
