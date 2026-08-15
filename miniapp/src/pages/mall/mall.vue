<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BottomNav from '@/components/BottomNav/BottomNav.vue'
import ProductCard from '@/components/ProductCard/ProductCard.vue'
import { MALL_CATEGORIES, MALL_PRODUCTS, type MallProduct } from '@/data/mock'
import { useCartStore } from '@/stores/cart'
import { useWishlistStore } from '@/stores/wishlist'
import MallDetailSheet from './MallDetailSheet.vue'
import {
  mallProductToAccessoryContext,
  setAccessoryPageContext,
} from '@/utils/accessoryContext'

// 购物车徽标与入口走真实服务端购物车（规格 §4.5 §13）
const cart = useCartStore()
// 商城商品来自 data/mock.ts，服务端目录里没有对应记录，
// 所以爱心只能是本地心愿单，不能冒充落库的购物车。
const wishlist = useWishlistStore()

onMounted(() => {
  cart.load()
})

const activeCat = ref(MALL_CATEGORIES[0].key)
const detail = ref<MallProduct | null>(null)

const catLabel = computed(
  () => MALL_CATEGORIES.find((c) => c.key === activeCat.value)?.label ?? '商城',
)

const filtered = computed(() =>
  MALL_PRODUCTS.filter((p) => p.category === activeCat.value),
)

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1600)
}

/*
 * 商城商品是演示目录（data/mock.ts），服务端 accessories / scene_catalog
 * 里没有对应记录，直接加购只会拿到 404。所以这里只收进本地心愿单，
 * 并把人指向真实可购买的配饰页 —— 不假装加进了落库的购物车。
 */
function buyAll() {
  const items = filtered.value
  items.forEach((p) => wishlist.add(p.id))
  showToast(`已收藏 ${items.length} 件${catLabel.value}，去配饰页可真实加购`)
}

function addFromSheet() {
  if (!detail.value) return
  wishlist.add(detail.value.id)
  showToast('已收藏，去配饰页可真实加购 ✨')
  detail.value = null
}

function goCart() {
  uni.navigateTo({ url: '/pages/cart/index' })
}

function goAccessoryFromSheet() {
  if (!detail.value) return
  setAccessoryPageContext({
    source: 'mall',
    title: detail.value.name,
    outfit: [mallProductToAccessoryContext(detail.value)],
  })
  detail.value = null
  uni.navigateTo({ url: '/pages/accessory/index' })
}

function goFreeMatch() {
  showToast('自由搭配功能开发中～')
}
</script>

<template>
  <view class="page">
    <!-- 顶部：分类名标题 + 购物车 -->
    <view class="topbar">
      <view class="row1">
        <text class="title">{{ catLabel }}</text>
        <view class="cart" aria-label="购物车" @tap="goCart">
          <text>🛒</text>
          <text v-if="cart.count" class="badge">{{ cart.count }}</text>
        </view>
      </view>
      <view class="search">
        <text class="s-ico">🔍</text>
        <text class="s-ph">搜首饰、包袋、好物…</text>
      </view>
    </view>

    <!-- 分类横向 tab -->
    <view class="cats hide-scrollbar">
      <view
        v-for="c in MALL_CATEGORIES"
        :key="c.key"
        class="cat"
        :class="{ on: activeCat === c.key }"
        @tap="activeCat = c.key"
      >
        <text>{{ c.label }}</text>
      </view>
    </view>

    <!-- 商品网格 -->
    <scroll-view class="body" scroll-y="true" :show-scrollbar="false">
      <!-- 系列 banner -->
      <view class="banner">
        <view class="banner-txt">
          <text class="b-cn">现货系列</text>
          <text class="b-en">Bar clip series</text>
        </view>
        <text class="banner-emoji">💎</text>
      </view>

      <view v-if="filtered.length" class="grid">
        <ProductCard
          v-for="p in filtered"
          :key="p.id"
          :title="p.name"
          :price="p.price"
          :emoji="p.emoji"
          :from="p.from"
          :to="p.to"
          :tag="p.tag"
          :src="p.img"
          :fav="wishlist.has(p.id)"
          @fav="wishlist.toggle(p.id)"
          @click="detail = p"
        />
      </view>
      <view v-else class="empty">
        <text class="empty-emoji">🛍️</text>
        <text>这个分类暂时没有好物</text>
      </view>
    </scroll-view>

    <!-- 吸底操作条（在 BottomNav 之上） -->
    <view class="actionbar">
      <view class="btn btn-ghost pill" @tap="buyAll">
        <text>🛒 一键购买</text>
      </view>
      <view class="btn btn-primary pill" @tap="goFreeMatch">
        <text>✨ 一键搭配</text>
      </view>
    </view>

    <BottomNav active="mall" />

    <!-- 轻提示 -->
    <view v-if="toast" class="toast" :class="{ 'toast-show': !!toast }">{{ toast }}</view>

    <!-- 商品详情底部弹层 -->
    <MallDetailSheet
      :product="detail"
      :fav="detail ? wishlist.has(detail.id) : false"
      @close="detail = null"
      @fav="detail && wishlist.toggle(detail.id)"
      @add="addFromSheet"
      @accessory="goAccessoryFromSheet"
    />
  </view>
