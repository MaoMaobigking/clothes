<script setup lang="ts">
/**
 * 购物车页（规格 §4.5 §9.7 §13）
 *
 * 全项目唯一的购物车视图。三种来源混装在一张列表里：
 *   旧衣（来自搭配拆单）/ 配饰 / 场景新品
 * 支持改数量、删除、复制淘口令，数据全部落库，重开仍在。
 */
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCartStore } from '@/stores/cart'
import { resolveImageUrl } from '@/api/wardrobe'
import { isAuthError } from '@/api/http'
import type { CartItem } from '@/api/cart'

const cart = useCartStore()
const busy = ref(0)

const TYPE_LABEL: Record<string, string> = {
  garment: '我的衣橱',
  accessory: '配饰',
  catalog: '商城新品',
}

const TYPE_EMOJI: Record<string, string> = {
  garment: '👕',
  accessory: '✨',
  catalog: '🛍️',
}

// 每次进页面都强制重拉：配饰页、搭配页都可能刚加过购物车
onShow(() => {
  cart.load(true)
})

const hasUnavailable = computed(() => cart.items.some((item) => !item.available))

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
}

function displaySrc(src?: string) {
  return resolveImageUrl(src || '')
}

function typeLabel(item: CartItem) {
  return TYPE_LABEL[item.itemType] || '商品'
}

function itemEmoji(item: CartItem) {
  return item.emoji || TYPE_EMOJI[item.itemType] || '🛒'
}

function priceText(item: CartItem) {
  return item.price === null ? '—' : `¥${item.price}`
}

/**
 * 改数量。busy 计数是为了防止连点：接口是「设为 N」不是「加 1」，
 * 连点两次会拿旧值算出同一个 N，看起来像点了没反应。
 */
async function changeQuantity(item: CartItem, delta: number) {
  const next = item.quantity + delta
  if (next < 1) {
    await removeItem(item)
    return
  }
  if (next > 99) {
    toast('单件最多 99 件')
    return
  }
  busy.value += 1
  try {
    await cart.setQuantity(item.cartId, next)
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      toast((error as Error)?.message || '修改数量失败')
    }
  } finally {
    busy.value -= 1
  }
}

async function removeItem(item: CartItem) {
  const confirmed = await new Promise<boolean>((resolve) => {
    uni.showModal({
      title: '移出购物车',
      content: `确定移除「${item.name}」吗？`,
      success: (res) => resolve(Boolean(res.confirm)),
      fail: () => resolve(false),
    })
  })
  if (!confirmed) return
  busy.value += 1
  try {
    await cart.remove(item.cartId)
    toast('已移出购物车')
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      toast((error as Error)?.message || '移除失败')
    }
  } finally {
    busy.value -= 1
  }
}

/** §4.5 §9.7：购物车内商品可以复制淘口令 */
function copyToken(item: CartItem) {
  const text = item.taokouling || item.taobaoUrl
  if (!text) {
    toast('该商品暂无淘口令')
    return
  }
  uni.setClipboardData({
    data: text,
    success: () => toast('淘口令已复制，打开淘宝查看'),
  })
}

function goShopping() {
  uni.navigateTo({ url: '/pages/accessory/index' })
}

/** 去演示结算页。下架商品不参与结算，结算页会再提示一次，这里不拦。 */
function goCheckout() {
  uni.navigateTo({ url: '/pages/checkout/index' })
}
</script>

