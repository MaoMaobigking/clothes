<script setup lang="ts">
/*
 * 演示订单详情。
 *
 * 状态条的样式抄的是 pages/custom/order.vue 那个 progress stepper —— 只抄样式不抄页面，
 * 那一页是「定制进度」，走的是另一套 custom_requests 状态机。
 *
 * 「模拟付款 / 模拟发货 / 确认收货」三个按钮是**演示**：没有支付回调、没有物流单号，
 * 后端只把 status 沿 created → paid → shipped → done 往前挪一格
 * （见 server/services/orderService.mjs 的 advanceOrder）。
 * 这一点写在按钮上方，不能让人以为这单真的付掉了。
 */
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { advanceOrder, fetchOrder, type ShopOrder } from '@/api/order'
import { isAuthError } from '@/api/http'

const order = ref<ShopOrder | null>(null)
const loading = ref(true)
const errorText = ref('')
const busy = ref(false)
let orderId = 0

/** 下一步按钮的文案跟着当前状态走；已完成 / 已取消时不显示按钮 */
const nextLabel = computed(() => {
  switch (order.value?.status) {
    case 'created':
      return '模拟付款'
    case 'paid':
      return '模拟发货'
    case 'shipped':
      return '确认收货'
    default:
      return ''
  }
})

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
}

async function load() {
  try {
    order.value = await fetchOrder(orderId)
    errorText.value = ''
  } catch (error) {
    if (!isAuthError(error)) {
      errorText.value = error instanceof Error ? error.message : '订单加载失败'
    }
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  orderId = Number(options?.id || 0)
  if (!orderId) {
    loading.value = false
    errorText.value = '缺少订单号'
    return
  }
  load()
})

async function advance(action: 'next' | 'cancel') {
  if (busy.value || !order.value) return
  busy.value = true
  try {
    order.value = await advanceOrder(orderId, action)
    toast(action === 'cancel' ? '订单已取消' : `已推进到「${order.value.statusLabel}」`)
  } catch (error) {
    if (!isAuthError(error)) {
      toast(error instanceof Error ? error.message : '操作失败')
    }
  } finally {
    busy.value = false
  }
}

/** 商城是 tabBar 页，只能 switchTab，navigateTo 会静默失败 */
function goShopping() {
  uni.switchTab({ url: '/pages/mall/mall' })
}

function confirmCancel() {  uni.showModal({
    title: '取消订单',
    content: '取消后不可恢复，购物车不会自动还原。',
    success: (res) => {
      if (res.confirm) advance('cancel')
    },
  })
}
</script>

<template>
  <view class="page">
    <PageHeader title="订单详情" to="/pages/cart/index" />

    <scroll-view scroll-y class="body hide-scrollbar">
      <view v-if="loading" class="state">加载中…</view>
      <view v-else-if="errorText" class="state error">{{ errorText }}</view>

      <template v-else-if="order">
        <view class="card">
          <view class="head">
            <text class="status">{{ order.statusLabel }}</text>
            <text class="order-no">单号 {{ order.orderNo }}</text>
          </view>

          <!-- 已取消不在正常流程里（stepIndex = -1），画一条全灰的条比画错一格好 -->
          <view class="progress">
            <view
              v-for="(step, index) in order.steps"
              :key="step.key"
              class="progress-step"
              :class="{
                done: order.stepIndex >= 0 && index <= order.stepIndex,
                current: index === order.stepIndex,
              }"
            >
              <view class="progress-dot">
                {{ order.stepIndex >= 0 && index < order.stepIndex ? '✓' : index + 1 }}
              </view>
              <text class="progress-label">{{ step.label }}</text>
            </view>
          </view>

          <text v-if="order.status === 'cancelled'" class="cancelled-tip">
            这单已取消，状态条不再推进
          </text>
        </view>

        <view class="card">
          <view class="card-title">收货信息</view>
          <view class="row">
            <text class="k">收货人</text>
            <text class="v">{{ order.receiver }} {{ order.phone }}</text>
          </view>
          <view class="row">
            <text class="k">地址</text><text class="v">{{ order.addressDetail }}</text>
          </view>
          <view v-if="order.remark" class="row">
            <text class="k">备注</text><text class="v">{{ order.remark }}</text>
          </view>
        </view>

        <view class="card">
          <view class="card-title">商品</view>
          <view v-for="(item, index) in order.items" :key="index" class="goods">
            <TileImage :src="item.imageUrl" icon="cat-shirt" ratio="1 / 1" class="goods-img" />
            <text class="goods-name">{{ item.name }}</text>
            <view class="goods-right">
              <text class="goods-price">¥{{ item.price }}</text>
              <text class="goods-qty">×{{ item.quantity }}</text>
            </view>
          </view>
        </view>

        <view class="card">
          <view class="card-title">金额</view>
          <view class="row"><text class="k">商品金额</text><text class="v">¥{{ order.goodsAmount }}</text></view>
          <view class="row">
            <text class="k">优惠{{ order.couponLabel ? `（${order.couponLabel}）` : '' }}</text>
            <text class="v cut">-¥{{ order.discountAmount }}</text>
          </view>
          <view class="row total"><text class="k">实付</text><text class="pay">¥{{ order.payAmount }}</text></view>
        </view>

        <text class="demo-note">
          演示订单：没有接微信支付，下面的按钮只是把状态往前挪一格，不产生任何真实交易
        </text>

        <view class="actions">
          <view
            v-if="order.status === 'created'"
            class="btn btn-ghost act"
            @tap="confirmCancel"
          >
            取消订单
          </view>
          <view
            v-if="nextLabel"
            class="btn btn-primary act"
            :class="{ disabled: busy }"
            @tap="advance('next')"
          >
            {{ nextLabel }}
          </view>
          <view v-if="!nextLabel" class="btn btn-ghost act" @tap="goShopping">
            再逛逛
          </view>
        </view>
      </template>
    </scroll-view>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 30rpx 48rpx;
}
.state {
  padding: 120rpx 40rpx;
  text-align: center;
  color: var(--text-3);
  font-size: 26rpx;
}
.state.error {
  color: #d04c5b;
}
.card {
  margin-top: 20rpx;
  padding: 22rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16rpx;
}
.status {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--pink-deep);
}
.order-no {
  font-size: 20rpx;
  color: var(--text-3);
}
.card-title {
  margin-bottom: 10rpx;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-1);
}
.cancelled-tip {
  display: block;
  font-size: 21rpx;
  color: var(--text-3);
}

