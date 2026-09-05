<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { fetchMallProducts, type MallCategory, type MallProduct } from '@/api/mall'
import { isAuthError } from '@/utils/request'
import { useCartStore } from '@/stores/cart'
import { useWishlistStore } from '@/stores/wishlist'
import { mallProductToAccessoryContext, setAccessoryPageContext } from '@/utils/accessoryContext'

/*
 * 商城商品来自服务端 scene_catalog（规格 §4.4 §10.6），和功能四场景模拟
 * 选的是同一份目录，所以每件都带真实价格、淘宝链接与淘口令，
 * 加购走 /api/cart 的 item_type='catalog'，购物车页能查得到。
 * 以前这里读 data/mock.ts，服务端查无此物，只能收进本地心愿单假装加购。
 */
const cart = useCartStore()
// 心愿单仍是纯本地的「收藏」，和购物车是两件事
const wishlist = useWishlistStore()

const categories = ref<MallCategory[]>([])
const products = ref<MallProduct[]>([])
const activeCat = ref('')
const loading = ref(false)
const errorMessage = ref('')
const detail = ref<MallProduct | null>(null)
/** 淘口令弹窗目标（§4.4：小程序写剪贴板，H5 先试跳转再复制） */
const purchaseTarget = ref<MallProduct | null>(null)

const isH5 = computed(() => {
  // #ifdef H5
  return true
  // #endif
  // #ifndef H5
  return false
  // #endif
})

const catLabel = computed(() => categories.value.find((c) => c.key === activeCat.value)?.label ?? '商城')

const filtered = computed(() =>
  activeCat.value ? products.value.filter((p) => p.category === activeCat.value) : products.value,
)

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1600)
}

async function loadProducts() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchMallProducts()
    categories.value = data.categories
    products.value = data.items
    if (!activeCat.value || !data.categories.some((c) => c.key === activeCat.value)) {
      activeCat.value = data.categories[0]?.key ?? ''
    }
  } catch (error) {
    // 未登录已由请求层跳登录页，这里再报一次错只是噪音（规格 §5）
    if (!isAuthError(error)) {
      errorMessage.value = error instanceof Error ? error.message : '商品加载失败'
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  cart.load()
  loadProducts()
})

/** 当前分类整类加购。服务端按 id 重新取价，不信前端传的值 */
async function buyAll() {
  const items = filtered.value
  if (!items.length) return
  await cart.addBatch(items.map((p) => ({ itemType: 'catalog' as const, itemId: p.id })))
  if (cart.error) {
    showToast(cart.error)
    return
  }
  showToast(`已把 ${items.length} 件${catLabel.value}加入购物车`)
}

async function addFromSheet() {
  if (!detail.value) return
  const target = detail.value
  await cart.add('catalog', target.id)
  detail.value = null
  if (cart.error) {
    showToast(cart.error)
    return
  }
  showToast(`已加入购物车 · ${target.name}`)
}

/** §4.4：淘口令/链接购买。H5 先试着跳淘宝，被拦截就退回复制 */
function openPurchase(product: MallProduct) {
  purchaseTarget.value = product
  if (isH5.value && product.taobaoUrl) {
    setTimeout(() => {
      const opened = (globalThis as any).open?.(product.taobaoUrl, '_blank')
      if (!opened) copyPurchase()
    }, 350)
  }
}

function copyPurchase() {
  const target = purchaseTarget.value
  if (!target) return
  const text = target.taokouling || target.taobaoUrl
  if (!text) {
    showToast('该商品暂未配置淘口令')
    return
  }
  uni.setClipboardData({
    data: text,
    success: () => showToast('淘口令已复制'),
    fail: () => showToast('复制失败，请手动复制'),
  })
}

function buyFromSheet() {
  if (!detail.value) return
  const target = detail.value
  detail.value = null
  openPurchase(target)
}

function goCart() {
  uni.navigateTo({ url: '/pages/cart/index' })
}

function goAccessoryFromSheet() {
  if (!detail.value) return
  setAccessoryPageContext({
    source: 'mall',
    title: detail.value.name,
    outfit: [
      mallProductToAccessoryContext({
        ...detail.value,
        img: detail.value.imageUrl,
      }),
    ],
  })
  detail.value = null
  uni.navigateTo({ url: '/pages/accessory/index' })
}

function goFreeMatch() {
  uni.navigateTo({ url: '/pages/scene/index' })
}
</script>

