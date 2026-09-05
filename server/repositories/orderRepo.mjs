/*
 * 演示结算的数据访问层：收货地址 + 订单 + 订单行。
 *
 * 三张表都是 §4.5 之后新增的（schema.sql 26–29），和 cart_items 一样按 user_id 隔离。
 * 这一层只做 SQL，金额怎么算、优惠券怎么选在 services/orderService.mjs。
 */
import { getAll, getOne, execute, withTransaction } from '../db/mysql.mjs'

/* ============ 收货地址 ============ */

export async function listAddresses(userId) {
  return getAll(
    `SELECT id, receiver, phone, detail, is_default, created_at
       FROM shop_addresses
      WHERE user_id = ?
      ORDER BY is_default DESC, id DESC`,
    [userId],
  )
}

export async function findAddress(userId, id) {
  return getOne(
    `SELECT id, receiver, phone, detail, is_default
       FROM shop_addresses
      WHERE user_id = ? AND id = ?`,
    [userId, Number(id) || 0],
  )
}

/**
 * 新增地址。设为默认时要先把这个人其它地址的 is_default 清掉 ——
 * 两条默认地址会让结算页「默认选中哪个」变成不确定行为，所以放同一个事务里。
 */
export async function createAddress(userId, input) {
  return withTransaction(async (conn) => {
    if (input.isDefault) {
      await conn.execute('UPDATE shop_addresses SET is_default = 0 WHERE user_id = ?', [userId])
    }
    const [result] = await conn.execute(
      `INSERT INTO shop_addresses (user_id, receiver, phone, detail, is_default)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, input.receiver, input.phone, input.detail, input.isDefault ? 1 : 0],
    )
    return result.insertId
  })
}

export async function updateAddress(userId, id, input) {
  return withTransaction(async (conn) => {
    if (input.isDefault) {
      await conn.execute('UPDATE shop_addresses SET is_default = 0 WHERE user_id = ?', [userId])
    }
    const [result] = await conn.execute(
      `UPDATE shop_addresses
          SET receiver = ?, phone = ?, detail = ?, is_default = ?
        WHERE user_id = ? AND id = ?`,
      [input.receiver, input.phone, input.detail, input.isDefault ? 1 : 0, userId, Number(id) || 0],
    )
    return result.affectedRows > 0
  })
}

export async function deleteAddress(userId, id) {
  const result = await execute('DELETE FROM shop_addresses WHERE user_id = ? AND id = ?', [userId, Number(id) || 0])
  return result.affectedRows > 0
}

/* ============ 订单 ============ */

/**
 * 建订单 + 建订单行 + 清空购物车，一个事务。
 * 拆开写的话，「订单建好了但车没清」会让用户再点一次结算下出第二单。
 */
export async function createOrder(userId, order, items) {
  return withTransaction(async (conn) => {
    const [result] = await conn.execute(
      `INSERT INTO shop_orders
         (user_id, order_no, status, receiver, phone, address_detail,
          coupon_key, coupon_label, goods_amount, discount_amount, pay_amount, remark)
       VALUES (?, ?, 'created', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        order.orderNo,
        order.receiver,
        order.phone,
        order.addressDetail,
        order.couponKey,
        order.couponLabel,
        order.goodsAmount,
        order.discountAmount,
        order.payAmount,
        order.remark,
      ],
    )
    const orderId = result.insertId

    for (const item of items) {
      await conn.execute(
        `INSERT INTO shop_order_items
           (order_id, item_type, item_id, name, image_url, unit_price, quantity)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.itemType, item.itemId, item.name, item.imageUrl, item.unitPrice, item.quantity],
      )
    }

    // 下单即清空购物车 —— 和真实电商一致，也避免重复下单
    await conn.execute('DELETE FROM cart_items WHERE user_id = ?', [userId])
    return orderId
  })
}

export async function listOrders(userId) {
  return getAll(
    `SELECT id, order_no, status, receiver, phone, address_detail,
            coupon_key, coupon_label, goods_amount, discount_amount, pay_amount,
            remark, created_at, updated_at
       FROM shop_orders
      WHERE user_id = ?
      ORDER BY id DESC`,
    [userId],
  )
}

export async function findOrder(userId, id) {
  return getOne(
    `SELECT id, order_no, status, receiver, phone, address_detail,
            coupon_key, coupon_label, goods_amount, discount_amount, pay_amount,
            remark, created_at, updated_at
       FROM shop_orders
      WHERE user_id = ? AND id = ?`,
    [userId, Number(id) || 0],
  )
}

export async function listOrderItems(orderId) {
  return getAll(
    `SELECT item_type, item_id, name, image_url, unit_price, quantity
       FROM shop_order_items
      WHERE order_id = ?
      ORDER BY id ASC`,
    [orderId],
  )
}

/** 推进状态。WHERE 带 user_id，别人的订单改不动。 */
export async function updateOrderStatus(userId, id, status) {
  const result = await execute('UPDATE shop_orders SET status = ? WHERE user_id = ? AND id = ?', [
    status,
    userId,
    Number(id) || 0,
  ])
  return result.affectedRows > 0
}
