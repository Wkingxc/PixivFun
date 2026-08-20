<div align="center">
  <img src="app/assets/PixivFun.png" alt="PixivFun" width="240">
  <h1>PixivFun</h1>
  <p>面向个人使用的 Pixiv 阅读、收藏整理与本地访问记录同步工具。</p>
  <p>
    <a href="https://github.com/Wkingxc/PixivFun/releases"><img alt="Release" src="https://img.shields.io/badge/release-v1.1.1-00a8ff"></a>
    <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-0078d4">
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
  </p>
</div>

> [!IMPORTANT]
> PixivFun 是非官方项目，与 pixiv Inc. 没有隶属、赞助或合作关系。请仅在遵守 Pixiv 服务条款及所在地法律法规的前提下使用。

## PixivFun 能做什么

### 浏览与发现

- 浏览今日排行、探索发现、关注更新、用户主页、插画、漫画和小说。
- 搜索标签与用户，支持标签自动补全、中文译名、Pixpedia 简介、热门作品预览和 `users入り` 收藏数筛选。
- 在列表中调节作品宽度、列数与缩略图画质，并按作品页数过滤作者作品和相关推荐。
- 屏蔽指定作者，其作品会从首页、发现、排行、搜索、关注更新和相关推荐中隐藏；自己的收藏不受影响。

### 作品详情与阅读

- 现代化作品详情页，包含多图展开、评论、相关作品、作者资料和作者作品目录。
- 作者作品目录支持滚动与翻页两种模式、当前位置定位、已读状态、多图数量和动图标识。
- 动图支持普通/原画画质、加载进度、播放暂停、逐帧进度和拖动跳转。
- 瀑布阅读支持瀑布/行对齐排版、1–12 列、小图/高清/原图画质、双页查看和可调阅读宽度。
- 原图预载与作品下载共享并发队列；可设置 1–16 个线程，预载尚未完成时也能立即下载。
- 单图保留原始格式直接保存，多图按原始扩展名打包为 ZIP。

### 收藏与访问记录

- 浏览公开与私密收藏，编辑收藏标签、公开状态并批量为作品添加标签。
- 可扫描收藏作品自身的标签，按多个标签的交集筛选并在本地分页。
- 记录已浏览作品与作者，在列表、详情和作者目录中提供跨页面已读提示。
- 通过 Google Drive `appDataFolder` 合并并同步访问记录，不上传 Pixiv 登录凭据。

### 本地应用与隐私

- Windows x64 免安装目录版；启动后驻留系统托盘并在默认浏览器中打开。
- Pixiv 凭据与 Google Refresh Token 使用本机密钥加密，浏览器仅持有 HttpOnly 会话标识。
- 请求去重与分级缓存减少重复访问；收藏、关注等写操作会自动失效相关缓存。
- 用户数据默认独立保存在系统应用数据目录，移动或更新程序目录不会覆盖个人数据。

## Windows 免安装版

从 [GitHub Releases](https://github.com/Wkingxc/PixivFun/releases) 下载 Windows 压缩包，完整解压后运行 `PixivFun.exe`。

- 应用不会创建传统桌面窗口，而是进入系统托盘并自动打开浏览器。
- 托盘菜单提供“打开 PixivFun”和“退出”。
- 本地服务默认监听 <http://localhost:3000>；端口被占用时自动回退到可用随机端口。
- 请分发和保留完整的 `PixivFun` 目录，不能只复制其中的 EXE。
- 服务日志位于 `%APPDATA%\PixivFun\logs\server.log`。

## 登录与 Google Drive

### Pixiv 登录

在登录页提交当前账号的 `PHPSESSID`。服务端验证后会将凭据加密保存在本机数据目录，后续启动会自动恢复登录状态。

`PHPSESSID` 等同于登录凭据，请勿发送给他人，也不要提交到 Git、Issue 或日志中。

### Google Drive 同步

打开侧边栏并选择“连接 Google Drive”，在浏览器中完成授权：

- **上传**：合并本地与云端记录后写入 Google Drive。
- **同步**：把云端缺少的作品和作者访问记录补充到本地。
- 同步文件仅保存在 Google Drive 的应用专用目录，Pixiv 登录凭据不会进入云端文件。

## 本地开发

需要 Node.js 24 和 pnpm 11。

```bash
pnpm install
pnpm dev
```

开发服务器默认运行在 <http://localhost:3000>。

### 网络代理

应用默认不使用代理，也不会读取系统或环境变量中的代理配置。如有需要，请在侧边栏的“网络代理”中手动填写 HTTP/HTTPS 代理地址并启用，保存后立即生效。

## 构建 Windows 正式版

版本号以 [package.json](package.json) 为唯一来源。构建前需在本地 `.env` 中配置 Google Cloud Desktop OAuth 客户端：

```env
GOOGLE_DRIVE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_DRIVE_CLIENT_SECRET="your-client-secret"
```

执行唯一的正式版构建命令：

```bash
pnpm desktop:dist
```

构建结果位于 `release/PixivFun/`。`release/` 中只保留这一份 Windows x64 未打包便携目录；发布时必须压缩并上传整个 `PixivFun` 目录。

`.env`、生成的 OAuth 配置和发布产物均被 Git 忽略。Desktop OAuth 凭据会嵌入客户端，因此不能把它视为可在客户端中保密的服务端密钥。

## 常用命令

| 命令                 | 用途                          |
| -------------------- | ----------------------------- |
| `pnpm dev`           | 启动开发服务器                |
| `pnpm test`          | 运行测试                      |
| `pnpm build`         | 构建 Nuxt 生产版本            |
| `pnpm desktop:start` | 以 Electron 开发模式启动      |
| `pnpm desktop:dist`  | 构建 Windows x64 免安装目录版 |
| `pnpm desktop:clean` | 清理桌面版暂存目录和发布目录  |

## 数据目录

| 系统    | 默认位置                                               |
| ------- | ------------------------------------------------------ |
| Windows | `%APPDATA%\PixivFun`                                   |
| macOS   | `~/Library/Application Support/PixivFun`               |
| Linux   | `$XDG_DATA_HOME/PixivFun` 或 `~/.local/share/PixivFun` |

可通过 `PIXIVFUN_DATA_DIR` 覆盖默认位置。删除数据目录会同时删除本机登录状态、访问记录、偏好设置和云同步授权。

## 许可与声明

源代码基于 [Apache License 2.0](LICENSE) 发布，品牌素材许可见 [app/assets/LICENSE](app/assets/LICENSE)。

本项目仅供个人学习与使用。通过本项目访问的作品、图片、小说及其他内容，其权利归 pixiv Inc.、原作者或其他权利人所有。使用者应自行承担账号、网络、内容访问及数据存储相关风险。