<template>
  <view class="page page-stage">
    <PageHeader title="购物车" to="/pages/me/me" />

    <view v-if="cart.loading && !cart.loaded" class="state">正在读取购物车...</view>
    <view v-else-if="cart.error" class="state error">{{ cart.error }}</view>

    <view v-else-if="cart.isEmpty" class="state empty">
      <UiIcon class="empty-emoji" name="cart" :size="88" tone="muted" :stroke-width="1.3" />
      <view class="empty-title">购物车还是空的</view>
      <view class="empty-sub">从配饰推荐或搭配方案里加点东西吧</view>
      <view class="btn btn-primary empty-btn" @tap="goShopping">去逛逛配饰</view>
    </view>

    <template v-else>
      <scroll-view scroll-y class="body hide-scrollbar">
        <view v-if="hasUnavailable" class="notice">有商品已下架，价格不计入合计，可直接移除。</view>

        <view v-for="item in cart.items" :key="item.cartId" class="row" :class="{ off: !item.available }">
          <TileImage
            class="thumb"
            :src="displaySrc(item.imageUrl)"
            :from="item.from"
            :to="item.to"
            :emoji="itemEmoji(item)"
            ratio="1 / 1"
            rounded="16rpx"
          />

          <view class="info">
            <view class="name-line">
              <text class="name">{{ item.name }}</text>
            </view>
            <view class="tags">
              <text class="tag">{{ typeLabel(item) }}</text>
              <!-- §4.5：加入整套搭配时记录来源搭配 -->
              <text v-if="item.sourceOutfitId" class="tag tag-outfit">来自搭配 #{{ item.sourceOutfitId }}</text>
              <text v-if="!item.available" class="tag tag-off">已下架</text>
            </view>
            <view class="price-line">
              <text class="price">{{ priceText(item) }}</text>
              <text v-if="item.brand" class="brand">{{ item.brand }}</text>
            </view>

            <view class="ops">
              <view class="stepper">
                <view class="step" :class="{ disabled: busy > 0 }" @tap="changeQuantity(item, -1)">−</view>
                <text class="qty">{{ item.quantity }}</text>
                <view
                  class="step"
                  :class="{ disabled: busy > 0 || item.quantity >= 99 }"
                  @tap="changeQuantity(item, 1)"
                >
                  +
                </view>
              </view>
              <view class="op-btn" @tap="copyToken(item)">复制口令</view>
              <view class="op-btn op-del" @tap="removeItem(item)">删除</view>
            </view>
          </view>
        </view>

        <view class="tail">购物车已保存到账号，换设备登录同样看得到</view>
      </scroll-view>

      <view class="bar">
        <view class="bar-sum">
          <text class="bar-label">合计（{{ cart.count }} 件）</text>
          <text class="bar-price">¥{{ cart.totalPrice }}</text>
        </view>
        <view class="btn btn-ghost bar-btn" @tap="goShopping">继续挑选</view>
        <view class="btn btn-primary bar-btn" @tap="goCheckout">去结算</view>
      </view>
    </template>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 30rpx 24rpx;
}

.state {
  padding: 120rpx 40rpx;
  font-size: 26rpx;
  color: var(--text-3);
  text-align: center;
}

.state.error {
  color: #d04c5b;
}

.empty-emoji {
  display: block;
  margin-bottom: 18rpx;
  font-size: 96rpx;
}

.empty-title {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-1);
}

.empty-sub {
  margin-top: 10rpx;
  font-size: 24rpx;
}

.empty-btn {
  width: 320rpx;
  margin: 36rpx auto 0;
}

.notice {
  padding: 16rpx 20rpx;
  margin-bottom: 16rpx;
  font-size: 22rpx;
  color: #a05a12;
  background: #fff4e5;
  border-radius: var(--radius);
}

.row {
  display: flex;
  gap: 18rpx;
  padding: 22rpx 0;
  border-bottom: 1px solid var(--line);
}

.row.off {
  opacity: 0.6;
}

.thumb {
  flex-shrink: 0;
  width: 150rpx;
}

.info {
  flex: 1;
  min-width: 0;
}

.name-line {
  display: flex;
  align-items: center;
}

.name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 27rpx;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 8rpx;
}

.tag {
  padding: 4rpx 12rpx;
  font-size: 19rpx;
  color: var(--purple-deep);
  background: var(--surface-tint);
  border-radius: var(--radius-pill);
}

.tag-outfit {
  color: #c0507a;
  background: #ffeef5;
}

.tag-off {
  color: #888;
  background: #eee;
}

.price-line {
  display: flex;
  gap: 12rpx;
  align-items: baseline;
  margin-top: 10rpx;
}

.price {
  font-size: 28rpx;
  font-weight: 700;
  color: #d04c5b;
}

.brand {
  font-size: 20rpx;
  color: var(--text-3);
}

.ops {
  display: flex;
  gap: 12rpx;
  align-items: center;
  margin-top: 14rpx;
}

.stepper {
  display: flex;
  align-items: center;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 48rpx;
  font-size: 30rpx;
  color: var(--text-1);
  background: var(--surface-tint);
}

.step.disabled {
  color: #c4c0cc;
}

.qty {
  min-width: 56rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
}

.op-btn {
  padding: 10rpx 18rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: var(--purple-deep);
  background: var(--surface-tint);
  border-radius: var(--radius-pill);
}

.op-del {
  color: #d04c5b;
  background: #fdeef0;
}

.tail {
  padding: 30rpx 0 10rpx;
  font-size: 21rpx;
  color: var(--text-3);
  text-align: center;
}

.bar {
  display: flex;
  gap: 20rpx;
  align-items: center;
  padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  border-top: 1px solid var(--line);
}

.bar-sum {
  flex: 1;
  min-width: 0;
}

.bar-label {
  display: block;
  font-size: 21rpx;
  color: var(--text-3);
}

.bar-price {
  font-size: 34rpx;
  font-weight: 700;
  color: #d04c5b;
}

.bar-btn {
  /* 底部条现在是两个按钮（继续挑选 / 去结算），固定 240rpx 会挤爆小屏 */
  flex: 1;
  min-width: 0;
  max-width: 240rpx;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
