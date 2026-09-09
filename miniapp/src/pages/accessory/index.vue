<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useWardrobeStore } from '@/stores/wardrobe'
import { useProfileStore } from '@/stores/profile'
import { useCartStore } from '@/stores/cart'
import { MODEL_IMAGES } from '@/constants/ui'
import type { Garment } from '@/types'
import { fetchMallProducts, type MallProduct } from '@/api/mall'
import { resolveImageUrl } from '@/api/wardrobe'
import {
  fetchAccessoryRecommendations,
  rateAccessory,
  type Accessory,
  type AccessoryContextItem,
  type AccessoryRecommendations,
} from '@/api/accessories'
import type { CartItem } from '@/api/cart'
import {
  ACCESSORY_CATEGORY_EMOJI,
  buildFallbackRecommendations,
  saveLocalAccessoryRating,
} from '@/utils/accessoryFallback'
import {
  garmentToAccessoryContext,
  getAccessoryPageContext,
  mallProductToAccessoryContext,
} from '@/utils/accessoryContext'
import { toast } from '@/utils/toast'
import { go } from '@/utils/nav'

type PickerItem = { kind: 'garment'; item: Garment } | { kind: 'mall'; item: MallProduct }

const wardrobe = useWardrobeStore()
const profile = useProfileStore()
/*
 * 购物车统一走 stores/cart（规格 §4.5 §13）。
 *
 * 这一页原来自己维护了一份 `cart = ref<AccessoryCart>()`，外加一整套
 * 「接口可用走服务端 / 否则写 localStorage」的双路径，五个函数里各抄了一遍
 *   cart.count = items.reduce(...) + saveLocalAccessoryCart(cart)
 *
 * 拆掉它的两个理由（不只是重复）：
 *
 * 1. **本地兜底车和「查看完整购物车」自相矛盾。** 抽屉底部那个按钮跳
 *    /pages/cart/index，那一页读的是 stores/cart（服务端车）。离线时这里
 *    弹「已加入购物车」，跳过去却是空的 —— 演示时看着像丢数据的 bug，
 *    比老老实实报一句「加入失败」更糟。而且本地车用的是 LOCAL_ACCESSORIES
 *    里的假 id，服务端根本不认，两边永远合不到一起。
 *
 * 2. **usingApi 判的是推荐接口，却拿来决定购物车走哪条路。** 推荐挂了但
 *    购物车好着的时候（比如没有搭配上下文），加购会被塞进 localStorage，
 *    服务端车里什么都没有 —— 这是两个服务被一个开关混在了一起。
 *
 * 所以：购物车只有服务端一个真相，失败就如实报错。
 * usingApi 保留，但只再负责它本来该管的事 —— 推荐和评分要不要走本地兜底。
 */
const cart = useCartStore()

const currentOutfit = ref<AccessoryContextItem[]>([])
const contextSource = ref<'outfit' | 'garment' | 'mall'>('garment')
const contextTitle = ref('当前服装')
const recommendations = ref<AccessoryRecommendations | null>(null)
const activeCategory = ref('jewelry')
const selectedAccessory = ref<Accessory | null>(null)
const loading = ref(true)
const usingApi = ref(false)
const cartOpen = ref(false)
const pickerOpen = ref(false)
const pickerTab = ref<'garment' | 'mall'>('garment')
const purchaseTarget = ref<Accessory | null>(null)
const isH5 = ref(false)

const activeCategoryData = computed(() =>
  recommendations.value?.categories.find((category) => category.key === activeCategory.value),
)

const activeItems = computed(() => activeCategoryData.value?.items || [])

const currentOutfitTitle = computed(
  () => contextTitle.value || recommendations.value?.currentOutfit.anchor.name || '当前服装',
)

const currentOutfitTags = computed(() => {
  const data = recommendations.value
  if (!data) return []
  const tags = [data.currentOutfit.anchor.categoryLabel, ...data.currentOutfit.occasions, ...data.currentOutfit.seasons]
  return Array.from(new Set(tags.filter(Boolean))).slice(0, 5)
})

const tryonModelSrc = computed(() => (profile.profile.gender === 'male' ? MODEL_IMAGES.frontMale : MODEL_IMAGES.front))

const pickerGarments = computed<PickerItem[]>(() =>
  wardrobe.items.slice(0, 40).map((item) => ({ kind: 'garment', item })),
)

