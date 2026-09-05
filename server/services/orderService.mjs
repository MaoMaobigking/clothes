/*
 * 演示结算（规格 §4.5 之后新增）。
 *
 * ── 明确不做什么 ──
 * 不接支付：微信支付要商户号 + 企业主体 + 签约，demo 拿不到，
 * 所以「提交订单」之后订单落在 created 态，付款/发货/收货由演示按钮手动推进。
 * 不做省市区三级：见 schema.sql shop_addresses 上的注释（数据包体积 vs 已超标的主包）。
 *
 * ── 金额为什么用分 ──
 * 目录里的价是元（可能带小数），一路用浮点加下来 0.1+0.2 那类误差会落进订单表。
 * 所以进这一层第一件事就是 元 → 分 取整，之后全是整数运算，出口再除回去。
 */
import * as orderRepo from '../repositories/orderRepo.mjs'
import * as cartService from './cartService.mjs'

function badRequest(message, code) {
  const err = new Error(message)
  err.status = 400
  err.code = code
  return err
}

function notFound(message, code) {
  const err = new Error(message)
  err.status = 404
  err.code = code
  return err
}

/*
 * 三张写死的演示优惠券，覆盖三种典型规则：满减 / 折扣 / 无门槛。
 * 写死是刻意的：真做优惠券要有券模板表、领券记录表、核销和并发扣减，
 * 那是另一个功能，不该塞进「结算页能跑通」这件事里。
 *
 * 折扣券带封顶（maxDiscount）：不封顶的话一单一万块就白送一千二，
 * 这是所有折扣券在真实系统里都会有的一条，不写反而不像样。
 */
export const COUPONS = [
  {
    key: 'full199_30',
    label: '满 199 减 30',
    type: 'threshold',
    threshold: 19900,
    discount: 3000,
  },
  {
    key: 'discount88',
    label: '全场 8.8 折（最多减 50）',
    type: 'rate',
    threshold: 0,
    rate: 0.88,
    maxDiscount: 5000,
  },
  {
    key: 'nofloor10',
    label: '无门槛立减 10',
    type: 'fixed',
    threshold: 0,
    discount: 1000,
  },
]

const STATUS_FLOW = ['created', 'paid', 'shipped', 'done']
const STATUS_LABEL = {
  created: '待付款',
  paid: '待发货',
  shipped: '待收货',
  done: '已完成',
  cancelled: '已取消',
}

const yuan = (cents) => Math.round(cents) / 100
const toCents = (value) => Math.round(Number(value || 0) * 100)

/**
 * 优惠券试算 —— 纯函数，不碰数据库，所以 check:checkout 可以直接对它做边界测试。
 *
 * 返回的 discount 一定满足 0 ≤ discount ≤ goodsAmount：
 * 无门槛 10 元券碰上 3 块钱的订单，实付不能是 -7。
 */
export function calcDiscount(goodsAmount, couponKey) {
  const amount = Math.max(0, Math.round(Number(goodsAmount) || 0))
  const coupon = COUPONS.find((item) => item.key === couponKey)
  if (!coupon) return { coupon: null, discount: 0, payAmount: amount }
  if (amount < coupon.threshold) {
    // 不满门槛时按「没用券」算，而不是报错：前端把不可用的券置灰，
    // 但用户先选券再删商品也会走到这里，这时候静默降级比整单失败合理。
    return { coupon: null, discount: 0, payAmount: amount }
  }

  let discount = 0
  if (coupon.type === 'rate') {
    discount = Math.min(Math.round(amount * (1 - coupon.rate)), coupon.maxDiscount)
  } else {
    discount = coupon.discount
  }
  discount = Math.max(0, Math.min(discount, amount))
  return { coupon, discount, payAmount: amount - discount }
}

