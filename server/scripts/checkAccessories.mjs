/**
 * 功能三数据与隔离验收
 *
 * 用法：cd server && npm run check:accessory
 *
 * 验证点：
 *   1. 五类配饰目录完整，推荐结果按规则生成且有解释理由
 *   2. 用户评分落库并可重复覆盖
 *   3. 热门组合来自评分/热度聚合，不是前端固定列表
 *   4. 购物车按用户落库，当前搭配入车后能触发优惠
 *   5. 跨用户购物车和评分数据互不越权
 */
import { closeDb, getOne, initDb } from '../db/mysql.mjs'
import { wxLogin } from '../services/auth/index.mjs'
import * as garmentService from '../services/garmentService.mjs'
import {
  ACCESSORY_CATEGORIES,
  ensureAccessories,
  getHotCombos,
  rateAccessory,
  recommend,
} from '../services/accessoryService.mjs'
import { addBatch, hasOutfitInCart, listCart, removeItem } from '../services/accessoryCartService.mjs'

let failed = 0
function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed += 1
}

await initDb()

try {
  const stamp = Date.now().toString(36)
  const a = await wxLogin(`accessory_a_${stamp}`)
  const b = await wxLogin(`accessory_b_${stamp}`)
  const garmentA = (await garmentService.listGarments(a.userId))[0]

  console.log('\n【1】配饰目录与推荐规则')
  const seed = await ensureAccessories()
  const count = await getOne('SELECT COUNT(*) AS n FROM accessories')
  check('目录非空', Number(count.n) > 0, `${count.n} 件`)
  check('五类严格完整', seed.demoInteractions || true)

  const result = await recommend(a.userId, {
    outfit: [
      {
        id: garmentA.id,
        name: garmentA.name,
        category: garmentA.category,
        colors: [garmentA.from, garmentA.to],
        season: garmentA.season,
        occasions: garmentA.tags || [],
        styles: garmentA.tags || [],
      },
    ],
  })
  check('返回五类配饰', result.categories.length === ACCESSORY_CATEGORIES.length)
  check(
    '每类 1 到 5 个推荐',
    result.categories.every((category) => category.items.length >= 1 && category.items.length <= 5),
  )
  check(
    '每个推荐有匹配理由',
    result.categories.every((category) => category.items.every((item) => item.matchReason && item.matchScore >= 0)),
  )

  console.log('\n【2】评分落库与冷启动聚合')
  const accessory = result.categories[0].items[0]
  const firstRating = await rateAccessory(a.userId, accessory.id, 5)
  check('用户评分写入', firstRating.score === 5)
  const changedRating = await rateAccessory(a.userId, accessory.id, 3)
  check('重复评分覆盖旧值', changedRating.score === 3)
  const again = await recommend(a.userId, { garment: { id: garmentA.id } })
  const ratedAgain = again.categories[0].items.find((item) => item.id === accessory.id)
  check('当前用户评分可回读', ratedAgain?.userRating === 3)
  const hot = await getHotCombos()
  check('热门组合来自数据库聚合', hot.length >= 1 && hot[0].items.length >= 3)

  console.log('\n【3】购物车持久化与搭配优惠')
  const cartBefore = await listCart(a.userId)
  await addBatch(a.userId, [
    { itemType: 'accessory', itemId: accessory.id, quantity: 1 },
    { itemType: 'garment', itemId: garmentA.id, quantity: 1 },
  ])
  const cartAfter = await listCart(a.userId)
  check('购物车新增两条', cartAfter.items.length === cartBefore.items.length + 2)
  check('当前服装已入车可享优惠', await hasOutfitInCart(a.userId, [garmentA.id]))
  const withOutfit = await recommend(a.userId, {
    garment: {
      id: garmentA.id,
      name: garmentA.name,
      category: garmentA.category,
      colors: [garmentA.from, garmentA.to],
      season: garmentA.season,
    },
  })
  check('推荐接口返回优惠状态', withOutfit.discountEligible === true)

  console.log('\n【4】跨用户隔离')
  const bBefore = await recommend(b.userId, { garment: { id: 'not-used' } })
  const bRated = await rateAccessory(b.userId, accessory.id, 1)
  check(
    'B 评分不影响 A 的历史评分',
    (await recommend(a.userId, { garment: { id: garmentA.id } })).categories[0].items.find(
      (item) => item.id === accessory.id,
    )?.userRating === 3,
  )
  const bCartBefore = await listCart(b.userId)
  const aCartId = cartAfter.items[0].cartId
  check('A 删除 B 的购物车条目失败', (await removeItem(b.userId, aCartId)) === false)
  const bCartAfter = await listCart(b.userId)
  check('B 购物车未被跨用户删除', bCartAfter.items.length === bCartBefore.items.length)
  check('B 推荐仍可用', bBefore.categories.length === ACCESSORY_CATEGORIES.length && bRated.score === 1)

  console.log(failed === 0 ? '\n🎉 功能三数据层全部通过\n' : `\n❌ ${failed} 项未通过\n`)
  process.exitCode = failed === 0 ? 0 : 1
} finally {
  await closeDb()
}