<template>
  <view class="page page-stage">
    <!-- 顶部：分类名标题 + 购物车 -->
    <view class="topbar">
      <view class="row1">
        <text class="title">{{ catLabel }}</text>
        <view class="cart" aria-label="购物车" @tap="goCart">
          <UiIcon name="cart" :size="36" tone="dark" />
          <text v-if="cart.count" class="badge">{{ cart.count }}</text>
        </view>
      </view>
      <view class="search">
        <UiIcon class="s-ico" name="search" :size="34" tone="muted" />
        <text class="s-ph">搜上衣、鞋履、包袋…</text>
      </view>
    </view>

    <!-- 分类横向 tab -->
    <view class="cats hide-scrollbar">
      <view
        v-for="c in categories"
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
          <text class="b-cn">灵犀严选</text>
          <text class="b-en">Lingxi selected series</text>
        </view>
        <UiIcon class="banner-emoji" name="gem" :size="64" tone="white" :stroke-width="1.4" />
      </view>

      <view v-if="loading" class="empty">
        <UiIcon class="empty-emoji" name="mall" :size="88" tone="muted" :stroke-width="1.3" />
        <text>正在加载商品…</text>
      </view>
      <view v-else-if="errorMessage" class="empty">
        <UiIcon class="empty-emoji" name="warn" :size="88" tone="muted" :stroke-width="1.3" />
        <text>{{ errorMessage }}</text>
        <text class="empty-link" @tap="loadProducts">重新加载</text>
      </view>
      <view v-else-if="filtered.length" class="grid">
        <ProductCard
          v-for="p in filtered"
          :key="p.id"
          :title="p.name"
          :price="p.price"
          :emoji="p.emoji"
          :from="p.from"
          :to="p.to"
          :tag="p.categoryLabel"
          :src="p.imageUrl"
          :fav="wishlist.has(p.id)"
          @fav="wishlist.toggle(p.id)"
          @click="detail = p"
        />
      </view>
      <view v-else class="empty">
        <UiIcon class="empty-emoji" name="mall" :size="88" tone="muted" :stroke-width="1.3" />
        <text>这个分类暂时没有好物</text>
      </view>
    </scroll-view>

    <!-- 吸底操作条（在 BottomNav 之上） -->
    <view class="actionbar">
      <view class="btn btn-ghost pill" @tap="buyAll">
        <UiIcon name="cart" :size="32" tone="dark" />
        <text>一键加购</text>
      </view>
      <view class="btn btn-primary pill" @tap="goFreeMatch">
        <UiIcon name="sparkle" :size="32" tone="white" />
        <text>一键搭配</text>
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
      @buy="buyFromSheet"
      @accessory="goAccessoryFromSheet"
    />

    <!-- 淘口令弹窗（§4.4） -->
    <view v-if="purchaseTarget" class="mask" @tap="purchaseTarget = null">
      <view class="purchase-dialog" @tap.stop>
        <text class="purchase-symbol">↗</text>
        <text class="purchase-title">正在前往淘宝…</text>
        <text class="purchase-product">{{ purchaseTarget.name }}</text>
        <text class="purchase-command">
          {{ purchaseTarget.taokouling || purchaseTarget.taobaoUrl || '暂未配置淘口令' }}
        </text>
        <view class="btn btn-primary purchase-copy" @tap="copyPurchase">复制链接 / 淘口令</view>
        <text class="purchase-close" @tap="purchaseTarget = null">继续看看</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.topbar {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 20rpx;
  padding: calc(env(safe-area-inset-top, 24rpx) + 24rpx) 32rpx 16rpx;
}

.row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.title {
  margin: 0;
  font-size: 44rpx;
  font-weight: 500;
  color: var(--text-1);
}

.cart {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80rpx;
  height: 80rpx;
  font-size: 40rpx;
  background: var(--surface);
  border-radius: 50%;
  box-shadow: var(--shadow-card);
}

.badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 36rpx;
  height: 36rpx;
  padding: 0 8rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #fff;
  background: var(--pink-deep);
  border-radius: var(--radius-pill);
  box-shadow: 0 0 0 4rpx var(--surface);
}

.search {
  display: flex;
  gap: 16rpx;
  align-items: center;
  height: 80rpx;
  padding: 0 28rpx;
  background: var(--surface-soft);
  border-radius: var(--radius-pill);
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
  display: flex;
  flex-shrink: 0;
  gap: 16rpx;
  padding: 12rpx 32rpx 20rpx;
  overflow-x: auto;
}

.cat {
  flex-shrink: 0;
  padding: 14rpx 32rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: var(--text-2);
  background: var(--surface-soft);
  border-radius: var(--radius-pill);
  transition: all 0.15s ease;
}

.cat.on {
  color: var(--text-on-brand);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-card);
}

.body {
  padding: 4rpx 32rpx 24rpx;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 36rpx;
  margin-bottom: 24rpx;
  background: var(--brand-gradient);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.banner-txt {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.b-cn {
  margin: 0;
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-on-brand);
}

.b-en {
  margin: 0;
  font-size: 24rpx;
  font-weight: 500;
  color: rgb(255 255 255 / 85%);
  letter-spacing: 1rpx;
}

.banner-emoji {
  font-size: 60rpx;
  filter: drop-shadow(0 6rpx 12rpx rgb(0 0 0 / 18%));
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  align-items: center;
  padding-top: 140rpx;
  font-size: 28rpx;
  color: var(--text-3);
  text-align: center;
}

.empty-emoji {
  display: block;
  margin-bottom: 16rpx;
  font-size: 88rpx;
}

.empty-link {
  font-weight: 700;
  color: var(--purple-deep);
}

/* 淘口令弹窗（§4.4） */
.purchase-dialog {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: center;
  width: 76%;
  padding: 44rpx 36rpx 32rpx;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
}

.purchase-symbol {
  font-size: 56rpx;
  color: var(--purple-deep);
}

.purchase-title {
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-1);
}

.purchase-product {
  font-size: 28rpx;
  color: var(--text-2);
  text-align: center;
}

.purchase-command {
  width: 100%;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--pink-deep);
  text-align: center;
  word-break: break-all;
  background: var(--surface-soft);
  border-radius: var(--radius);
}

.purchase-copy {
  width: 100%;
  height: 88rpx;
  font-size: 28rpx;
  border-radius: var(--radius-pill);
}

.purchase-close {
  padding: 8rpx;
  font-size: 26rpx;
  color: var(--text-3);
}

.actionbar {
  display: flex;
  flex-shrink: 0;
  gap: 24rpx;
  padding: 20rpx 32rpx;
  background: rgb(255 255 255 / 72%);
  border-top: 1px solid var(--line);
  backdrop-filter: blur(10px);
}

.pill {
  flex: 1;
  height: 92rpx;
  font-size: 30rpx;
  border-radius: var(--radius-pill);
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
