<div align="center">
  <img src="app/assets/PixivFun.png" alt="PixivFun" width="200">
  <p>面向个人部署的定制化增强 Pixiv 阅读站。</p>
</div>

## 当前增强功能

- 首页：今日排行、探索发现、随机背景作品与快捷入口；作品卡图片悬浮放大仅在主页启用。
- 作品页：新版详情布局、多图展开、作者信息与关注、默认折叠评论，以及统一样式的相关作品卡片。
- 瀑布阅读：作品页左下角樱花入口，支持瀑布与横竖图行对齐两种排版、1–12 列、`small` / `regular` / 原图三档画质，并持久化排版、列数和画质设置。
- 原图阅读：支持后台顺序预载及完成状态提示、单页原图查看、左右翻页、页码进度和强制双页模式。
- 作品下载：单图直接下载，多图按原始扩展名打包为 ZIP。
- 阅读交互：工具面板自动收起、列数切换动画、移动端布局适配，调试入口固定排列在阅读入口上方。
- 站点细节：普通网页保留原站点图标，并补充单独打开图片资源时使用的图标资源。
- 登录安全：Pixiv 凭据由服务端加密保存在 HttpOnly Cookie 中，不写入浏览器 `localStorage`。

## 本地运行

需要 Node.js LTS 和 pnpm。

```bash
pnpm install
cp .env.sample .env
openssl rand -hex 32
```

将生成的随机字符串写入 `.env`：

```env
NUXT_SESSION_SECRET="生成的随机字符串"
```

启动开发服务器：

```bash
pnpm dev
```

默认访问地址为 <http://localhost:3000>。

## Docker 部署

先按上述方式创建并配置 `.env`，然后运行：

```bash
docker compose up -d --build
```

默认访问地址仍为 <http://localhost:3000>。如需修改端口，可在 `.env` 中设置：

```env
PIXIVNOW_PORT=8080
```

## 登录说明

在网站登录页填入 Pixiv 的 `PHPSESSID` 即可建立登录会话。凭据由服务端加密后保存在 HttpOnly Cookie 中，不会写入 `localStorage`。

请固定使用同一个 `NUXT_SESSION_SECRET`。修改或丢失该密钥会使现有登录状态失效，需要重新登录。`.env` 已被 Git 忽略，请勿提交或分享。

## 网络代理

在 macOS 上，服务端会自动读取系统 HTTP/HTTPS 代理，因此 Clash 只开启“系统代理”也能代理 Pixiv API 与图片请求，切换后最多约 5 秒生效。

其他系统或需要覆盖自动检测时，可以在 `.env` 中配置：

```env
PIXIVFUN_PROXY="http://127.0.0.1:7890"
```

也兼容标准的 `HTTPS_PROXY`、`HTTP_PROXY` 环境变量。修改 `.env` 后需要重新启动服务。

## 常用命令

| 命令           | 用途             |
| -------------- | ---------------- |
| `pnpm dev`     | 启动开发服务器   |
| `pnpm test`    | 运行测试         |
| `pnpm build`   | 构建生产版本     |
| `pnpm preview` | 预览生产构建结果 |

## 说明

本项目仅供个人学习与使用，作品数据及图片版权归 pixiv Inc. 与原作者所有。本项目与 pixiv Inc. 无隶属、赞助或官方合作关系。

源代码基于 [Apache License 2.0](LICENSE) 发布；品牌素材许可见 [app/assets/LICENSE](app/assets/LICENSE)。
