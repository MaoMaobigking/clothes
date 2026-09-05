<script setup lang="ts">
/*
 * 演示商城订单列表。
 *
 * 和 pages/custom/orders 是两回事：那一页是定制服务的 custom_requests，
 * 这一页是购物车结算出来的 shop_orders。「我的订单」里两个入口分开列，
 * 合并成一个列表会把两套完全不同的状态机混在同一条时间线上。
 */
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { fetchOrders, type ShopOrder } from '@/api/order'
import { isAuthError } from '@/api/http'

const orders = ref<ShopOrder[]>([])
const loading = ref(true)
const errorText = ref('')

async function load() {
  try {
    orders.value = await fetchOrders()
    errorText.value = ''
  } catch (error) {
    if (!isAuthError(error)) {
      errorText.value = error instanceof Error ? error.message : '订单加载失败'
    }
  } finally {
    loading.value = false
  }
}

// onShow 而不是 onLoad：从详情页推进过状态再返回，列表要跟着变
onShow(load)

function openOrder(id: number) {
  uni.navigateTo({ url: `/pages/order-detail/index?id=${id}` })
}

/** 商城是 tabBar 页，只能 switchTab */
function goShopping() {
  uni.switchTab({ url: '/pages/mall/mall' })
}
</script>

<template>
  <view class="page">
    <PageHeader title="商城订单" to="/pages/me/me" />

    <scroll-view scroll-y class="body hide-scrollbar">
      <view v-if="loading" class="state">加载中…</view>
      <view v-else-if="errorText" class="state error">{{ errorText }}</view>
      <view v-else-if="!orders.length" class="state">
        <text class="empty-title">还没有订单</text>
        <text class="empty-sub">购物车里选好东西，去结算就会出现在这里</text>
        <view class="btn btn-primary empty-btn" @tap="goShopping">去商城看看</view>
      </view>

      <template v-else>
        <text class="tip">演示订单：没有接微信支付，状态由订单详情里的按钮手动推进</text>
        <view v-for="order in orders" :key="order.id" class="card" @tap="openOrder(order.id)">
          <view class="head">
            <text class="order-no">{{ order.orderNo }}</text>
            <text class="status" :class="{ off: order.status === 'cancelled' }">
              {{ order.statusLabel }}
            </text>
          </view>
          <text class="names">
            {{ order.items.map((item) => item.name).join('、') || '（无商品）' }}
          </text>
          <view class="foot">
            <text class="count">共 {{ order.items.length }} 项</text>
            <text class="pay">实付 ¥{{ order.payAmount }}</text>
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
  font-size: 26rpx;
  color: var(--text-3);
  text-align: center;
}

.state.error {
  color: #d04c5b;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-1);
}

.empty-sub {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
}

.empty-btn {
  width: 300rpx;
  margin: 26rpx auto 0;
}

.tip {
  display: block;
  margin-top: 14rpx;
  font-size: 21rpx;
  line-height: 1.5;
  color: var(--text-3);
}

.card {
  padding: 22rpx;
  margin-top: 18rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.head {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
}

.order-no {
  font-size: 21rpx;
  color: var(--text-3);
}

.status {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--pink-deep);
}

.status.off {
  color: var(--text-3);
}

.names {
  display: block;
  margin-top: 12rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 25rpx;
  color: var(--text-1);
  white-space: nowrap;
}

.foot {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding-top: 12rpx;
  margin-top: 14rpx;
  border-top: 1px solid var(--line);
}

.count {
  font-size: 21rpx;
  color: var(--text-3);
}

.pay {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--pink-deep);
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
