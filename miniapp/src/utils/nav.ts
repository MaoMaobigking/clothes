import { ROUTES, isTabRoute, type RouteKey } from '@/constants/routes'

/*
 * 页面跳转的唯一入口。
 *
 * ── 它解决的不是「少打几个字」──
 * uni-app 的跳转有一个静默陷阱：**navigateTo 打不开 tabBar 页**。
 * 不抛错、不跳转、控制台也不一定有东西，点了就跟没点一样。
 * 这条规则原先靠注释维持，pages/order-detail、pages/orders、pages/outfits
 * 三个文件里各写了一遍「xx 是 tabBar 页，只能 switchTab」。
 * 注释复制三遍 = 迟早有第四个地方忘了写。
 *
 * go() 按 constants/routes.ts 里的 TAB_ROUTES 自动分流，忘不掉。
 *
 * ── 用法 ──
 *   go('cart')                          → navigateTo /pages/cart/index
 *   go('mall')                          → switchTab   /pages/mall/mall（自动）
 *   go('orderDetail', { id: 12 })       → /pages/order-detail/index?id=12
 *   back('home')                        → 返回上一页，没有上一页就回首页
 */

type Query = Record<string, string | number | boolean | null | undefined>

/** 拼 query。undefined / null 的键直接不带，避免拼出 ?id=undefined */
function buildUrl(key: RouteKey, query?: Query) {
  const base = ROUTES[key]
  if (!query) return base
  const pairs = Object.entries(query)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([name, value]) => `${name}=${encodeURIComponent(String(value))}`)
  return pairs.length ? `${base}?${pairs.join('&')}` : base
}

/**
 * 跳转到某页。tabBar 页自动走 switchTab，其余走 navigateTo。
 *
 * ⚠️ tabBar 页**收不到 query**：switchTab 不接受参数，这是平台限制不是这里的偷懒。
 * 真要给 tabBar 页传值，只能先写 storage 再 switchTab
 * （现成的例子见 utils/accessoryContext.ts）。所以这里传了 query 会告警，
 * 而不是悄悄丢掉 —— 悄悄丢正是最难查的那类 bug。
 */
export function go(key: RouteKey, query?: Query) {
  if (isTabRoute(key)) {
    if (query && Object.keys(query).length) {
      console.warn(`[nav] ${key} 是 tabBar 页，switchTab 不接受参数，本次 query 被忽略：`, query)
    }
    uni.switchTab({ url: ROUTES[key] })
    return
  }
  uni.navigateTo({ url: buildUrl(key, query) })
}

/** 替换当前页（不留返回栈）。tabBar 页同样自动分流。 */
export function redirect(key: RouteKey, query?: Query) {
  if (isTabRoute(key)) {
    uni.switchTab({ url: ROUTES[key] })
    return
  }
  uni.redirectTo({ url: buildUrl(key, query) })
}

/** 清空页面栈后打开。登录成功、退出登录这类要重置导航状态的场景用。 */
export function relaunch(key: RouteKey, query?: Query) {
  uni.reLaunch({ url: buildUrl(key, query) })
}

/**
 * 返回上一页；没有上一页时落到 fallback（默认首页）。
 *
 * 「没有上一页」在小程序里是真实场景：从分享卡片、扫码直接进到详情页时
 * 页面栈只有一层，navigateBack 会失败。原先只有 pages/create 想到了这点
 * （它写了 fail: () => switchTab(home)），其余 7 处 navigateBack 都是裸调。
 */
export function back(fallback: RouteKey = 'home') {
  uni.navigateBack({
    fail: () => go(fallback),
  })
}
