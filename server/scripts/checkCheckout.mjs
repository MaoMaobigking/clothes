/**
 * 演示结算验收（收货地址 + 优惠券试算 + 下单 + 状态推进）
 *
 * 用法：cd server && npm run check:checkout
 *
 * 验证点：
 *   1. 优惠券纯函数的边界：不满门槛不减、折扣封顶、减免不超过订单金额
 *   2. 地址增删改 + 默认地址唯一
 *   3. 结算预览的金额 = 车里可售商品的 单价×数量 之和
 *   4. 下单落三张表，且下单后购物车被清空
 *   5. 状态只能沿 created → paid → shipped → done 往前一步，已完成不能再推
 *   6. 跨用户一律 404：读不到、改不动、推不了别人的订单和地址
 */
import { closeDb, getAll, getOne, initDb } from '../db/mysql.mjs'
import { wxLogin } from '../services/auth/index.mjs'
import * as cartService from '../services/cartService.mjs'
import * as orderService from '../services/orderService.mjs'
import { ensureAccessories } from '../services/accessoryService.mjs'
import { ensureSceneCatalog } from '../services/scene/index.mjs'

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
  const a = await wxLogin(`checkout_a_${stamp}`)
  const b = await wxLogin(`checkout_b_${stamp}`)

  await ensureAccessories()
  await ensureSceneCatalog()

  console.log('\n【1】优惠券试算（纯函数，不碰库）')
  // 满 199 减 30：198 元不满门槛
  check('满减券不满门槛时不减', orderService.calcDiscount(19800, 'full199_30').discount === 0)
  check('满减券刚好到门槛就能用', orderService.calcDiscount(19900, 'full199_30').discount === 3000)
  // 8.8 折封顶 50：1000 元订单本该减 120，封顶后只减 50
  check('折扣券按封顶值截断', orderService.calcDiscount(100000, 'discount88').discount === 5000)
  check('折扣券未到封顶时按比例算', orderService.calcDiscount(10000, 'discount88').discount === 1200)
  // 无门槛 10 元券碰上 3 块钱的订单，实付不能是负数
  const tiny = orderService.calcDiscount(300, 'nofloor10')
  check('减免不超过订单金额', tiny.discount === 300 && tiny.payAmount === 0)
  check('未知券号按不用券处理', orderService.calcDiscount(10000, 'not-exist').discount === 0)
  const coupons = orderService.listCoupons(5000)
  check(
    '不可用的券带得出原因',
    coupons.find((c) => c.key === 'full199_30')?.usable === false &&
      !!coupons.find((c) => c.key === 'full199_30')?.reason,
    coupons.find((c) => c.key === 'full199_30')?.reason,
  )

  console.log('\n【2】收货地址')
  const addr1 = await orderService.createAddress(a.userId, {
    receiver: '张三',
    phone: '13800001111',
    detail: '广东省深圳市南山区科技园某某路 1 号 A 座 501',
  })
  check('第一条地址自动成为默认', addr1.isDefault === true)
  const addr2 = await orderService.createAddress(a.userId, {
    receiver: '李四',
    phone: '13900002222',
    detail: '北京市海淀区中关村大街 5 号 B 座 302',
    isDefault: true,
  })
  const addrList = await orderService.listAddresses(a.userId)
  check(
    '设为默认后旧的默认被清掉，默认地址只有一条',
    addrList.filter((item) => item.isDefault).length === 1 && addrList[0].id === addr2.id,
  )
  await expectStatus(
    '手机号格式不对被拒',
    () =>
      orderService.createAddress(a.userId, {
        receiver: '王五',
        phone: '12345',
        detail: '上海市浦东新区某某路 9 号',
      }),
    400,
  )
  await expectStatus(
    '改别人的地址 404',
    () =>
      orderService.updateAddress(b.userId, addr1.id, {
        receiver: '赵六',
        phone: '13700003333',
        detail: '广州市天河区某某路 3 号',
      }),
    404,
  )

  console.log('\n【3】结算预览的金额口径')
  const accessory = await getOne('SELECT id FROM accessories ORDER BY id ASC LIMIT 1')
  const catalog = await getOne('SELECT id FROM scene_catalog ORDER BY id ASC LIMIT 1')
  await cartService.addItem(a.userId, { itemType: 'accessory', itemId: accessory.id, quantity: 2 })
  await cartService.addItem(a.userId, { itemType: 'catalog', itemId: catalog.id })
  const preview = await orderService.getCheckoutPreview(a.userId)
  const expected =
    preview.items.reduce((sum, item) => sum + Math.round(Number(item.price || 0) * 100) * item.quantity, 0) / 100
  check(
    '预览合计 = 单价×数量之和',
    Math.abs(preview.goodsAmount - expected) < 0.001,
    `${preview.goodsAmount} vs ${expected}`,
  )
  check('券列表带上了三张演示券', preview.coupons.length === 3)

  console.log('\n【4】下单落库 + 清空购物车')
  const order = await orderService.createOrder(a.userId, {
    addressId: addr2.id,
    couponKey: 'nofloor10',
    remark: '演示订单，勿发货',
  })
  check('订单号已生成', /^\d{18,}$/.test(order.orderNo), order.orderNo)
  check('初始状态是待付款', order.status === 'created')
  check('收货信息取自选中的地址', order.receiver === '李四')
  check(
    '实付 = 商品金额 - 优惠',
    Math.abs(order.payAmount - (order.goodsAmount - order.discountAmount)) < 0.001,
    `${order.goodsAmount} - ${order.discountAmount} = ${order.payAmount}`,
  )
  const itemRows = await getAll('SELECT * FROM shop_order_items WHERE order_id = ?', [order.id])
  check('订单行数量对得上', itemRows.length === preview.items.length)
  const cartAfter = await cartService.listCart(a.userId)
  check('下单后购物车被清空', cartAfter.items.length === 0)
  await expectStatus('空车再下单被拒', () => orderService.createOrder(a.userId, { addressId: addr2.id }), 400)

  console.log('\n【5】状态推进')
  const paid = await orderService.advanceOrder(a.userId, order.id, 'next')
  check('created → paid', paid.status === 'paid' && paid.stepIndex === 1)
  await expectStatus('已付款不能再取消', () => orderService.advanceOrder(a.userId, order.id, 'cancel'), 400)
  await orderService.advanceOrder(a.userId, order.id, 'next')
  const done = await orderService.advanceOrder(a.userId, order.id, 'next')
  check('推到 done', done.status === 'done' && done.stepIndex === 3)
  await expectStatus('已完成不能再往前推', () => orderService.advanceOrder(a.userId, order.id, 'next'), 400)
  await expectStatus('未知 action 被拒', () => orderService.advanceOrder(a.userId, order.id, 'refund'), 400)

  console.log('\n【6】跨用户隔离')
  await expectStatus('读别人的订单 404', () => orderService.getOrder(b.userId, order.id), 404)
  await expectStatus('推别人的订单 404', () => orderService.advanceOrder(b.userId, order.id, 'next'), 404)
  const bOrders = await orderService.listOrders(b.userId)
  check('别人的订单列表里看不到这单', !bOrders.some((item) => item.id === order.id))

  console.log(`\n${failed === 0 ? '✅ 全部通过' : `❌ ${failed} 项未通过`}\n`)
} catch (error) {
  console.error('\n❌ 验收脚本异常中断:', error)
  failed += 1
} finally {
  await closeDb()
}

process.exit(failed === 0 ? 0 : 1)