// 「换服装」里的商城候选来自服务端目录（scene_catalog），
// 和商城页同源，配饰推荐拿到的品类、配色才对得上（规格 §4.4 §10.6）
const mallProducts = ref<MallProduct[]>([])

const pickerMallItems = computed<PickerItem[]>(() =>
  mallProducts.value.slice(0, 10).map((item) => ({ kind: 'mall', item })),
)

const pickerItems = computed(() => (pickerTab.value === 'garment' ? pickerGarments.value : pickerMallItems.value))

onLoad(async () => {
  // #ifdef H5
  isH5.value = true
  // #endif

  await wardrobe.load()
  const context = getAccessoryPageContext(true)
  if (context?.outfit.length) {
    currentOutfit.value = context.outfit
    contextSource.value = context.source
    contextTitle.value = context.title
    pickerOpen.value = false
  } else {
    pickerOpen.value = true
  }

  await Promise.all([loadRecommendations(), cart.load(), loadMallProducts()])
})

async function loadMallProducts() {
  try {
    const data = await fetchMallProducts()
    mallProducts.value = data.items
  } catch {
    // 目录拉不到就只剩衣橱那一栏可选，不阻断配饰推荐
    mallProducts.value = []
  }
}

function displaySrc(src?: string) {
  return resolveImageUrl(src || '')
}

/** 衣橱item 用 img，商城目录用 imageUrl，取图统一在这里分流 */
function pickerImage(entry: PickerItem) {
  return displaySrc(entry.kind === 'garment' ? entry.item.img : entry.item.imageUrl)
}

function accessoryEmoji(item: Pick<Accessory, 'category' | 'emoji'>) {
  return item.emoji || ACCESSORY_CATEGORY_EMOJI[item.category] || '✨'
}

function displayPrice(item: Accessory) {
  if (recommendations.value?.discountEligible) {
    return item.discountPrice ?? item.originalPrice ?? item.price
  }
  return item.price
}

async function loadRecommendations() {
  if (!currentOutfit.value.length) return
  loading.value = true
  try {
    recommendations.value = await fetchAccessoryRecommendations({
      outfit: currentOutfit.value,
    })
    usingApi.value = true
  } catch {
    recommendations.value = buildFallbackRecommendations(currentOutfit.value)
    usingApi.value = false
  } finally {
    const first = recommendations.value?.categories[0]?.items[0] || null
    activeCategory.value = recommendations.value?.categories[0]?.key || 'jewelry'
    selectedAccessory.value = first
    loading.value = false
  }
}

async function selectGarment(garment: Garment) {
  currentOutfit.value = [garmentToAccessoryContext(garment)]
  contextSource.value = 'garment'
  contextTitle.value = garment.name
  pickerOpen.value = false
  await loadRecommendations()
}

async function selectMallProduct(product: MallProduct) {
  currentOutfit.value = [mallProductToAccessoryContext({ ...product, img: product.imageUrl })]
  contextSource.value = 'mall'
  contextTitle.value = product.name
  pickerOpen.value = false
  await loadRecommendations()
}

function openPicker() {
  pickerOpen.value = true
}

function selectCategory(key: string) {
  activeCategory.value = key
  const first = recommendations.value?.categories.find((category) => category.key === key)?.items[0]
  selectedAccessory.value = first || null
}

function tryOn(item: Accessory) {
  if (!item.tryonEnabled) {
    toast('这件配饰暂无试戴素材')
    return
  }
  selectedAccessory.value = item
}

async function submitRating(item: Accessory, score: number) {
  const previous = item.userRating
  item.userRating = score
  if (usingApi.value) {
    try {
      const result = await rateAccessory(item.id, score)
      item.aggregateRating = result.aggregateRating
    } catch (error) {
      item.userRating = previous
      toast((error as Error).message || '评分失败')
      return
    }
  } else {
    saveLocalAccessoryRating(item.id, score)
  }
  toast(`已提交 ${score} 星评分`)
  await loadRecommendations()
}

async function addAccessory(item: Accessory) {
  try {
    await cart.add('accessory', item.id)
  } catch (error) {
    toast((error as Error).message || '加入购物车失败')
    return
  }
  toast('已加入购物车')
}

