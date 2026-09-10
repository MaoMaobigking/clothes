/**
 * 购物车统一验收（规格 §4.5 §13）
 *
 * 用法：cd server && npm run check:cart
 *
 * 验证点：
 *   1. garment / accessory / catalog 三种来源都能入车并查出明细
 *   2. 整套搭配拆成单品且记录来源搭配
 *   3. 改数量、删除生效；数量边界（0 / 超上限 / 非数字）被夹紧
 *   4. 跨用户一律 404，读不到也删不掉、改不动别人的车
 *   5. feature2_cart_items 存量搬迁后数量正确，搬完删表且重复迁移不翻倍
 *   6. 功能四场景新品以 catalog 入车后能被查出（旧实现会静默丢失）
 *   7. hasOutfitInCart 仍能驱动功能三的搭配优惠价
 */
import { closeDb, execute, getAll, getOne, initDb, migrateCartForCheck } from '../db/mysql.mjs'
import { wxLogin } from '../services/auth/index.mjs'
import * as garmentService from '../services/wardrobe/garment.mjs'
import * as cartService from '../services/commerce/cart.mjs'
import { ensureAccessories } from '../services/wardrobe/accessory.mjs'
import { ensureSceneCatalog } from '../services/scene/index.mjs'
import { generateOutfits } from '../services/wardrobe/outfit.mjs'

let failed = 0
function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed += 1
}

async function expectStatus(label, fn, status) {
  try {
    await fn()
    check(label, false, '没有抛错')
  } catch (error) {
    check(label, error.status === status, `status=${error.status} code=${error.code}`)
  }
}

await initDb()

