<div align="center">
  <img src="app/assets/PixivFun.png" alt="PixivFun" width="240">
  <h1>PixivFun</h1>
  <p>面向个人使用的 Pixiv 阅读、收藏管理与访问记录同步工具。</p>
  <p>
    <a href="https://github.com/Wkingxc/PixivFun/releases"><img alt="Release" src="https://img.shields.io/badge/release-v1.1.0-00a8ff"></a>
    <img alt="Windows" src="https://img.shields.io/badge/Windows-x64-0078d4">
    <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache--2.0-blue"></a>
  </p>
</div>

> [!IMPORTANT]
> PixivFun 是非官方项目，与 pixiv Inc. 没有隶属、赞助或合作关系。请仅在遵守 Pixiv 服务条款及所在地法律法规的前提下使用。

## 功能

- **浏览与发现**：今日排行、探索发现、关注更新、用户主页、插画、漫画和小说。
- **搜索增强**：标签自动补全（含中文译名）、用户搜索、热门作品预览、`users入り` 收藏数下限筛选，搜索条件在切换关键词时保持不丢失。
- **作品阅读**：新版作品详情、多图展开、相关作品、相关作者推荐、作者信息、评论折叠及动图播放。
- **作者屏蔽**：一键屏蔽作者，其作品与卡片从首页、发现、排行、搜索、关注更新和相关作品中隐藏（自己的收藏不受影响），支持在管理页随时解除。
- **流畅体验**：前端请求去重与分级缓存，列表与详情往返秒开；写操作后自动失效相关缓存。
- **瀑布阅读**：支持瀑布与横竖图行对齐、1–12 列以及小图、高清、原图三档画质。
- **原图阅读与下载**：顺序预载、左右翻页、双页模式；单图直接下载，多图按原始扩展名打包为 ZIP。
- **收藏管理**：公开/私密收藏、标签编辑、标签筛选和批量添加标签。
- **访问标记**：记录已浏览作品与作者，在列表中提供跨页面的已读提示。
- **Google Drive 同步**：通过 Drive `appDataFolder` 合并并同步已浏览作品和作者记录，不上传 Pixiv 登录凭据。
- **本地安全存储**：Pixiv 凭据与 Google Refresh Token 使用本机密钥加密，浏览器仅持有 HttpOnly 会话标识。

## Windows 免安装版

从 [GitHub Releases](https://github.com/Wkingxc/PixivFun/releases) 下载 Windows 压缩包，完整解压后运行 `PixivFun.exe`。

- 启动后不显示桌面窗口，而是进入系统托盘并自动打开浏览器。
- 托盘右键菜单仅提供“打开 PixivFun”和“退出”。
- 默认使用 <http://localhost:3000>；端口被占用时会自动选择其他可用端口。
- 程序目录可直接移动或压缩发布，但用户数据仍保存在 `%APPDATA%\PixivFun`，并不会随程序目录移动。
- 服务日志位于 `%APPDATA%\PixivFun\logs\server.log`。

## 登录与同步

### Pixiv 登录

在登录页提交当前账号的 `PHPSESSID`。服务端验证后会将凭据加密保存到本机数据目录，后续启动会自动恢复登录状态，不会把原始 Cookie 写入浏览器 `localStorage`。

`PHPSESSID` 等同于登录凭据，请勿发送给他人，也不要提交到 Git。

### Google Drive

打开侧边栏并选择“连接 Google Drive”，在浏览器中完成授权：

- **上传**：先合并本地与云端记录，再写入 Google Drive。
- **同步**：将云端缺少的作品和作者访问记录补充到本地。
- 数据文件仅保存在 Google Drive 的应用专用目录，Pixiv 登录凭据不会进入云端同步文件。

## 本地开发

需要 Node.js 24 和 pnpm 11。

```bash
pnpm install
pnpm dev
```

开发服务器默认运行在 <http://localhost:3000>。

### 网络代理

macOS 会自动读取系统 HTTP/HTTPS 代理。其他系统或需要显式覆盖时，将 `.env.sample` 复制为 `.env`：

```env
PIXIVFUN_PROXY="http://127.0.0.1:7890"
```

同时兼容 `HTTPS_PROXY` 和 `HTTP_PROXY`。修改环境变量后需要重新启动服务。

## 构建 Windows 目录版

构建前需在本地 `.env` 中配置 Google Cloud 的 Desktop OAuth 客户端：

```env
GOOGLE_DRIVE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_DRIVE_CLIENT_SECRET="your-client-secret"
```

然后执行：

```bash
pnpm desktop:dist
```

构建产物位于 `release/PixivFun/`，`release` 中只保留这一份未压缩的目录版。发布时将整个 `PixivFun` 目录压缩为 ZIP，再上传到 GitHub Release。

`.env`、生成的 OAuth 配置和 `release` 均已被 Git 忽略。Desktop OAuth 凭据会嵌入最终应用以便用户直接完成授权，因此不应把它视为能够在客户端中保密的服务端密钥。

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