/*
 * 分类维度「一键加入购物车」（客户需求原文：支持"一键加入购物车"或"单独购买"）。
 * 把当前分类下的推荐配饰整批写入购物车，走 store 的 addBatch。
 */
async function addActiveCategoryToCart() {
  const items = activeItems.value
  if (!items.length) {
    toast('这个分类暂无推荐')
    return
  }
  try {
    await cart.addBatch(items.map((item) => ({ itemType: 'accessory' as const, itemId: item.id })))
  } catch (error) {
    toast((error as Error).message || '加入购物车失败')
    return
  }
  toast(`${activeCategoryData.value?.label || '本类'} ${items.length} 件已加入购物车`)
}

async function addOutfitToCart() {
  if (!currentOutfit.value.length) return
  if (contextSource.value === 'mall') {
    toast('商城商品可直接从详情页购买')
    return
  }
  try {
    await cart.addBatch(currentOutfit.value.map((item) => ({ itemType: 'garment' as const, itemId: item.id })))
  } catch (error) {
    toast((error as Error).message || '加入购物车失败')
    return
  }
  // 车里有了当前服装，配饰要重新算搭配价（discountEligible 由服务端判定）
  await loadRecommendations()
  toast('当前服装已入车，配饰显示搭配价')
}

/** 抽屉内改数量（规格 §9.7 §4.5「商品可以修改数量或删除」）。1–99 的夹取在 store 里 */
async function changeCartQuantity(item: CartItem, delta: number) {
  const next = item.quantity + delta
  if (next < 1) {
    await removeCartItem(item.cartId)
    return
  }
  if (next > 99) {
    toast('单件最多 99 件')
    return
  }
  try {
    await cart.setQuantity(item.cartId, next)
  } catch (error) {
    toast((error as Error).message || '修改数量失败')
  }
}

/** §9.2 §4.5：从配饰抽屉进完整购物车 */
function goFullCart() {
  cartOpen.value = false
  go('cart')
}

async function removeCartItem(id: number) {
  try {
    await cart.remove(id)
  } catch (error) {
    toast((error as Error).message || '删除失败')
  }
}

function openPurchase(item: Accessory) {
  purchaseTarget.value = item
  if (isH5.value) {
    setTimeout(() => {
      const opened = (globalThis as any).open?.(item.taobaoUrl || '', '_blank')
      if (!opened) copyPurchase()
    }, 350)
  }
}

function closePurchase() {
  purchaseTarget.value = null
}

function copyPurchase() {
  if (!purchaseTarget.value) return
  const text = purchaseTarget.value.taokouling || purchaseTarget.value.taobaoUrl
  uni.setClipboardData({
    data: text,
    success: () => toast('淘口令已复制'),
  })
}

function copyCartItem(item: CartItem) {
  uni.setClipboardData({
    data: item.taokouling || item.name,
    success: () => toast('淘口令已复制'),
  })
}
</script>

