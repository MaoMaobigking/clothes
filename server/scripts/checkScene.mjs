/**
 * 功能四数据层与业务层验收
 *
 * 用法：cd server && npm run check:scene
 * 验证十场景、纯旧衣/新旧混搭、新品淘口令、保存模板隔离、购物车落库、
 * 以及商城目录（复用 scene_catalog）的淘口令与 catalog 入车。
 */
import { wxLogin } from '../services/auth/index.mjs'
import {
  SCENE_DEFINITIONS,
  buyOutfit,
  ensureSceneCatalog,
  findSceneOutfit,
  generateScenePlans,
  listCart,
  listSceneOutfits,
  saveOutfit,
} from '../services/scene/index.mjs'
import { listProducts } from '../services/commerce/mall.mjs'
import { addItem } from '../services/commerce/cart.mjs'
import { closeDb, getOne, initDb } from '../db/mysql.mjs'

let failed = 0
function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed++
}

await initDb()
await ensureSceneCatalog()

const stamp = Date.now().toString(36)
const a = await wxLogin(`scene_a_${stamp}`)
const b = await wxLogin(`scene_b_${stamp}`)

console.log('\n【1】十场景')
check('场景定义正好 10 个', SCENE_DEFINITIONS.length === 10)
check('场景 key 唯一', new Set(SCENE_DEFINITIONS.map((scene) => scene.key)).size === 10)

console.log('\n【2】场景方案生成')
const result = await generateScenePlans({
  userId: a.userId,
  sceneKey: 'meeting',
  season: '秋季',
  weather: { city: '杭州', temp: 22, condition: '晴', icon: '☀️' },
})
check('纯旧衣方案为 3 套', result.plans.pure.length === 3)
check('新旧混搭方案为 3 套', result.plans.mixed.length === 3)
check(
  '纯旧衣方案不出现新品',
  result.plans.pure.every((plan) => plan.newItemCount === 0),
)
check(
  '混搭方案至少出现 1 件新品',
  result.plans.mixed.every((plan) => plan.newItemCount >= 1),
)
check(
  '混搭新品都来自目录且带淘口令',
  result.plans.mixed
    .flatMap((plan) => plan.items)
    .filter((item) => item.isNew)
    .every((item) => Boolean(item.taokouling)),
)
check('激活旧衣数量大于 0', result.activatedGarmentCount > 0)

console.log('\n【3】保存模板与用户隔离')
const plan = result.plans.mixed[0]
const saved = await saveOutfit(a.userId, {
  sceneKey: 'meeting',
  title: '会议室 · 秋季',
  season: '秋季',
  mode: plan.mode,
  filterKey: 'day',
  weather: result.weather,
  composition: plan.items,
})
check('保存返回真实模板 id', saved.id > 0, `id=${saved.id}`)
check(
  '本人模板列表可见',
  (await listSceneOutfits(a.userId)).some((item) => item.id === saved.id),
)
check('B 读取 A 的模板返回 null', (await findSceneOutfit(b.userId, saved.id)) === null)
check(
  'B 的模板列表为空或没有 A 的模板',
  (await listSceneOutfits(b.userId)).every((item) => item.id !== saved.id),
)

console.log('\n【4】购物车落库')
const newIds = plan.items.filter((item) => item.isNew).map((item) => item.id)
const beforeCart = await getOne('SELECT COUNT(*) AS n FROM cart_items WHERE user_id = ?', [a.userId])
const bought = await buyOutfit(a.userId, newIds, plan.id)
const afterCart = await getOne('SELECT COUNT(*) AS n FROM cart_items WHERE user_id = ?', [a.userId])
check('购买返回的新品数量正确', bought.added.length === newIds.length)
check('cart_items 行数真实增加', Number(afterCart.n) === Number(beforeCart.n) + newIds.length)
// 购物车统一后 listCart 返回 { items, count, totalPrice }，新品是 item_type='catalog'
const aCart = await listCart(a.userId)
const bCart = await listCart(b.userId)
check(
  '购物车接口能看到刚购买的新品',
  aCart.items.some((item) => item.itemId === newIds[0]),
)
check(
  '新品以 catalog 类型入车且明细可解析',
  aCart.items.every((item) => item.itemType !== 'catalog' || item.available),
)
check(
  'B 购物车没有 A 购买的新品',
  bCart.items.every((item) => item.itemId !== newIds[0]),
)

console.log('\n【5】商城目录（§4.4 §10.6）')
const mall = await listProducts({})
check('商城目录非空', mall.items.length > 0, `${mall.items.length} 件`)
check('分类面板非空', mall.categories.length > 0, mall.categories.map((c) => c.label).join('/'))
check(
  '每件商品都带淘口令',
  mall.items.every((item) => Boolean(item.taokouling)),
  mall.items
    .filter((item) => !item.taokouling)
    .map((item) => item.id)
    .join(',') || '无缺失',
)
check(
  '每件商品都带淘宝链接',
  mall.items.every((item) => Boolean(item.taobaoUrl)),
)
const byCategory = await listProducts({ category: mall.categories[0].key })
check(
  '按品类筛选只返回该品类',
  byCategory.items.length > 0 && byCategory.items.every((item) => item.category === mall.categories[0].key),
)
check('筛选后分类面板仍是全量', byCategory.categories.length === mall.categories.length)

console.log('\n【6】商城商品入车（catalog 类型）')
const mallProduct = mall.items[0]
await addItem(a.userId, { itemType: 'catalog', itemId: mallProduct.id })
const cartAfterMall = await listCart(a.userId)
const mallRow = cartAfterMall.items.find((item) => item.itemId === mallProduct.id)
check('商城商品能在 /api/cart 查出', Boolean(mallRow), mallProduct.id)
check('入车行的类型是 catalog', mallRow?.itemType === 'catalog')
check(
  '入车行明细可解析（价格与淘口令来自服务端）',
  Boolean(mallRow?.available) && mallRow?.price === mallProduct.price && Boolean(mallRow?.taokouling),
)

console.log(failed === 0 ? '\n🎉 功能四数据层与业务层全部通过\n' : `\n❌ ${failed} 项未通过\n`)
process.exitCode = failed === 0 ? 0 : 1
await closeDb()