/* 状态条：样式沿用 pages/custom/order.vue 的 progress stepper */
.progress {
  display: flex;
  margin-top: 28rpx;
  margin-bottom: 20rpx;
}
.progress-step {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  color: var(--text-3);
}
.progress-step::before {
  content: '';
  position: absolute;
  top: 23rpx;
  right: 50%;
  width: 100%;
  height: 4rpx;
  background: #e7e1f0;
}
.progress-step:first-child::before {
  display: none;
}
.progress-step.done::before,
.progress-step.current::before {
  background: linear-gradient(90deg, var(--pink), var(--purple));
}
.progress-dot {
  position: relative;
  z-index: 1;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e7e1f0;
  color: var(--text-3);
  font-size: 20rpx;
  font-weight: 500;
}
.progress-step.done .progress-dot,
.progress-step.current .progress-dot {
  background: var(--brand-gradient);
  color: #fff;
  box-shadow: var(--shadow-card);
}
.progress-label {
  font-size: 20rpx;
  white-space: nowrap;
}
.progress-step.done,
.progress-step.current {
  color: var(--text-1);
}

.row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24rpx;
  padding: 12rpx 0;
  border-bottom: 1px solid var(--line);
}
.row:last-of-type {
  border-bottom: none;
}
.row.total {
  padding-top: 16rpx;
  border-top: 1px solid var(--line);
  border-bottom: none;
}
.k {
  flex-shrink: 0;
  font-size: 23rpx;
  color: var(--text-3);
}
.v {
  flex: 1;
  min-width: 0;
  text-align: right;
  font-size: 24rpx;
  color: var(--text-1);
}
.cut,
.pay {
  color: var(--pink-deep);
}
.pay {
  font-size: 32rpx;
  font-weight: 700;
}
.goods {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 0;
  border-bottom: 1px solid var(--line);
}
.goods:last-of-type {
  border-bottom: none;
}
.goods-img {
  width: 88rpx;
  flex-shrink: 0;
  border-radius: var(--radius-sm);
  overflow: hidden;
}
.goods-name {
  flex: 1;
  min-width: 0;
  font-size: 24rpx;
  color: var(--text-1);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.goods-right {
  flex-shrink: 0;
  text-align: right;
}
.goods-price {
  display: block;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--pink-deep);
}
.goods-qty {
  display: block;
  font-size: 20rpx;
  color: var(--text-3);
}
.demo-note {
  display: block;
  margin-top: 22rpx;
  font-size: 21rpx;
  line-height: 1.55;
  color: var(--text-3);
}
.actions {
  display: flex;
  gap: 16rpx;
  margin-top: 16rpx;
}
.act {
  flex: 1;
}
.act.disabled {
  opacity: 0.6;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