/** 每张券在当前金额下能不能用，以及不能用时的原因 —— 前端拿它渲染置灰态 */
export function listCoupons(goodsAmount) {
  const amount = Math.max(0, Math.round(Number(goodsAmount) || 0))
  return COUPONS.map((coupon) => {
    const usable = amount > 0 && amount >= coupon.threshold
    const { discount } = usable ? calcDiscount(amount, coupon.key) : { discount: 0 }
    return {
      key: coupon.key,
      label: coupon.label,
      usable,
      reason: usable ? '' : amount <= 0 ? '购物车为空' : `还差 ${yuan(coupon.threshold - amount)} 元可用`,
      discount: yuan(discount),
    }
  })
}

/* ============ 地址 ============ */

const PHONE_RE = /^1[3-9]\d{9}$/

function normalizeAddress(input = {}) {
  const receiver = String(input.receiver || '').trim()
  const phone = String(input.phone || '').trim()
  const detail = String(input.detail || '').trim()
  if (receiver.length < 2 || receiver.length > 16) {
    throw badRequest('收货人姓名需 2–16 个字', 'INVALID_RECEIVER')
  }
  if (!PHONE_RE.test(phone)) {
    throw badRequest('手机号格式不对，应为 11 位且以 1 开头', 'INVALID_PHONE')
  }
  if (detail.length < 5 || detail.length > 120) {
    throw badRequest('详细地址需 5–120 个字', 'INVALID_ADDRESS')
  }
  return { receiver, phone, detail, isDefault: !!input.isDefault }
}

const toAddress = (row) => ({
  id: row.id,
  receiver: row.receiver,
  phone: row.phone,
  detail: row.detail,
  isDefault: !!row.is_default,
})

export async function listAddresses(userId) {
  const rows = await orderRepo.listAddresses(userId)
  return rows.map(toAddress)
}

export async function createAddress(userId, input) {
  const address = normalizeAddress(input)
  const existing = await orderRepo.listAddresses(userId)
  // 第一条地址自动成为默认，否则结算页会出现「有地址但没选中」的空档
  if (!existing.length) address.isDefault = true
  const id = await orderRepo.createAddress(userId, address)
  return toAddress({ id, ...address, is_default: address.isDefault ? 1 : 0 })
}

export async function updateAddress(userId, id, input) {
  const address = normalizeAddress(input)
  const ok = await orderRepo.updateAddress(userId, id, address)
  if (!ok) throw notFound('地址不存在', 'ADDRESS_NOT_FOUND')
  return toAddress({ id: Number(id), ...address, is_default: address.isDefault ? 1 : 0 })
}

export async function deleteAddress(userId, id) {
  const ok = await orderRepo.deleteAddress(userId, id)
  if (!ok) throw notFound('地址不存在', 'ADDRESS_NOT_FOUND')
  return { ok: true }
}

/* ============ 结算 ============ */

/** 结算页要的一整屏数据：车里的东西、地址、可用券、试算金额 */
export async function getCheckoutPreview(userId, couponKey = '') {
  const [cart, addresses] = await Promise.all([cartService.listCart(userId), listAddresses(userId)])
  // 下架商品（available=false）不参与结算：它没有价格，算进去只会得到一个错的合计
  const items = cart.items.filter((item) => item.available)
  const goodsAmount = items.reduce((sum, item) => sum + toCents(item.price) * item.quantity, 0)
  const { coupon, discount, payAmount } = calcDiscount(goodsAmount, couponKey)
  return {
    items,
    unavailableCount: cart.items.length - items.length,
    addresses,
    coupons: listCoupons(goodsAmount),
    selectedCoupon: coupon ? coupon.key : '',
    goodsAmount: yuan(goodsAmount),
    discountAmount: yuan(discount),
    payAmount: yuan(payAmount),
  }
}

/** 订单号：日期 + 用户 + 随机，肉眼能看出下单日期，唯一性交给表上的唯一键兜底 */
function makeOrderNo(userId) {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const rand = String(Math.floor(Math.random() * 1e6)).padStart(6, '0')
  return `${date}${String(userId).padStart(4, '0')}${rand}`
}

