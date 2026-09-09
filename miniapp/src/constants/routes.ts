/*
 * 全站路由表。**pages.json 是唯一真源**，这里是它的 TypeScript 镜像。
 *
 * ── 为什么要有这个文件 ──
 * 全站 82 处硬编码 '/pages/xxx/yyy' 字符串，散在 35 条路由上。
 * 改一个页面路径要全局搜字符串，漏一处就是运行时白屏 —— 而路径写错
 * 不会有任何编译期报错，uni.navigateTo 只会静默失败。
 *
 * 收进来之后，路径写错变成 TS 报错（RouteKey 是字面量联合类型）。
 *
 * ── 增删页面时 ──
 * pages.json 和这里要一起改。新增页面只改 pages.json 不改这里，
 * 表里就没有对应的 key，跳转处会编译不过 —— 这正是想要的提醒方式。
 */

export const ROUTES = {
  // —— tabBar 五页 ——
  home: '/pages/home/home',
  ai: '/pages/ai/ai',
  closet: '/pages/closet/closet',
  mall: '/pages/mall/mall',
  me: '/pages/me/me',

  // —— 账号 ——
  login: '/pages/login/index',
  verify: '/pages/verify/index',
  profileEdit: '/pages/profile-edit/index',
  admin: '/pages/admin/index',

  // —— 形象 / 测试 ——
  create: '/pages/create/index',
  bodyCreate: '/pages/body-create/index',
  test: '/pages/test/index',
  result: '/pages/result/index',
  stylist: '/pages/stylist/index',

  // —— 衣橱 / 搭配 ——
  wardrobeUpload: '/pages/wardrobe-upload/index',
  wardrobeMatch: '/pages/wardrobe-match/index',
  freeMatch: '/pages/free-match/index',
  outfitResult: '/pages/outfit-result/index',
  outfits: '/pages/outfits/index',
  scene: '/pages/scene/index',
  accessory: '/pages/accessory/index',
  diary: '/pages/diary/index',

  // —— 商城 / 交易 ——
  cart: '/pages/cart/index',
  checkout: '/pages/checkout/index',
  orders: '/pages/orders/index',
  orderDetail: '/pages/order-detail/index',

  // —— 定制 ——
  custom: '/pages/custom/index',
  customCategory: '/pages/custom/category',
  customOrders: '/pages/custom/orders',
  customOrder: '/pages/custom/order',

  // —— 社区 ——
  community: '/pages/community/index',
  magazine: '/pages/magazine/index',
  magazineDetail: '/pages/magazine-detail/index',
  teachDetail: '/pages/teach-detail/index',
  shareEditor: '/pages/share-editor/index',
  shareDetail: '/pages/share-detail/index',
  myFavorites: '/pages/my-favorites/index',
  achievements: '/pages/achievements/index',
} as const

export type RouteKey = keyof typeof ROUTES

/*
 * pages.json 里 tabBar.list 的五页。
 *
 * ⚠️ 这五个**只能** uni.switchTab —— navigateTo 打 tabBar 页会静默失败
 * （不报错、不跳转，点了跟没点一样）。这条规则原先靠注释维持，
 * pages/order-detail、pages/orders、pages/outfits 三个文件里各写了一遍
 * 「商城/衣橱是 tabBar 页，只能 switchTab」。靠人记就总有一天会漏。
 *
 * 现在它是 utils/nav.ts 里 go() 的分支条件，忘不掉。
 */
export const TAB_ROUTES = ['home', 'ai', 'closet', 'mall', 'me'] as const

export type TabRouteKey = (typeof TAB_ROUTES)[number]

export function isTabRoute(key: RouteKey): key is TabRouteKey {
  return (TAB_ROUTES as readonly string[]).includes(key)
}

/*
 * 按**路径**判断（而不是按 key）。
 *
 * 给那些只拿得到路径字符串的地方用 —— 典型是 PageHeader 的 `to` prop：
 * 它是外部传进来的路径，还可能带 ?tab=share 这样的 query，
 * 所以没法收成 RouteKey（收了就得再拆一个 query prop，29 处调用点都要改）。
 *
 * PageHeader 原来自己抄了一份五页数组，这是全站第四份拷贝
 * （另外三份在 order-detail / orders / outfits 的注释里）。现在都指向这里。
 */
export const TAB_PATHS: readonly string[] = TAB_ROUTES.map((key) => ROUTES[key])

export function isTabPath(path: string) {
  return TAB_PATHS.includes(path.split('?')[0])
}