<template>
  <view class="page page-stage">
    <PageHeader title="配饰推荐" to="/pages/home/home">
      <template #right>
        <view class="cart-button" @tap="cartOpen = true">
          <UiIcon name="cart" :size="32" tone="dark" />
          <text v-if="cart.count" class="cart-badge">{{ cart.count }}</text>
        </view>
      </template>
    </PageHeader>

    <scroll-view scroll-y class="body hide-scrollbar">
      <view v-if="loading" class="loading">
        <view class="loading-dot" />
        <text>正在为当前服装匹配配饰…</text>
      </view>

      <template v-else>
        <view class="current-card">
          <view class="current-head">
            <view>
              <view class="eyebrow">当前搭配</view>
              <view class="current-title">{{ currentOutfitTitle }}</view>
            </view>
            <view class="change-btn" @tap="openPicker">更换服装</view>
          </view>
          <view class="current-items">
            <TileImage
              v-for="piece in currentOutfit.slice(0, 5)"
              :key="piece.id"
              class="current-thumb"
              :src="displaySrc(piece.img)"
              :from="piece.from || '#ffd1e8'"
              :to="piece.to || '#c9b8ff'"
              :emoji="piece.emoji || '👕'"
              ratio="1 / 1"
              rounded="20rpx"
            />
          </view>
          <view class="current-tags">
            <text v-for="tag in currentOutfitTags" :key="tag" class="current-tag">{{ tag }}</text>
          </view>
          <view v-if="contextSource !== 'mall'" class="outfit-cart-btn" @tap="addOutfitToCart">
            将当前服装加入购物车以享搭配价
          </view>
        </view>

        <view v-if="recommendations?.discountEligible" class="discount-banner">
          <text class="discount-icon">✓</text>
          <text>购物车已有当前服装，下方价格已切换为搭配优惠价</text>
        </view>

        <view class="tryon-card">
          <view class="section-head">
            <view>
              <view class="section-main">3D 虚拟试戴</view>
              <view class="section-sub">拖拽旋转 · 双指缩放 · 正面背面切换</view>
            </view>
            <text class="demo-tag">演示素材</text>
          </view>
          <AvatarViewer
            :src="tryonModelSrc"
            label="我的虚拟形象"
            :shape="profile.avatarShape"
            :overlay="
              selectedAccessory
                ? {
                    slot: selectedAccessory.tryonSlot,
                    emoji: accessoryEmoji(selectedAccessory),
                    from: selectedAccessory.primaryColor,
                    to: selectedAccessory.secondaryColor,
                    imageUrl: selectedAccessory.imageUrl,
                    enabled: selectedAccessory.tryonEnabled,
                  }
                : null
            "
          />
          <view class="tryon-info">
            <template v-if="selectedAccessory">
              <text class="tryon-name">{{ selectedAccessory.name }}</text>
              <text v-if="selectedAccessory.tryonEnabled" class="tryon-status on">当前已叠加试戴</text>
              <text v-else class="tryon-status">暂无试戴素材</text>
            </template>
            <text v-else class="tryon-status">选择一件配饰开始试戴</text>
          </view>
        </view>

        <scroll-view scroll-x class="category-tabs hide-scrollbar">
          <view
            v-for="category in recommendations?.categories || []"
            :key="category.key"
            class="category-tab"
            :class="{ on: activeCategory === category.key }"
            @tap="selectCategory(category.key)"
          >
            <text class="category-emoji">{{ ACCESSORY_CATEGORY_EMOJI[category.key] }}</text>
            <text>{{ category.label }}</text>
          </view>
        </scroll-view>

        <!-- 分类维度的一键加购（客户需求原文的「一键加入购物车」） -->
        <view v-if="activeItems.length" class="category-bulk">
          <text class="category-bulk-label">
            {{ activeCategoryData?.label || '本类' }}推荐 {{ activeItems.length }} 件
          </text>
          <view class="btn btn-primary category-bulk-btn" @tap="addActiveCategoryToCart">一键加入购物车</view>
        </view>

        <view v-if="activeItems.length" class="accessory-list">
          <view v-for="item in activeItems" :key="item.id" class="accessory-card">
            <view class="accessory-image">
              <TileImage
                fill
                :src="displaySrc(item.imageUrl)"
                :from="item.primaryColor"
                :to="item.secondaryColor"
                :emoji="accessoryEmoji(item)"
                ratio="1 / 1"
                rounded="28rpx"
              />
              <view class="match-badge">{{ item.matchScore }}% 匹配</view>
            </view>

            <view class="accessory-info">
              <view class="accessory-top">
                <view>
                  <view class="accessory-name">{{ item.name }}</view>
                  <view class="accessory-meta">
                    {{ item.brand }} · {{ item.aggregateRating.toFixed(1) }} 分
                    <text v-if="item.ratingCount">· {{ item.ratingCount }} 人评</text>
                  </view>
                </view>
                <view class="price-block">
                  <text class="price-now">¥{{ displayPrice(item) }}</text>
                  <text v-if="recommendations?.discountEligible && item.discountPrice" class="price-old">
                    ¥{{ item.price }}
                  </text>
                </view>
              </view>

              <view class="match-reason">{{ item.matchReason }}</view>

              <view class="rating-row">
                <text class="rating-label">我的评分</text>
                <view class="stars">
                  <text
                    v-for="score in 5"
                    :key="score"
                    class="star"
                    :class="{ on: (item.userRating || 0) >= score }"
                    @tap="submitRating(item, score)"
                  >
                    ★
                  </text>
                </view>
              </view>

              <view class="accessory-actions">
                <view class="accessory-action" :class="{ disabled: !item.tryonEnabled }" @tap="tryOn(item)">试戴</view>
                <view class="accessory-action" @tap="addAccessory(item)">加购</view>
                <view class="accessory-action primary" @tap="openPurchase(item)">购买</view>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="empty-recommend">
          <UiIcon class="empty-recommend-emoji" name="mirror" :size="88" tone="muted" :stroke-width="1.3" />
          <text>这个分类暂无强匹配，可查看其他风格</text>
        </view>

        <view class="hot-section">
          <view class="section-head">
            <view>
              <view class="section-main">热门搭配榜</view>
              <view class="section-sub">来自数据库中的评分与互动热度</view>
            </view>
            <text class="demo-tag">{{ recommendations?.source === 'rule' ? '真实数据' : '本地演示' }}</text>
          </view>
          <view v-for="(combo, index) in recommendations?.hotCombos || []" :key="combo.id" class="hot-card">
            <view class="hot-rank">{{ index + 1 }}</view>
            <view class="hot-main">
              <view class="hot-title">{{ combo.title }}</view>
              <view class="hot-sub">{{ combo.subtitle }} · {{ combo.favoriteCount }} 次互动</view>
              <scroll-view scroll-x class="hot-items hide-scrollbar">
                <view v-for="hotItem in combo.items" :key="hotItem.id" class="hot-item">
                  <TileImage
                    class="hot-thumb"
                    :src="displaySrc(hotItem.imageUrl)"
                    :from="hotItem.from"
                    :to="hotItem.to"
                    :emoji="hotItem.emoji"
                    ratio="1 / 1"
                    rounded="18rpx"
                  />
                  <text class="hot-name">{{ hotItem.name }}</text>
                </view>
              </scroll-view>
            </view>
            <text class="hot-score">{{ combo.score }}</text>
          </view>
        </view>
      </template>
    </scroll-view>

    <Sheet v-if="pickerOpen" title="选择当前服装" @close="pickerOpen = false">
      <view class="picker-tabs">
        <view class="picker-tab" :class="{ on: pickerTab === 'garment' }" @tap="pickerTab = 'garment'">我的衣橱</view>
        <view class="picker-tab" :class="{ on: pickerTab === 'mall' }" @tap="pickerTab = 'mall'">商城商品</view>
      </view>
      <scroll-view scroll-y class="picker-list">
        <view v-if="pickerItems.length" class="picker-grid">
          <view
            v-for="entry in pickerItems"
            :key="`${entry.kind}-${entry.item.id}`"
            class="picker-item"
            @tap="entry.kind === 'garment' ? selectGarment(entry.item) : selectMallProduct(entry.item)"
          >
            <TileImage
              :src="pickerImage(entry)"
              :from="entry.item.from"
              :to="entry.item.to"
              :emoji="entry.item.emoji"
              ratio="1 / 1"
              rounded="20rpx"
            />
            <text class="picker-name">{{ entry.item.name }}</text>
          </view>
        </view>
        <view v-else class="picker-empty">
          <text>暂无可选服装</text>
          <text v-if="pickerTab === 'garment'" class="picker-link" @tap="wardrobe.load()">刷新衣橱</text>
        </view>
      </scroll-view>
    </Sheet>

    <view v-if="purchaseTarget" class="mask purchase-mask" @tap="closePurchase">
      <view class="purchase-dialog" @tap.stop>
        <view class="purchase-symbol">↗</view>
        <view class="purchase-title">正在前往淘宝…</view>
        <view class="purchase-dots">
          <text v-for="dot in 3" :key="dot" class="purchase-dot" />
        </view>
        <view class="purchase-product">{{ purchaseTarget.name }}</view>
        <view class="purchase-command">{{ purchaseTarget.taokouling || purchaseTarget.taobaoUrl }}</view>
        <view class="btn btn-primary purchase-copy" @tap="copyPurchase">复制链接 / 淘口令</view>
        <view class="purchase-close" @tap="closePurchase">继续看看</view>
      </view>
    </view>

    <Sheet v-if="cartOpen" title="配饰购物车" @close="cartOpen = false">
      <scroll-view scroll-y class="cart-list">
        <view v-if="cart.items.length">
          <view v-for="item in cart.items" :key="item.cartId" class="cart-row">
            <TileImage
              class="cart-thumb"
              :src="displaySrc(item.imageUrl)"
              :from="item.from"
              :to="item.to"
              :emoji="item.emoji || '🛍️'"
              ratio="1 / 1"
              rounded="16rpx"
            />
            <view class="cart-info">
              <view class="cart-name">{{ item.name }}</view>
              <view class="cart-meta">¥{{ item.price }} × {{ item.quantity }}</view>
              <view class="cart-stepper">
                <view class="cart-step" @tap="changeCartQuantity(item, -1)">−</view>
                <text class="cart-qty">{{ item.quantity }}</text>
                <view class="cart-step" @tap="changeCartQuantity(item, 1)">+</view>
              </view>
            </view>
            <view class="cart-action" @tap="copyCartItem(item)">复制口令</view>
            <view class="cart-delete" @tap="removeCartItem(item.cartId)">×</view>
          </view>
        </view>
        <view v-else class="cart-empty">
          <UiIcon class="cart-empty-emoji" name="cart" :size="88" tone="muted" :stroke-width="1.3" />
          <text>购物车还是空的</text>
        </view>
      </scroll-view>
      <view class="btn btn-primary cart-full" @tap="goFullCart">查看完整购物车</view>
      <view class="btn btn-ghost cart-close" @tap="cartOpen = false">关闭</view>
    </Sheet>
  </view>
