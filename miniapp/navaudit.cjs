/*
 * 全站按钮可用性检查。
 *
 * 上一版只扫了 uni.navigateTo({url}) 这种直接调用，漏掉了两类：
 *   1. 传给组件的路由属性（PageHeader 的 to=、数据表里的 route 字段）
 *      —— AI 穿搭顾问的 to="/home" 就是这么漏掉的
 *   2. 用 navigateTo 实现「返回」，页面栈只涨不落，超 10 层后静默失败
 */
const fs = require('fs'),
  path = require('path')

/*
 * pages.json 是 JSONC（uni-app 允许注释），JSON.parse 前要剥掉注释。
 * 行注释和块注释都要剥 —— 只剥 `//` 的话，pages.json 里写一段 /* ... *\/ 就会
 * 让这个校验脚本直接崩掉，而崩掉的校验脚本比没有校验更危险：CI 里看起来是红的，
 * 实际什么都没查。
 */
const stripJsonComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const pj = JSON.parse(stripJsonComments(fs.readFileSync('src/pages.json', 'utf8')))

/*
 * 路由全集 = 主包 pages + 所有分包 pages。
 *
 * ⚠️ 分包页在 pages.json 里是「root + 相对 path」两段拼出来的，
 * 漏掉 subPackages 就会让分包页的路由全部从集合里消失 ——
 * 校验器反而会把**正确的**分包路径报成「返回目标不存在」，
 * 变成一屏假告警，真问题淹在里面。改 pages.json 结构时记得同步这里。
 */
const mainRoutes = pj.pages.map((p) => '/' + p.path)
const subRoutes = (pj.subPackages || []).flatMap((sub) => (sub.pages || []).map((p) => '/' + sub.root + '/' + p.path))
const routes = new Set([...mainRoutes, ...subRoutes])
const tabs = new Set((pj.tabBar?.list || []).map((t) => '/' + t.pagePath))

const files = []
;(function walk(d) {
  for (const f of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, f.name)
    if (f.isDirectory()) walk(p)
    else if (/\.(vue|ts)$/.test(f.name)) files.push(p)
  }
})('src')

const issues = []
const add = (f, line, kind, detail) => issues.push({ f, line, kind, detail })
const lineOf = (src, i) => src.slice(0, i).split('\n').length
const isDynamic = (u) => u.includes('${') || u.includes('+')

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8')
  let m

  // A. uni.navigateTo / redirectTo / switchTab / reLaunch
  const navRe = /uni\.(navigateTo|redirectTo|switchTab|reLaunch)\s*\(\s*\{[\s\S]{0,300}?url\s*:\s*([`'"])([^`'"]*)\2/g
  while ((m = navRe.exec(src))) {
    const [api, url] = [m[1], m[3]]
    if (isDynamic(url)) continue
    const base = url.split('?')[0]
    if (!routes.has(base)) add(f, lineOf(src, m.index), 'ROUTE_MISSING', `${api} -> ${url}`)
    else if (tabs.has(base) && api === 'navigateTo') add(f, lineOf(src, m.index), 'TAB_WRONG_API', `${api} -> ${url}`)
  }

  // B. PageHeader 的 to= 返回目标
  //    栈深问题已由 PageHeader.back() 集中处理（navigateBack / redirectTo），
  //    这里只需校验路由存在性
  const toRe = /<PageHeader[^>]*?\bto="([^"]*)"/gs
  while ((m = toRe.exec(src))) {
    const url = m[1]
    if (isDynamic(url)) continue
    const base = url.split('?')[0]
    if (!routes.has(base)) add(f, lineOf(src, m.index), 'HEADER_TO_MISSING', `PageHeader to="${url}"`)
  }

  // C. 数据表里的 route 字段
  const routeRe = /\broute\s*:\s*(['"`])([^'"`]*)\1/g
  while ((m = routeRe.exec(src))) {
    const url = m[2]
    if (isDynamic(url) || !url.startsWith('/')) continue
    const base = url.split('?')[0]
    if (!routes.has(base)) add(f, lineOf(src, m.index), 'DATA_ROUTE_MISSING', `route: '${url}'`)
  }
}

const order = ['ROUTE_MISSING', 'HEADER_TO_MISSING', 'DATA_ROUTE_MISSING', 'TAB_WRONG_API', 'HEADER_TO_PUSHES']
const LABEL = {
  ROUTE_MISSING: '❌ 路由不存在 —— 点了没反应',
  HEADER_TO_MISSING: '❌ 返回目标不存在 —— 返回键失灵',
  DATA_ROUTE_MISSING: '❌ 数据表里的路由不存在',
  TAB_WRONG_API: '❌ tabBar 页误用 navigateTo —— 必定失败',
  HEADER_TO_PUSHES: '⚠️  返回用 navigateTo 前进 —— 页面栈只涨不落',
}

console.log(`扫描 ${files.length} 个文件，${routes.size} 条路由\n`)
for (const k of order) {
  const list = issues.filter((i) => i.kind === k)
  if (!list.length) continue
  console.log(`${LABEL[k]}  (${list.length})`)
  for (const i of list) console.log(`   ${i.f}:${i.line}  ${i.detail}`)
  console.log()
}
if (!issues.length) console.log('未发现问题')
