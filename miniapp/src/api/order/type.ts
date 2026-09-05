/*
 * 演示结算（收货地址 + 订单）的数据结构。
 *
 * CartItem 复用 api/cart 的定义 —— 结算预览里的行就是购物车的行，
 * 不另起一套形状，免得两边字段慢慢漂移。
 */
import type { CartItem } from '@/api/cart'

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