</template>

<style scoped>
.body {
  padding: 12rpx 30rpx 40rpx;
}

.cart-button {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 76rpx;
  height: 76rpx;
  font-size: var(--fs-3xl);
  background: rgb(255 255 255 / 80%);
  border-radius: 50%;
  box-shadow: var(--shadow-card);
}

.cart-badge {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 34rpx;
  height: 34rpx;
  padding: 0 7rpx;
  font-size: var(--fs-2xs);
  font-weight: 500;
  color: #fff;
  background: var(--pink-deep);
  border-radius: var(--radius-pill);
}

.loading {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
  align-items: center;
  padding-top: 220rpx;
  font-size: var(--fs-md);
  color: var(--text-2);
}

.loading-dot {
  width: 56rpx;
  height: 56rpx;
  border: 8rpx solid #f1d8e6;
  border-top-color: var(--pink-deep);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.current-card,
.tryon-card,
.hot-section,
.accessory-card {
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.current-card {
  padding: 28rpx;
}

/*
 * 本页的「小节头」是一行 flex：左边标题+副标题，右边一个 demo-tag。
 * 原来这个类叫 .section-title，和 components.css 里那个「一行小节标题」
 * 撞名了 —— 全局那个管字号字重，这里管的是行内布局，两码事。
 * 改名 .section-head，真正的标题文字在里面的 .section-main 上。
 */
.current-head,
.section-head {
  display: flex;
  gap: 20rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.eyebrow {
  font-size: var(--fs-sm);
  color: var(--text-3);
}

.current-title {
  margin-top: 4rpx;
  font-size: var(--fs-2xl);
  font-weight: 500;
  color: var(--text-1);
}

.change-btn {
  flex-shrink: 0;
  padding: 12rpx 22rpx;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--purple-deep);
  background: var(--surface-tint);
  border-radius: var(--radius-pill);
}

.current-items {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12rpx;
  margin-top: 22rpx;
}

.current-thumb {
  border: 4rpx solid #fff;
}

.current-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
  margin-top: 18rpx;
}

.current-tag {
  padding: 8rpx 18rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--pink-deep);
  background: #fff2f6;
  border-radius: var(--radius-pill);
}

