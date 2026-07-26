<template lang="pug">
mixin GoToPixivSettings
  p 部分高级功能的效果取决于您在 Pixiv 源站的设定，请前往 #[ExternalLink(href='https://www.pixiv.net/settings/viewing' target='_blank') 浏览与显示设置] 调整。

#about-view.modern-route-page.modern-page-shell
  h1#top 关于 PixivNow
  section.intro
    Card(title='简介')
      p 一个以插画浏览体验为中心的开源项目。我们希望减少与欣赏作品无关的干扰，让您更专注于作品本身。
      h3 我们的 Slogan
      p Now, everyone can enjoy Pixiv!
      p 现在，每个人都能享受 Pixiv！

    Card(title='使用方法')
      h3 针对开发者
      p PixivNow 通过对 Pixiv 网页端请求的兼容与转发获取数据，主要接入点为 #[code /ajax/]。
      p 用户在登录页提交一次 #[code PHPSESSID] 后，服务端会验证并建立加密的 HttpOnly 本站会话。后续请求由代理在服务端自动附加 Pixiv Cookie 和写操作所需的 CSRF token，前端不再传递原始凭据。
      p 关于 AJAX API 的请求格式与示例，请参考开源仓库中 #[code docs] 文件夹中的文档。
      h3 关于 R18 / NSFW 内容
      +GoToPixivSettings

    Card#login-cookie(title='登录 Cookie（我们称之为“访问令牌”）')
      h3 这是什么
      p 本站所述的“访问令牌”指的是您在 Pixiv 源站登录账号后，由 Pixiv 设置的、键名为 #[code PHPSESSID] 的登录 cookie。
      h3 有什么用
      p 提供该 cookie 后，PixivNow 才能代您请求部分需要登录状态的功能，包括但不限于：
      ul
        li 查看更符合个人偏好的相关推荐
        li 不受未登录状态下的探索发现刷新限制
        li 访问并编辑自己的收藏夹
        li 访问 NSFW 内容（需您在 Pixiv 账号中自行开启）
        li 能够使用高级搜索（需 Pixiv Premium 会员）
      +GoToPixivSettings

    Card#account-security(title='安全警告')
      h3 说在前面
      p 请务必理解：#[strong 网页 cookie 约等于密码]。这不仅适用于 Pixiv，也适用于任何其他网站。
      p 持有它的人可能在一定范围内以您的身份访问对应服务。因此，除非您充分信任当前网站的运营方，否则不要提交 cookie。
      p 我们建议您使用专门的 Pixiv 账号，并避免在该账号上绑定过多个人信息或重要资源。
      h3 PixivNow 会窃取我的个人信息吗？
      p 本仓库公开的默认实现会使用自动生成的本机主密钥加密凭据，并将其保存在服务端数据目录；浏览器只持有不包含 Pixiv 凭据的 HttpOnly 会话标识。实现#[strong 不会]把原始凭据写入浏览器可读存储，也不会以业务目的出售或共享您的 cookie 或个人信息；凭据仅用于向 Pixiv 源站发起必要请求。
      p 但服务器在转发请求时不可避免地会接触这些信息。具体部署实例的日志、监控、反向代理配置和二次修改，都可能改变实际行为。
      p 个人本机使用无需生成或配置额外密钥；首次启动会自动创建并在后续启动中复用。
      h3 开源是否等于安全？
      p #[strong 不等于。]开源便于审计，但不能证明您访问的每一个实例都运行着未经修改且配置安全的代码。任何人都可以部署修改过的 PixivNow 实例，并诱导用户提交 cookie。
      h3 简单来说
      p 请只在您信任当前运营方时提交 cookie。PixivNow 无法为任何第三方部署实例提供安全担保。

    Card(title='免责声明')
      h3 基本服务
      p PixivNow 是非官方开源项目，主要用于学习、研究与个人浏览体验改进。项目不提供任何 SLA 或可用性保证，服务可能随时不稳定、中断或停止。
      p 请负责任地使用 ajax 与 pximg 代理服务，合理控制请求频率，避免对 Pixiv 源站或本项目服务资源造成不必要的压力。
      p 我们保留随时修改、限制、关闭或拒绝提供服务的权利，恕不另行通知。
      h3 R18 / NSFW 内容
      p PixivNow 不主动托管或发布 NSFW 资源。相关内容来自 Pixiv 源站，并受您的 Pixiv 账号设置、请求参数和源站返回结果影响。
      p 对于可能出现的 NSFW 内容，项目会尽力提供明显标记或提示，但这不构成对所有内容分类准确性的保证。我们不鼓励用户访问、传播此类资源。
      h3 用户内容与言论
      p “用户内容与言论”指的是 Pixiv 源站用户通过自我介绍、插画简介、评论区等功能发布的内容。这部分属于发表者自身的行为，我们无法有效控制。
      p 我们不会主动发布，也不鼓励传播不当内容。如果您在浏览过程中发现不当内容，建议您前往 Pixiv 源站进行举报。
      h3 版权与品牌
      p 通过本项目请求得到的数据和媒体资源，相关权利归 Pixiv、源站用户或其他权利人所有。请遵守源站规则及适用法律法规。
      p PixivNow 程序源代码通过 Apache-2.0 协议授权。
      p PixivNow 的 Logo 及品牌视觉资产以 #[ExternalLink(href='https://creativecommons.org/licenses/by-nc-sa/4.0/') CC BY-NC-SA 4.0] 协议授权。您可以自由分享和改编，但须署名、禁止商用、以相同协议共享。
      p “Pixiv” 是 pixiv Inc. 的商标。PixivNow 项目与 pixiv Inc. 没有从属、认可或赞助关系。
</template>

<script lang="ts" setup>
definePageMeta({ name: 'about' })
import Card from '~/components/Card.vue'
import ExternalLink from '~/components/ExternalLink.vue'
import { setTitle } from '~/utils/setTitle'

onMounted(() => setTitle('About'))
</script>

<style scoped lang="scss">
#about-view {
  display: grid;
  align-content: start;
  gap: 18px;
}

h1 {
  margin: 0 0 4px;
}

.intro {
  display: grid;
  gap: 18px;
}

:deep(.card p) {
  color: color-mix(in srgb, var(--pf-text) 82%, var(--pf-muted));
  line-height: 1.75;
}

:deep(.card h3) {
  margin-top: 18px;
  color: var(--pf-text);
}
</style>
