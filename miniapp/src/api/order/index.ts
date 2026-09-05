/*
 * 演示结算接口（收货地址 + 订单）。
 *
 * 后端对应 server/routes/orders.mjs。这一版**没有支付**：
 * 提交订单后状态停在 created，付款 / 发货 / 收货由订单详情页的演示按钮推进。
 * 微信支付需要商户号和企业主体，demo 拿不到，所以不做半截的假支付。
 */
import { request } from '@/utils/request'
import type { AddressInput, CheckoutPreview, ShopAddress, ShopOrder } from './type'

enum API {
  /** 地址列表 / 新增 */
  ADDRESSES_URL = '/api/orders/addresses',
  /** 单条地址，后面接 id */
  ADDRESS_URL = '/api/orders/addresses/',
  /** 结算预览；可带 ?coupon= 重新试算 */
  CHECKOUT_URL = '/api/orders/checkout',
  /** 订单列表 / 提交 */
  ORDERS_URL = '/api/orders',
  /** 单个订单，后面接 id */
  ORDER_URL = '/api/orders/',
}

/** 类型再导出的理由见 api/diary/index.ts 的说明 */
export type { AddressInput, CheckoutPreview, CouponOption, ShopAddress, ShopOrder, ShopOrderStatus } from './type'

export async function fetchAddresses(): Promise<ShopAddress[]> {
  const data = await request<{ items: ShopAddress[] }>({ url: API.ADDRESSES_URL })
  return data.items
}

export async function createAddress(input: AddressInput): Promise<ShopAddress> {
  const data = await request<{ address: ShopAddress }>({
    url: API.ADDRESSES_URL,
    method: 'POST',
    data: input,
  })
  return data.address
}

export async function updateAddress(id: number, input: AddressInput): Promise<ShopAddress> {
  const data = await request<{ address: ShopAddress }>({
    url: API.ADDRESS_URL + id,
    method: 'PUT',
    data: input,
  })
  return data.address
}

export function deleteAddress(id: number): Promise<{ ok: boolean }> {
  return request({ url: API.ADDRESS_URL + id, method: 'DELETE' })
}

/** 车、地址、券、试算金额一次拿全，换券时带上 coupon 重新试算 */
export function fetchCheckoutPreview(couponKey = ''): Promise<CheckoutPreview> {
  const query = couponKey ? `?coupon=${encodeURIComponent(couponKey)}` : ''
  return request({ url: `${API.CHECKOUT_URL}${query}` })
}

export async function submitOrder(input: {
  addressId?: number
  address?: AddressInput
  couponKey?: string
  remark?: string
}): Promise<ShopOrder> {
  const data = await request<{ order: ShopOrder }>({
    url: API.ORDERS_URL,
    method: 'POST',
    data: input,
  })
  return data.order
}

export async function fetchOrders(): Promise<ShopOrder[]> {
  const data = await request<{ items: ShopOrder[] }>({ url: API.ORDERS_URL })
  return data.items
}

export async function fetchOrder(id: number): Promise<ShopOrder> {
  const data = await request<{ order: ShopOrder }>({ url: API.ORDER_URL + id })
  return data.order
}

/** 演示按钮：next 往前一步，cancel 取消（仅待付款） */
export async function advanceOrder(id: number, action: 'next' | 'cancel'): Promise<ShopOrder> {
  const data = await request<{ order: ShopOrder }>({
    url: `${API.ORDER_URL}${id}/advance`,
    method: 'POST',
    data: { action },
  })
  return data.order
}