.outfit-cart-btn {
  padding: 15rpx 18rpx;
  margin-top: 20rpx;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--purple-deep);
  text-align: center;
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.discount-banner {
  display: flex;
  gap: 12rpx;
  align-items: center;
  padding: 16rpx 22rpx;
  margin-top: 20rpx;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: #24765e;
  background: #e9f8f2;
  border-radius: var(--radius);
}

.discount-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  font-size: var(--fs-sm);
  color: #fff;
  background: #2e9b77;
  border-radius: 50%;
}

.tryon-card {
  padding: 28rpx 24rpx 24rpx;
  margin-top: 22rpx;
}

.section-head {
  margin-bottom: 8rpx;
}

.section-main {
  font-size: var(--fs-xl);
  font-weight: 500;
  color: var(--text-1);
}

.section-sub {
  margin-top: 5rpx;
  font-size: var(--fs-xs);
}

.demo-tag {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--purple-deep);
  background: var(--surface-tint);
  border-radius: var(--radius-pill);
}

.tryon-info {
  display: flex;
  gap: 14rpx;
  align-items: center;
  justify-content: center;
  margin-top: -4rpx;
}

.tryon-name {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-1);
}

.tryon-status {
  font-size: var(--fs-sm);
  color: var(--text-3);
}

.tryon-status.on {
  color: var(--success);
}

