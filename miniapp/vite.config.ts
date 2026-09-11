import { defineConfig, loadEnv, type Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'

/*
 * 静态图出包。
 *
 * 微信小程序主包上限 2 MB，而 src/static/images 有 3.5 MB —— 图必须离开包体，
 * 这不是优化，是能不能上传的问题。注入 VITE_CLOUD_IMG_BASE 后，这个插件在
 * 编译期把源码里所有 `/static/images/...` 改写成 `<base>/...`；产物里被 uni
 * 无条件拷进去的那份图，由 scripts/strip-static-images.mjs 收尾删掉。
 *
 * base 填什么决定图放哪，两种都支持，前端代码不用改：
 *   cloud://你的环境.xxx/images    → 云存储（微信原生支持，免域名配置）
 *   http://你的IP:8787/images      → 你自己的服务器托管
 *
 * 为什么用构建期替换而不是运行时包一层 assetUrl()：引用点 61 处，散在 .ts
 * 常量、模板字符串和 .vue 模板属性里，逐个包既容易漏又难回滚；而这里 base
 * 是构建期常量，纯前缀替换，替换完连一次函数调用都不剩。
 *
 * 不注入这个变量时插件整个不装 —— H5 和本地开发的链路一个字节都不变。
 */
function rewriteStaticImages(base: string): Plugin {
  const FROM = '/static/images'
  const to = base.replace(/\/$/, '')
  return {
    name: 'rewrite-static-images',
    enforce: 'pre',
    transform(code, id) {
      // cloud.ts 里的 assetUrl 自己要拿这个前缀做判断，替了它就永远不匹配了
      if (id.includes('node_modules') || id.includes('utils/cloud.ts')) return null
      /*
       * 只处理 .ts。.vue 模板里的 `<image src="/static/...">` 会被 uni 的
       * transformAssetUrls 当成资源引用提升成 import，改成 cloud:// 之后
       * 它按 URL 解析、只留 pathname，构建直接失败。模板里的引用请写成
       * 动态绑定 `:src="assetUrl('/static/images/x')"`，走运行时那条路。
       */
      if (!/\.ts(\?|$)/.test(id)) return null
      if (!code.includes(FROM)) return null
      return { code: code.split(FROM).join(to), map: null }
    },
  }
}

const IMG_BASE = process.env.VITE_CLOUD_IMG_BASE || ''

/*
 * 给 API 域名注入 <link rel="preconnect">。
 *
 * 2026-09-11 性能基线（docs/perf-baseline.md）里 Lighthouse 明确点名这一条，
 * 估算能省 199 ms：跨域的第一个请求要先走 DNS 查询 + TCP 握手 + TLS 协商，
 * 而这三步完全可以在 HTML 解析阶段就并行开始，不用等 JS 跑起来发请求时才做。
 *
 * 只在「API 和页面不同源」时才注入：
 * H5 默认 VITE_API_BASE_URL 为空（同源走 Vite proxy），同源做 preconnect 毫无意义，
 * 反而多一条浏览器要维护的连接。
 *
 * crossorigin 必须带 —— XHR/fetch 是 CORS 请求，不带这个属性预热的是
 * 「非 CORS 连接」，实际请求时浏览器会另开一条，preconnect 就白做了。
 * 这是这条优化最常见的写错方式。
 */
function preconnectApi(apiBase: string): Plugin {
  return {
    name: 'preconnect-api',
    transformIndexHtml() {
      let origin = ''
      try {
        origin = new URL(apiBase).origin
      } catch {
        return [] // 不是合法绝对地址（同源或没配），不注入
      }
      return [
        { tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head' },
        // DNS 预解析兜底：少数不支持 preconnect 的浏览器至少能省掉 DNS 那一段
        { tag: 'link', attrs: { rel: 'dns-prefetch', href: origin }, injectTo: 'head' },
      ]
    },
  }
}

export default defineConfig(({ mode }) => {
  /*
   * 取 VITE_CLOUD_IMG_BASE 的两条来源，都支持：
   * - miniapp/.env.production 里写死（推荐，免去 Windows 上设环境变量的引号地狱）
   * - 命令行前置 VITE_CLOUD_IMG_BASE=... npm run mp:build
   * loadEnv 会把 .env 文件和 process.env 里带 VITE_ 前缀的合起来，后者优先。
   */
  const env = loadEnv(mode, __dirname, 'VITE_')
  const imgBase = IMG_BASE || env.VITE_CLOUD_IMG_BASE || ''
  /*
   * dev server 把 /api 和 /uploads 转发到哪。
   * 优先级：命令行 API_PROXY_TARGET > .env.development 的 VITE_DEV_PROXY_TARGET > 本机默认。
   * 接同事的后端或换端口时改 .env.development 一行即可，不用动这个文件。
   */
  const proxyTarget = process.env.API_PROXY_TARGET || env.VITE_DEV_PROXY_TARGET || 'http://localhost:8787'
  // 只在小程序端改写。H5 没有包体上限，图留在本地反而更快，
  // 而 cloud:// 在浏览器里根本加载不出来。
  const rewrite = imgBase && process.env.UNI_PLATFORM === 'mp-weixin'
  // preconnect 只对 H5 有意义：小程序没有 HTML，也没有 DNS 预解析这回事
  const apiBase = env.VITE_API_BASE_URL || ''
  const wantPreconnect = process.env.UNI_PLATFORM !== 'mp-weixin' && apiBase

  return {
    // 插件放 uni() 前面：两个都是 enforce:'pre'，同级按数组顺序跑，
    // 必须赶在 vue 插件把 SFC 编译掉之前替换模板里的字符串
    plugins: [
      ...(rewrite ? [rewriteStaticImages(imgBase)] : []),
      ...(wantPreconnect ? [preconnectApi(apiBase)] : []),
      uni(),
    ],
    server: {
      port: Number(process.env.H5_PORT || 5173),
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
