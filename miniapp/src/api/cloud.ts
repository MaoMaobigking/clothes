/*
 * 云开发接入层。
 *
 * 只有「注入了 VITE_CLOUD_ENV 且当前是微信小程序」时才启用；否则一切照旧走
 * uni.request。这条开关是刻意的 —— H5 端和本机开发根本不需要云函数绕一圈，
 * 而且云开发只有微信小程序有。做成开关而不是替换，才不会把已经跑通的两条
 * 链路（H5 同源 / 开发者工具直连 127.0.0.1）弄坏。
 *
 * 打包体验版：
 *   VITE_CLOUD_ENV=你的环境ID npm run build:mp-weixin
 */

/** 云开发环境 ID。空 = 不启用云开发。 */
export const CLOUD_ENV = (import.meta.env.VITE_CLOUD_ENV as string | undefined) || ''

/*
 * 小程序全局对象。就地声明而不是装 miniprogram-api-typings ——
 * 本文件只用到 wx.cloud，而 uni 自带的 d.ts 里恰好没有它。
 * 所有使用点都在 #ifdef MP-WEIXIN 里，别的端编译时整段不存在。
 */
declare const wx: any

/** 云存储里静态图的根目录，形如 cloud://xxx.yyy/images。空 = 图片仍打在包里。 */
export const CLOUD_IMG_BASE = (import.meta.env.VITE_CLOUD_IMG_BASE as string | undefined) || ''

export const USE_CLOUD = (() => {
  // #ifdef MP-WEIXIN
  return !!CLOUD_ENV
  // #endif
  // #ifndef MP-WEIXIN
  return false
  // #endif
})()

/**
 * wx.cloud.init 只能调一次，重复调会告警。用一个 Promise 缓存住，
 * 让所有并发的首个请求都等同一次初始化，而不是各自 init 一遍。
 */
let ready: Promise<void> | null = null

export function initCloud(): Promise<void> {
  if (!USE_CLOUD) return Promise.resolve()
  if (ready) return ready
  ready = new Promise<void>((resolve, reject) => {
    // #ifdef MP-WEIXIN
    const wxc = (wx as any)?.cloud
    if (!wxc) {
      reject(new Error('当前基础库不支持云开发，请把调试基础库调到 2.2.3 以上'))
      return
    }
    try {
      wxc.init({ env: CLOUD_ENV, traceUser: false })
      resolve()
    } catch (err: any) {
      reject(new Error(err?.message || '云开发初始化失败'))
    }
    // #endif
    // #ifndef MP-WEIXIN
    resolve()
    // #endif
  })
  return ready
}

interface CloudReply {
  statusCode: number
  data: any
}

/** 走云函数发一个 HTTP 请求。返回结构和 uni.request 的 success 回调对齐，方便上层复用。 */
export async function cloudRequest(payload: {
  url: string
  method?: string
  data?: any
  header?: Record<string, string>
}): Promise<CloudReply> {
  await initCloud()
  // #ifdef MP-WEIXIN
  const res: any = await (wx as any).cloud.callFunction({
    name: 'api',
    data: {
      action: 'request',
      path: payload.url,
      method: payload.method || 'GET',
      data: payload.data,
      header: payload.header,
    },
  })
  const result = res?.result
  if (!result) throw new Error('云函数无返回，检查 api 函数是否已部署')
  return { statusCode: result.statusCode ?? 200, data: result.data }
  // #endif
  // #ifndef MP-WEIXIN
  throw new Error('cloudRequest 只在微信小程序端可用')
  // #endif
}

/**
 * 上传一张图到云存储。
 *
 * 返回两个地址，各有各的用处：
 * - `url` 是 getTempFileURL 换来的 https 链接，给后端下载用。云存储只给
 *   cloud:// 协议，只有微信端认得，后端（以及后端再转给阿里百炼）拿到是
 *   下载不了的，必须换。代价是这个链接约 2 小时过期，只能当场用掉。
 * - `fileID` 是永久的 cloud:// 地址，`<image src>` 原生支持且免域名配置。
 *   落库存它，衣橱列表才不会两小时后集体图裂。
 */
export async function cloudUploadImage(filePath: string, dir = 'uploads'): Promise<{ url: string; fileID: string }> {
  await initCloud()
  // #ifdef MP-WEIXIN
  const ext = (filePath.match(/\.(\w+)$/)?.[1] || 'png').toLowerCase()
  const key = `${dir}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const up: any = await (wx as any).cloud.uploadFile({ cloudPath: key, filePath })
  if (!up?.fileID) throw new Error('云存储上传失败')
  const res: any = await (wx as any).cloud.callFunction({
    name: 'api',
    data: { action: 'fileUrl', fileID: up.fileID },
  })
  const url = res?.result?.data?.urls?.[0]
  if (!url) throw new Error('取云存储下载地址失败')
  return { url, fileID: up.fileID }
  // #endif
  // #ifndef MP-WEIXIN
  throw new Error('cloudUploadImage 只在微信小程序端可用')
  // #endif
}

/**
 * 把包内静态图路径映射到云存储。
 *
 * `/static/images/scene/daily.jpg` → `cloud://env/images/scene/daily.jpg`
 *
 * 没配 CLOUD_IMG_BASE 就原样返回 —— 这样同一份代码既能跑「图在包里」的
 * 本地调试，也能跑「图在云上」的体验版，不用改任何调用点。
 */
export function assetUrl(path: string): string {
  // #ifndef MP-WEIXIN
  // H5 没有包体上限，图仍在本地；这里若换成 cloud:// 浏览器根本加载不出来
  return path
  // #endif
  // #ifdef MP-WEIXIN
  if (!CLOUD_IMG_BASE || !path) return path
  if (!path.startsWith('/static/images/')) return path
  return CLOUD_IMG_BASE.replace(/\/$/, '') + path.slice('/static/images'.length)
  // #endif
}

/**
 * 递归把接口返回里的包内图片路径改写成云存储地址。
 *
 * 为什么非得在运行时再来一刀：`vite.config.ts` 里那个替换是编译期的，
 * 只看得见源码里的字面量。而商城目录、场景搭配、配饰这三块的图片路径存在
 * `server/seed.json`、`server/scene-catalog.json`、`server/seed-accessories.json`
 * 里，是接口返回的字符串，编译期完全看不到。漏了这一刀的后果很阴：本地开发
 * 和 H5 一切正常（图就在包里），只有体验版真机上这三块的图会集体裂开。
 *
 * 放在 http 层而不是各页面各 api 模块里，是因为字段名压根不统一
 * （`img` / `imageUrl` / `cover` 混着来），逐个补漏必然漏。
 *
 * 没配 CLOUD_IMG_BASE 时第一行就返回，H5 和本机开发零开销。
 */
export function rewriteAssetPaths<T>(payload: T): T {
  if (!CLOUD_IMG_BASE) return payload
  return walk(payload) as T
}

function walk(node: any): any {
  if (typeof node === 'string') {
    if (node.startsWith('/static/images/')) return assetUrl(node)
    // seed.json 里有一批老数据写成 /images/xxx，漏了 /static 前缀。
    // 顺手兜住：已经入库的行不会因为改了 JSON 就自动更新。
    if (node.startsWith('/images/')) return assetUrl(`/static${node}`)
    return node
  }
  if (Array.isArray(node)) return node.map(walk)
  // 只处理普通对象。响应体是 JSON.parse 出来的，不会有环，也不会有类实例。
  if (node && typeof node === 'object') {
    const out: Record<string, any> = {}
    for (const key of Object.keys(node)) out[key] = walk(node[key])
    return out
  }
  return node
}