.category-bulk {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx 18rpx;
}

.category-bulk-label {
  font-size: var(--fs-base);
  color: var(--text-2);
}

.category-bulk-btn {
  display: flex;
  align-items: center;
  height: var(--btn-h-sm);
  padding: 0 26rpx;
  font-size: var(--fs-base);
}

.category-tabs {
  margin-top: 22rpx;
  white-space: nowrap;
}

.category-tab {
  display: inline-flex;
  gap: 8rpx;
  align-items: center;
  padding: 13rpx 24rpx;
  margin-right: 12rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.category-tab.on {
  color: #fff;
  background: var(--brand-gradient);
}

.category-emoji {
  font-size: var(--fs-md);
}

.accessory-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  margin-top: 22rpx;
}

.accessory-card {
  display: grid;
  grid-template-columns: 220rpx 1fr;
  gap: 22rpx;
  padding: 20rpx;
}

.accessory-image {
  position: relative;
  min-height: 220rpx;
}

.match-badge {
  position: absolute;
  top: 12rpx;
  left: 12rpx;
  z-index: 3;
  padding: 7rpx 14rpx;
  font-size: var(--fs-2xs);
  font-weight: 500;
  color: #fff;
  background: rgb(0 0 0 / 70%);
  border-radius: var(--radius-pill);
}

.accessory-info {
  min-width: 0;
}

.accessory-top {
  display: flex;
  gap: 12rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.accessory-name {
  font-size: var(--fs-lg);
  font-weight: 500;
  line-height: 1.3;
  color: var(--text-1);
}

.accessory-meta {
  margin-top: 6rpx;
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.price-block {
  flex-shrink: 0;
  text-align: right;
}

.price-now {
  font-size: var(--fs-xl);
  font-weight: 500;
  color: var(--pink-deep);
}

.price-old {
  display: block;
  margin-top: 2rpx;
  font-size: var(--fs-xs);
  color: var(--text-3);
  text-decoration: line-through;
}

.match-reason {
  padding: 12rpx 14rpx;
  margin-top: 14rpx;
  font-size: var(--fs-xs);
  line-height: 1.45;
  color: var(--text-2);
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.rating-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
  margin-top: 14rpx;
}

.rating-label {
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.stars {
  display: flex;
  gap: 4rpx;
}

.star {
  font-size: var(--fs-md);
  color: #ded8e8;
}

.star.on {
  color: #ffb020;
}

.accessory-actions {
  display: grid;
  grid-template-columns: 1fr 1fr 1.15fr;
  gap: 8rpx;
  margin-top: 16rpx;
}

.accessory-action {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 58rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.accessory-action.primary {
  color: #fff;
  background: var(--brand-gradient);
}

.accessory-action.disabled {
  opacity: 0.45;
}

.empty-recommend {
  padding: 50rpx 20rpx;
  margin-top: 22rpx;
  font-size: var(--fs-base);
  color: var(--text-3);
  text-align: center;
  background: var(--surface-soft);
  border-radius: var(--radius);
}

.empty-recommend-emoji {
  display: block;
  margin-bottom: 10rpx;
  font-size: 58rpx;
}

.hot-section {
  padding: 28rpx;
  margin-top: 24rpx;
}

.hot-card {
  display: flex;
  gap: 16rpx;
  align-items: center;
  padding: 18rpx 0;
  border-bottom: 1px solid var(--line);
}

.hot-card:last-child {
  border-bottom: none;
}

.hot-rank {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: 50%;
}

.hot-main {
  flex: 1;
  min-width: 0;
}

.hot-title {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--text-1);
}

.hot-sub {
  margin-top: 5rpx;
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.hot-items {
  margin-top: 12rpx;
  white-space: nowrap;
}

.hot-item {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  width: 92rpx;
  margin-right: 12rpx;
}

.hot-thumb {
  width: 80rpx;
  border: 4rpx solid #fff;
}

.hot-name {
  max-width: 90rpx;
  margin-top: 5rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--fs-2xs);
  color: var(--text-2);
  white-space: nowrap;
}

.hot-score {
  flex-shrink: 0;
  font-size: var(--fs-xl);
  font-weight: 500;
  color: #ffb020;
}

.picker-tabs {
  display: flex;
  gap: 10rpx;
  padding: 7rpx;
  margin-top: 22rpx;
  background: var(--surface-tint);
  border-radius: var(--radius-pill);
}

.picker-tab {
  flex: 1;
  padding: 14rpx 10rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-2);
  text-align: center;
  border-radius: var(--radius-pill);
}

.picker-tab.on {
  color: var(--purple-deep);
  background: #fff;
  box-shadow: var(--shadow-card);
}

.picker-list {
  max-height: 60vh;
  margin-top: 22rpx;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.picker-item {
  padding: 10rpx;
  background: var(--surface-tint);
  border: 4rpx solid transparent;
  border-radius: var(--radius);
}

.picker-name {
  display: block;
  margin-top: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--fs-xs);
  color: var(--text-2);
  white-space: nowrap;
}

.picker-empty {
  padding: 100rpx 20rpx;
  font-size: var(--fs-base);
  color: var(--text-3);
  text-align: center;
}

.picker-link {
  display: block;
  margin-top: 14rpx;
  color: var(--purple-deep);
}

.purchase-mask {
  align-items: center;
  padding: 0 60rpx;
}

.purchase-dialog {
  width: 100%;
  padding: 40rpx 34rpx 30rpx;
  text-align: center;
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
}

.purchase-symbol {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 104rpx;
  height: 104rpx;
  margin: 0 auto;
  font-size: 58rpx;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius-lg);
  animation: pulse 0.9s ease-in-out infinite;
}

@keyframes pulse {
  50% {
    transform: scale(1.08);
  }
}

.purchase-title {
  margin-top: 24rpx;
  font-size: var(--fs-3xl);
  font-weight: 500;
  color: var(--text-1);
}

.purchase-dots {
  display: flex;
  gap: 10rpx;
  justify-content: center;
  margin-top: 14rpx;
}

.purchase-dot {
  width: 10rpx;
  height: 10rpx;
  background: var(--pink);
  border-radius: 50%;
  animation: blink 1s ease-in-out infinite;
}

.purchase-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.purchase-dot:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  50% {
    opacity: 0.25;
  }
}

