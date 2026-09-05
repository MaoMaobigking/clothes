/*
 * 演示结算接口（收货地址 + 订单）。
 *
 * 后端对应 server/routes/orders.mjs。这一版**没有支付**：
 * 提交订单后状态停在 created，付款 / 发货 / 收货由订单详情页的演示按钮推进。
 * 微信支付需要商户号和企业主体，demo 拿不到，所以不做半截的假支付。
 */
import { request } from '@/utils/request'
import type { CartItem } from './cart'

export interface ShopAddress {
  id: number
  receiver: string
  phone: string
  detail: string
  isDefault: boolean
}

export interface CouponOption {
  key: string
  label: string
  /** 当前金额下能不能用；不能用时 reason 说明还差多少 */
  usable: boolean
  reason: string
  discount: number
}

export interface CheckoutPreview {
  items: CartItem[]
  /** 已下架、不参与结算的行数。为 0 时前端不显示这条提示 */
  unavailableCount: number
  addresses: ShopAddress[]
  coupons: CouponOption[]
  selectedCoupon: string
  goodsAmount: number
  discountAmount: number
  payAmount: number
}

export type ShopOrderStatus = 'created' | 'paid' | 'shipped' | 'done' | 'cancelled'

export interface ShopOrder {
  id: number
  orderNo: string
  status: ShopOrderStatus
  statusLabel: string
  /** 状态条画到第几步；已取消为 -1 */
  stepIndex: number
  steps: { key: string; label: string }[]
  receiver: string
  phone: string
  addressDetail: string
  couponKey: string | null
  couponLabel: string | null
  goodsAmount: number
  discountAmount: number
  payAmount: number
  remark: string
  createdAt: string
  items: {
    itemType: string
    itemId: string
    name: string
    imageUrl: string
    price: number
    quantity: number
  }[]
}

export interface AddressInput {
  receiver: string
  phone: string
  detail: string
  isDefault?: boolean
}

export async function fetchAddresses(): Promise<ShopAddress[]> {
  const data = await request<{ items: ShopAddress[] }>({ url: '/api/orders/addresses' })
  return data.items
}

export async function createAddress(input: AddressInput): Promise<ShopAddress> {
  const data = await request<{ address: ShopAddress }>({
    url: '/api/orders/addresses',
    method: 'POST',
    data: input,
  })
  return data.address
}

export async function updateAddress(id: number, input: AddressInput): Promise<ShopAddress> {
  const data = await request<{ address: ShopAddress }>({
    url: `/api/orders/addresses/${id}`,
    method: 'PUT',
    data: input,
  })
  return data.address
}

export function deleteAddress(id: number): Promise<{ ok: boolean }> {
  return request({ url: `/api/orders/addresses/${id}`, method: 'DELETE' })
}

/** 车、地址、券、试算金额一次拿全，换券时带上 coupon 重新试算 */
export function fetchCheckoutPreview(couponKey = ''): Promise<CheckoutPreview> {
  const query = couponKey ? `?coupon=${encodeURIComponent(couponKey)}` : ''
  return request({ url: `/api/orders/checkout${query}` })
}

export async function submitOrder(input: {
  addressId?: number
  address?: AddressInput
  couponKey?: string
  remark?: string
}): Promise<ShopOrder> {
  const data = await request<{ order: ShopOrder }>({
    url: '/api/orders',
    method: 'POST',
    data: input,
  })
  return data.order
}

export async function fetchOrders(): Promise<ShopOrder[]> {
  const data = await request<{ items: ShopOrder[] }>({ url: '/api/orders' })
  return data.items
}

export async function fetchOrder(id: number): Promise<ShopOrder> {
  const data = await request<{ order: ShopOrder }>({ url: `/api/orders/${id}` })
  return data.order
}

/** 演示按钮：next 往前一步，cancel 取消（仅待付款） */
export async function advanceOrder(id: number, action: 'next' | 'cancel'): Promise<ShopOrder> {
  const data = await request<{ order: ShopOrder }>({
    url: `/api/orders/${id}/advance`,
    method: 'POST',
    data: { action },
  })
  return data.order
}