export async function createOrder(userId, input = {}) {
  const preview = await getCheckoutPreview(userId, input.couponKey || '')
  if (!preview.items.length) {
    throw badRequest('购物车是空的，没有可结算的商品', 'EMPTY_CART')
  }

  // 地址：传 addressId 就用存的那条，否则接受一次性填写的地址（不入库）
  let receiver
  let phone
  let detail
  if (input.addressId) {
    const row = await orderRepo.findAddress(userId, input.addressId)
    if (!row) throw notFound('收货地址不存在', 'ADDRESS_NOT_FOUND')
    receiver = row.receiver
    phone = row.phone
    detail = row.detail
  } else {
    const address = normalizeAddress(input.address || {})
    receiver = address.receiver
    phone = address.phone
    detail = address.detail
  }

  const goodsAmount = toCents(preview.goodsAmount)
  const { coupon, discount, payAmount } = calcDiscount(goodsAmount, input.couponKey || '')

  const orderId = await orderRepo.createOrder(
    userId,
    {
      orderNo: makeOrderNo(userId),
      receiver,
      phone,
      addressDetail: detail,
      couponKey: coupon ? coupon.key : null,
      couponLabel: coupon ? coupon.label : null,
      goodsAmount,
      discountAmount: discount,
      payAmount,
      remark:
        String(input.remark || '')
          .trim()
          .slice(0, 200) || null,
    },
    preview.items.map((item) => ({
      itemType: item.itemType,
      itemId: item.itemId,
      name: item.name,
      imageUrl: item.imageUrl || null,
      unitPrice: toCents(item.price),
      quantity: item.quantity,
    })),
  )

  return getOrder(userId, orderId)
}

function toOrder(row, items = []) {
  const index = STATUS_FLOW.indexOf(row.status)
  return {
    id: row.id,
    orderNo: row.order_no,
    status: row.status,
    statusLabel: STATUS_LABEL[row.status] || row.status,
    /** 状态条画到第几步；已取消不在流程里，返回 -1 让前端画成灰条 */
    stepIndex: index,
    steps: STATUS_FLOW.map((key) => ({ key, label: STATUS_LABEL[key] })),
    receiver: row.receiver,
    phone: row.phone,
    addressDetail: row.address_detail,
    couponKey: row.coupon_key,
    couponLabel: row.coupon_label,
    goodsAmount: yuan(row.goods_amount),
    discountAmount: yuan(row.discount_amount),
    payAmount: yuan(row.pay_amount),
    remark: row.remark || '',
    createdAt: row.created_at,
    items: items.map((item) => ({
      itemType: item.item_type,
      itemId: item.item_id,
      name: item.name,
      imageUrl: item.image_url || '',
      price: yuan(item.unit_price),
      quantity: item.quantity,
    })),
  }
}

export async function listOrders(userId) {
  const rows = await orderRepo.listOrders(userId)
  const orders = await Promise.all(rows.map(async (row) => toOrder(row, await orderRepo.listOrderItems(row.id))))
  return orders
}

export async function getOrder(userId, id) {
  const row = await orderRepo.findOrder(userId, id)
  if (!row) throw notFound('订单不存在', 'ORDER_NOT_FOUND')
  return toOrder(row, await orderRepo.listOrderItems(row.id))
}

/**
 * 演示用的状态推进：只允许沿 created → paid → shipped → done 往前走一步，
 * 或者在未付款时取消。允许任意跳转的话，验收时点错一下就出现「已完成又变待付款」。
 */
export async function advanceOrder(userId, id, action) {
  const order = await getOrder(userId, id)
  const index = STATUS_FLOW.indexOf(order.status)

  let next = ''
  if (action === 'cancel') {
    if (order.status !== 'created') {
      throw badRequest('只有待付款的订单可以取消', 'CANNOT_CANCEL')
    }
    next = 'cancelled'
  } else if (action === 'next') {
    if (index < 0 || index >= STATUS_FLOW.length - 1) {
      throw badRequest('订单已经走到最后一步', 'CANNOT_ADVANCE')
    }
    next = STATUS_FLOW[index + 1]
  } else {
    throw badRequest('未知操作', 'INVALID_ACTION')
  }

  await orderRepo.updateOrderStatus(userId, id, next)
  return getOrder(userId, id)
}