try {
  const stamp = Date.now().toString(36)
  const a = await wxLogin(`cart_a_${stamp}`)
  const b = await wxLogin(`cart_b_${stamp}`)

  await ensureAccessories()
  await ensureSceneCatalog()

  const garmentsA = await garmentService.listGarments(a.userId)
  const garmentsB = await garmentService.listGarments(b.userId)
  const garmentA = garmentsA[0]
  const garmentB = garmentsB[0]
  const accessory = await getOne('SELECT id FROM accessories ORDER BY id ASC LIMIT 1')
  const catalog = await getOne('SELECT id FROM scene_catalog ORDER BY id ASC LIMIT 1')

  console.log('\n【1】三种来源都能入车并查出明细')
  await cartService.addItem(a.userId, { itemType: 'garment', itemId: garmentA.id })
  await cartService.addItem(a.userId, { itemType: 'accessory', itemId: accessory.id })
  await cartService.addItem(a.userId, { itemType: 'catalog', itemId: catalog.id })
  const cart1 = await cartService.listCart(a.userId)
  const byType = (type) => cart1.items.find((item) => item.itemType === type)
  check('garment 可入车', Boolean(byType('garment')))
  check('accessory 可入车', Boolean(byType('accessory')))
  check('catalog 可入车（旧实现会被静默丢弃）', Boolean(byType('catalog')))
  check(
    '三条都解析出了真实明细',
    cart1.items.every((item) => item.available && item.name),
  )
  check(
    '明细带价格，可用于合计',
    cart1.items.every((item) => typeof item.price === 'number'),
  )
  check('count 是数量之和', cart1.count === cart1.items.reduce((s, i) => s + i.quantity, 0))

  console.log('\n【2】重复加购累加数量而不是新增行')
  await cartService.addItem(a.userId, { itemType: 'accessory', itemId: accessory.id, quantity: 2 })
  const cart2 = await cartService.listCart(a.userId)
  check('行数不变', cart2.items.length === cart1.items.length, `${cart2.items.length}`)
  check('数量累加为 3', cart2.items.find((item) => item.itemType === 'accessory')?.quantity === 3)

  console.log('\n【3】整套搭配拆成单品并记录来源')
  const batch = await generateOutfits(a.userId, {})
  const outfit = (batch.outfits || [])[0]
  const cart3 = await cartService.addOutfitToCart(a.userId, outfit.id)
  const fromOutfit = cart3.items.filter((item) => String(item.sourceOutfitId) === String(outfit.id))
  check('搭配单品已入车', fromOutfit.length > 0, `${fromOutfit.length} 件`)
  check(
    '来源搭配 id 被记录',
    fromOutfit.every((item) => item.sourceOutfitId === String(outfit.id)),
  )
  check(
    '拆出来的都是 garment',
    fromOutfit.every((item) => item.itemType === 'garment'),
  )
  await expectStatus('加购不存在的搭配返回 404', () => cartService.addOutfitToCart(a.userId, 99999999), 404)
  await expectStatus('B 加购 A 的搭配返回 404', () => cartService.addOutfitToCart(b.userId, outfit.id), 404)

  console.log('\n【4】改数量与删除')
  const target = (await cartService.listCart(a.userId)).items[0]
  const updated = await cartService.setCartQuantity(a.userId, target.cartId, 5)
  check('数量改成 5', updated.quantity === 5)
  const same = await cartService.setCartQuantity(a.userId, target.cartId, 5)
  check('改成相同数量不会误判 404', same.quantity === 5)
  check('数量 0 被夹到 1', (await cartService.setCartQuantity(a.userId, target.cartId, 0)).quantity === 1)
  check('超上限被夹到 99', (await cartService.setCartQuantity(a.userId, target.cartId, 1000)).quantity === 99)
  check('非数字回落到 1', (await cartService.setCartQuantity(a.userId, target.cartId, 'abc')).quantity === 1)
  check('删除生效', await cartService.removeItem(a.userId, target.cartId))
  check(
    '删除后列表里没有它',
    (await cartService.listCart(a.userId)).items.every((item) => item.cartId !== target.cartId),
  )

  console.log('\n【5】跨用户隔离')
  const aItem = (await cartService.listCart(a.userId)).items[0]
  await cartService.addItem(b.userId, { itemType: 'accessory', itemId: accessory.id })
  const bCart = await cartService.listCart(b.userId)
  check(
    'B 看不到 A 的条目',
    bCart.items.every((item) => item.cartId !== aItem.cartId),
  )
  check('B 删不掉 A 的条目', (await cartService.removeItem(b.userId, aItem.cartId)) === false)
  await expectStatus('B 改不动 A 的数量', () => cartService.setCartQuantity(b.userId, aItem.cartId, 9), 404)
  check(
    'A 的条目仍在',
    (await cartService.listCart(a.userId)).items.some((item) => item.cartId === aItem.cartId),
  )
  await expectStatus(
    'A 加购 B 的衣物返回 404',
    () => cartService.addItem(a.userId, { itemType: 'garment', itemId: garmentB.id }),
    404,
  )
  await expectStatus(
    '非法 itemType 返回 400',
    () => cartService.addItem(a.userId, { itemType: 'hack', itemId: garmentA.id }),
    400,
  )

  console.log('\n【6】feature2_cart_items 存量搬迁并删表')
  // 旧表在正常库里已经被 migrateCart() 删掉了，这里重建一张一模一样的来验迁移逻辑：
  // 造两行同衣物的存量 → 跑迁移 → 数量应合并为 5 且旧表被 DROP。
  const legacyGarment = garmentsA[1] || garmentA
  await execute('DROP TABLE IF EXISTS feature2_cart_items')
  await execute(
    `CREATE TABLE feature2_cart_items (
       id INT AUTO_INCREMENT PRIMARY KEY,
       user_id INT NOT NULL,
       source_outfit_id INT NULL,
       garment_id VARCHAR(64) NOT NULL,
       quantity INT NOT NULL DEFAULT 1,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
  )
  await execute('DELETE FROM cart_items WHERE user_id = ? AND item_type = ? AND item_id = ?', [
    a.userId,
    'garment',
    legacyGarment.id,
  ])
  await execute(
    `INSERT INTO feature2_cart_items (user_id, source_outfit_id, garment_id, quantity)
     VALUES (?, NULL, ?, 2), (?, NULL, ?, 3)`,
    [a.userId, legacyGarment.id, a.userId, legacyGarment.id],
  )
  await migrateCartForCheck()
  const migrated = (await cartService.listCart(a.userId)).items.find(
    (item) => item.itemType === 'garment' && item.itemId === legacyGarment.id,
  )
  check('存量已搬进 cart_items', Boolean(migrated))
  check('同一件衣物的多行数量合并为 5', migrated?.quantity === 5, `quantity=${migrated?.quantity}`)
  const dropped = await getAll(
    `SELECT TABLE_NAME AS name FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'feature2_cart_items'`,
  )
  check('旧表搬完即被 DROP', dropped.length === 0)
  // 再跑一次：表已不存在，整段跳过，数量不能翻倍
  await migrateCartForCheck()
  const again = (await cartService.listCart(a.userId)).items.find(
    (item) => item.itemType === 'garment' && item.itemId === legacyGarment.id,
  )
  check('重复迁移不翻倍（表已删即幂等）', again?.quantity === 5, `quantity=${again?.quantity}`)

  console.log('\n【7】历史脏数据改判与搭配优惠')
  // 模拟功能四旧写法：scene_catalog 的 id 以 garment 类型入车
  await execute('DELETE FROM cart_items WHERE user_id = ? AND item_id = ?', [a.userId, catalog.id])
  await execute(`INSERT INTO cart_items (user_id, item_type, item_id, quantity) VALUES (?, 'garment', ?, 1)`, [
    a.userId,
    catalog.id,
  ])
  await migrateCartForCheck()
  const fixed = (await cartService.listCart(a.userId)).items.find((item) => item.itemId === catalog.id)
  check('脏数据被改判成 catalog', fixed?.itemType === 'catalog')
  check('改判后明细能查出来', fixed?.available === true, fixed?.name)

  const outfitGarmentIds = outfit.items.map((entry) => entry.garment.id)
  // 【4】把 items[0] 删掉了，而那正好是这套搭配的一件衣物。
  // 搭配优惠要求整套齐全，所以先补回来再断言。
  await cartService.addOutfitToCart(a.userId, outfit.id)
  check('购物车含整套服装 → 触发搭配优惠', await cartService.hasOutfitInCart(a.userId, outfitGarmentIds))
  check('B 的购物车不触发优惠', (await cartService.hasOutfitInCart(b.userId, outfitGarmentIds)) === false)
  check('空清单不触发优惠', (await cartService.hasOutfitInCart(a.userId, [])) === false)
  // 缺一件就该回原价，这是 §9.7「未包含时显示原价」的判定边界
  await cartService.removeItem(
    a.userId,
    (await cartService.listCart(a.userId)).items.find((item) => item.itemId === outfitGarmentIds[0]).cartId,
  )
  check('缺一件就不再触发优惠', (await cartService.hasOutfitInCart(a.userId, outfitGarmentIds)) === false)

  console.log(failed === 0 ? '\n🎉 购物车统一验收全部通过\n' : `\n❌ 有 ${failed} 项未通过\n`)
} catch (error) {
  console.error('\n💥 验收脚本异常：', error)
  failed += 1
} finally {
  await closeDb()
}

process.exit(failed === 0 ? 0 : 1)