.purchase-product {
  margin-top: 22rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-2);
}

.purchase-command {
  padding: 14rpx;
  margin-top: 10rpx;
  font-size: var(--fs-sm);
  color: var(--purple-deep);
  word-break: break-all;
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.purchase-copy {
  margin-top: 24rpx;
}

.purchase-close {
  margin-top: 16rpx;
  font-size: var(--fs-sm);
  color: var(--text-3);
}

/* .cart-sheet 原来在这里本地补 display:flex + flex-direction:column。
   现在全局 .sheet 自带了（styles/components.css），规则和类名一并删掉。 */
.cart-list {
  max-height: 56vh;
  margin-top: 22rpx;
}

.cart-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  padding: 14rpx 0;
  border-bottom: 1px solid var(--line);
}

.cart-thumb {
  flex-shrink: 0;
  width: 82rpx;
}

.cart-info {
  flex: 1;
  min-width: 0;
}

.cart-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.cart-meta {
  margin-top: 5rpx;
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.cart-stepper {
  display: inline-flex;
  align-items: center;
  margin-top: 10rpx;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.cart-step {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 40rpx;
  font-size: var(--fs-md);
  color: var(--text-1);
  background: var(--surface-tint);
}

.cart-qty {
  min-width: 48rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
}

.cart-full {
  margin-top: 22rpx;
}

.cart-action {
  flex-shrink: 0;
  padding: 10rpx 16rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--purple-deep);
  background: var(--surface-tint);
  border-radius: var(--radius-pill);
}

.cart-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  font-size: var(--fs-2xl);
  color: #d04c5b;
  border-radius: 50%;
}

.cart-empty {
  padding: 100rpx 0;
  font-size: var(--fs-base);
  color: var(--text-3);
  text-align: center;
}

.cart-empty-emoji {
  display: block;
  margin-bottom: 12rpx;
  font-size: 70rpx;
}

.cart-close {
  margin-top: 22rpx;
}
</style>