</template>

<style scoped>
.page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

.topbar {
  flex-shrink: 0;
  padding: calc(env(safe-area-inset-top, 24rpx) + 24rpx) 32rpx 16rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  margin: 0;
  font-size: 44rpx;
  font-weight: 800;
  color: var(--text-1);
}
.cart {
  position: relative;
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  background: var(--surface);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  box-shadow: var(--shadow-card);
}
.badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 8rpx;
  border-radius: 999px;
  background: var(--pink-deep);
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 0 4rpx var(--surface);
}
.search {
  display: flex;
  align-items: center;
  gap: 16rpx;
  height: 80rpx;
  padding: 0 28rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  box-shadow: var(--shadow-card);
}
.s-ico {
  font-size: 30rpx;
}
.s-ph {
  font-size: 28rpx;
  color: var(--text-3);
}

.cats {
  flex-shrink: 0;
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding: 12rpx 32rpx 20rpx;
}
.cat {
  flex-shrink: 0;
  padding: 14rpx 32rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.15s ease;
}
.cat.on {
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  box-shadow: var(--shadow-card);
}

.body {
  flex: 1;
  min-height: 0;
  padding: 4rpx 32rpx 24rpx;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 36rpx;
  border-radius: var(--radius);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-card);
  margin-bottom: 24rpx;
}
.banner-txt {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.b-cn {
  margin: 0;
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-on-brand);
}
.b-en {
  margin: 0;
  font-size: 24rpx;
  font-weight: 600;
  letter-spacing: 1rpx;
  color: rgba(255, 255, 255, 0.85);
}
.banner-emoji {
  font-size: 60rpx;
  filter: drop-shadow(0 6rpx 12rpx rgba(0, 0, 0, 0.18));
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}
.empty {
  padding-top: 140rpx;
  text-align: center;
  color: var(--text-3);
  font-size: 28rpx;
}
.empty-emoji {
  font-size: 88rpx;
  display: block;
  margin-bottom: 16rpx;
}

.actionbar {
  flex-shrink: 0;
  display: flex;
  gap: 24rpx;
  padding: 20rpx 32rpx;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--line);
}
.pill {
  flex: 1;
  height: 92rpx;
  border-radius: var(--radius-pill);
  font-size: 30rpx;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 240rpx;
  transform: translateX(-50%);
  z-index: 40;
  max-width: 80%;
  padding: 20rpx 36rpx;
  border-radius: var(--radius-pill);
  background: rgba(40, 24, 48, 0.85);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-float);
  opacity: 0;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-show {
  opacity: 1;
  transform: translateX(-50%) translateY(-8rpx);
}

/* 隐藏滚动条 */
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
