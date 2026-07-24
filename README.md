<div align="center">

<img src="app/assets/PixivFun.png" alt="PixivFun Logo" width="200"/>

PixivNow - Now, everyone can enjoy Pixiv!

</div>

## Deploy / 部署

### Docker (推荐)

获取当前仓库代码并进入项目根目录后运行：

```bash
# 仅首次部署且 .env 不存在时执行
cp .env.sample .env
openssl rand -hex 32
# 将输出填入 .env 的 NUXT_SESSION_SECRET
docker compose up -d
```

服务将在 `http://localhost:3000` 启动。

代码更新后重新构建：

```bash
docker compose up -d --build
```

### Vercel

将当前仓库导入 Vercel，并使用项目默认的 Nuxt 构建配置。

如果打算公开你的部署，请小心你的账单。PixivNow 可能会被滥用来大量下载图片，导致流量激增和高额费用。

### 手动构建

需要 [Node.js](https://nodejs.org/) LTS 和 [pnpm](https://pnpm.io/)。

```bash
pnpm install
pnpm build
node .output/server/index.mjs
```

## Environment Variables / 环境变量

| 变量                              | 说明                       | 默认值 |
| --------------------------------- | -------------------------- | ------ |
| `NUXT_SESSION_SECRET`             | 加密本站登录会话的服务端密钥（至少 32 字符，生产环境必填） | 开发环境临时生成 |
| `NUXT_PUBLIC_PXIMG_BASEURL_I`     | i.pximg.net 图片代理地址   | `/-/`  |
| `NUXT_PUBLIC_PXIMG_BASEURL_S`     | s.pximg.net 图片代理地址   | `/~/`  |
| `NUXT_PUBLIC_GOOGLE_ANALYTICS_ID` | Google Analytics ID        | —      |
| `NUXT_UA_BLACKLIST`               | 屏蔽的 UA 模式 (JSON 数组) | —      |

Docker 部署时可在 `docker-compose.yml` 中添加 `environment` 配置。

### 登录会话密钥（首次部署必须配置）

`NUXT_SESSION_SECRET` 是 PixivFun 用于加密本站登录 Cookie 的服务端密钥，不是 Pixiv 的 `PHPSESSID`。首次部署时生成一次并写入项目根目录的 `.env`：

```bash
openssl rand -hex 32
```

```env
NUXT_SESSION_SECRET="粘贴上一步生成的 64 位随机字符串"
```

`.env` 已被 Git 忽略，不要提交或分享。服务重启时必须继续使用同一个值；修改或丢失该密钥会使已有登录会话失效，需要重新登录。

## API

> AJAX API 的请求格式与示例：[pixiv-web-api.md](docs/pixiv-web-api.md)

### 鉴权

在 `/login` 页面提交一次 `PHPSESSID` 后，服务端验证凭据并设置加密的 HttpOnly 本站会话 Cookie。浏览器不会在 `localStorage`、URL 或后续请求头中保存和发送原始 Pixiv 凭据；代理会在服务端自动为 `/ajax/*` 等请求注入 Pixiv Cookie 和写操作所需的 CSRF token。

请求路径 `/ajax/*` 的返回结果与 `https://pixiv.net/ajax/*` 行为一致。

本站会话默认有效 30 天，但 Pixiv 源会话可能更早失效。更换 `NUXT_SESSION_SECRET` 会立即使已有本站会话失效。

会话 Cookie 会在 HTTPS 部署中自动启用 `Secure`。普通 HTTP 也可用于本机或受信任局域网中的个人部署，但通过公网访问时应配置 HTTPS。

### `/api/auth/session`

- `POST`：提交 `{ "phpsessid": "..." }`，验证成功后建立加密本站会话。
- `GET`：返回当前会话中的 Pixiv 用户信息，不返回任何凭据。
- `DELETE`：清除当前本站会话。

### `/api/illust/random`

返回随机图片（`/ajax/illust/discovery` 的语法糖）。

| 参数     | 类型                       | 说明                                                         |
| -------- | -------------------------- | ------------------------------------------------------------ |
| `max`    | `number`                   | 返回图片的个数                                               |
| `mode`   | `'all' \| 'safe' \| 'r18'` | `r18` 需登录且账号设置允许                                   |
| `format` | `'image' \| 'json'`        | `Accept` 包含 `image` 时默认为 `image`，image 模式返回重定向 |

### `/api/ranking`

`/ranking.php` 的重定向。

### `/api/user`

兼容入口。根据本站 HttpOnly 会话返回当前 Pixiv 用户信息，不接受查询参数或请求头令牌。

## UI风格指南

[Neubrutalism / 新野兽派](https://neubrutalism.com/)

[Design Guide](docs/design-guide.md)

---

_For communication and learning only._

**All data & pictures from query:** &copy;pixiv Inc. & original authors

> Source code licensed under the [Apache License 2.0](LICENSE).
>
> The PixivNow logo and brand assets are licensed under [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) — not the Apache License. See [app/assets/LICENSE](app/assets/LICENSE) for details.
>
> "Pixiv" is a trademark of pixiv Inc. This project is not affiliated with, endorsed by, or sponsored by pixiv Inc.
