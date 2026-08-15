<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import OutfitPreview from '@/components/OutfitPreview/OutfitPreview.vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import { useCartStore } from '@/stores/cart'
import {
  apiGetOutfitBatch,
  apiReplaceOutfitItem,
  apiSaveOutfit,
  type Outfit,
  type OutfitBatch,
} from '@/api/wardrobe'
import { categoryLabel, occasionLabel, seasonLabel } from '@/data/wardrobeOptions'
import {
  garmentToAccessoryContext,
  setAccessoryPageContext,
} from '@/utils/accessoryContext'

interface ReplaceTarget {
  outfitId: number
  oldGarmentId: string
  category: string
}

const wardrobe = useWardrobeStore()
const cart = useCartStore()
const batch = ref<OutfitBatch | null>(null)
const loading = ref(true)
const replacing = ref<ReplaceTarget | null>(null)
const replaceDraft = ref('')
const algorithmTarget = ref<Outfit | null>(null)
const shareTarget = ref<Outfit | null>(null)

const outfits = computed(() => batch.value?.outfits || [])
const leftItems = computed(() =>
  wardrobe.items
    .map((item, index) => ({ item, index: index + 1 }))
    .slice(0, 100),
)
const replacementItems = computed(() =>
  replacing.value
    ? wardrobe.items.filter((item) => item.category === replacing.value?.category)
    : [],
)

onLoad(async (query) => {
  const batchId = typeof query?.batchId === 'string' ? query.batchId : ''
  await wardrobe.load()
  if (batchId) {
    await loadBatch(batchId)
  } else {
    loading.value = false
  }
})

async function loadBatch(batchId: string) {
  loading.value = true
  try {
    batch.value = await apiGetOutfitBatch(batchId)
  } catch (error) {
    uni.showToast({ title: (error as Error).message || '加载失败', icon: 'none' })
  } finally {
    loading.value = false
  }
}

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
}

function openReplace(outfit: Outfit, oldGarmentId: string) {
  const item = outfit.items.find((entry) => entry.garment.id === oldGarmentId)
  if (!item) return
  replacing.value = {
    outfitId: outfit.id,
    oldGarmentId,
    category: item.garment.category,
  }
  replaceDraft.value = ''
}

function closeReplace() {
  replacing.value = null
  replaceDraft.value = ''
}

async function replaceWith(newGarmentId: string) {
  if (!replacing.value || !newGarmentId) return
  try {
    const updated = await apiReplaceOutfitItem(
      replacing.value.outfitId,
      replacing.value.oldGarmentId,
      newGarmentId,
    )
    const index = outfits.value.findIndex((outfit) => outfit.id === updated.id)
    if (index >= 0) {
      batch.value = {
        ...batch.value!,
        outfits: outfits.value.map((outfit, itemIndex) => (itemIndex === index ? updated : outfit)),
      }
    }
    toast('单品已替换，方案已刷新')
    closeReplace()
  } catch (error) {
    toast((error as Error).message || '替换失败')
  }
}

async function saveOutfit(outfit: Outfit) {
  try {
    const updated = await apiSaveOutfit(outfit.id)
    const index = outfits.value.findIndex((item) => item.id === updated.id)
    if (index >= 0) {
      batch.value = {
        ...batch.value!,
        outfits: outfits.value.map((item, itemIndex) => (itemIndex === index ? updated : item)),
      }
    }
    toast('已保存到我的搭配')
  } catch (error) {
    toast((error as Error).message || '保存失败')
  }
}

/**
 * 整套方案拆成单品入车（规格 §4.5 §8.9）。
 * 拆分和来源搭配都由服务端完成，store 直接以接口返回的整车为准，
 * 不再往本地 id 数组里塞一份 —— 那份数据刷新就没，和落库的车对不上。
 */
async function addToCart(outfit: Outfit) {
  try {
    const added = await cart.addOutfit(outfit.id)
    toast(added > 0 ? `整套方案已拆成 ${added} 件加入购物车` : '整套方案已在购物车中')
  } catch (error) {
    toast((error as Error).message || '加入购物车失败')
  }
}

function openShare(outfit: Outfit) {
  shareTarget.value = outfit
}

function closeShare() {
  shareTarget.value = null
}

function goAccessory(outfit: Outfit) {
  setAccessoryPageContext({
    source: 'outfit',
    title: outfit.title,
    outfit: outfit.items.map((entry) => garmentToAccessoryContext(entry.garment)),
    sourceId: String(outfit.id),
  })
  uni.navigateTo({ url: '/pages/accessory/index' })
}

function copyShareText() {
  if (!shareTarget.value) return
  const names = shareTarget.value.items.map((entry) => entry.garment.name).join('、')
  uni.setClipboardData({
    data: `${shareTarget.value.title}：${names}。来自 AI 旧衣智能搭配。`,
    success: () => toast('搭配文案已复制'),
  })
}

function saveSharePoster() {
  if (!shareTarget.value) return
  // 小程序内支持长按海报保存；H5 下先给出可复制文案作为稳定兜底。
  toast('请长按分享卡片保存，或复制上方文案')
}
</script>

<template>
  <view class="page">
    <PageHeader title="今日搭配" to="/pages/closet/closet">
      <template #right>
        <view class="head-stat">
          <text class="head-stat-num">{{ leftItems.length }}</text>
          <text class="head-stat-label">件旧衣</text>
        </view>
      </template>
    </PageHeader>

    <view v-if="loading" class="loading">
      <view class="loading-dot" />
      <text>正在生成 3 套搭配…</text>
    </view>

    <view v-else class="stage">
      <scroll-view scroll-y class="left-column hide-scrollbar">
        <view v-for="entry in leftItems" :key="entry.item.id" class="wardrobe-item">
          <TileImage
            :src="entry.item.img"
            :from="entry.item.primaryColor || entry.item.from"
            :to="entry.item.secondaryColors?.[0] || entry.item.to"
            :emoji="entry.item.emoji"
            ratio="3 / 4"
            rounded="20rpx"
          />
          <view class="wardrobe-index">{{ entry.index }}</view>
          <view class="wardrobe-name">{{ entry.item.name }}</view>
        </view>
      </scroll-view>

      <scroll-view scroll-y class="right-column hide-scrollbar">
        <view v-if="outfits.length" class="plans">
          <view v-for="outfit in outfits" :key="outfit.id" class="plan">
            <OutfitPreview :outfit="outfit" />
            <view class="plan-head">
              <view>
                <view class="plan-title">{{ outfit.title }}</view>
                <view class="plan-scene">
                  {{ occasionLabel(outfit.occasion) }} · {{ seasonLabel(outfit.season) }}
                </view>
              </view>
              <view class="algorithm-link" @tap="algorithmTarget = outfit">算法依据</view>
            </view>
            <view class="plan-reason">{{ outfit.reason }}</view>

            <view class="items-grid">
              <view
                v-for="entry in outfit.items"
                :key="entry.id"
                class="outfit-item"
                @tap="openReplace(outfit, entry.garment.id)"
              >
                <TileImage
                  :src="entry.garment.img"
                  :from="entry.garment.primaryColor || entry.garment.from"
                  :to="entry.garment.secondaryColors?.[0] || entry.garment.to"
                  :emoji="entry.garment.emoji"
                  ratio="1 / 1"
                  rounded="18rpx"
                />
                <view class="outfit-item-name">{{ entry.garment.name }}</view>
                <view class="replace-hint">换一件</view>
              </view>
            </view>

            <view class="plan-actions">
              <view class="plan-action" @tap="addToCart(outfit)">
                <text class="action-icon">🛒</text>
                <text>加入购物车</text>
              </view>
              <view class="plan-action" @tap="saveOutfit(outfit)">
                <text class="action-icon">{{ outfit.isSaved ? '★' : '☆' }}</text>
                <text>{{ outfit.isSaved ? '已收藏' : '收藏' }}</text>
              </view>
              <view class="plan-action" @tap="openShare(outfit)">
                <text class="action-icon">↗</text>
                <text>分享</text>
              </view>
              <view class="plan-action" @tap="goAccessory(outfit)">
                <text class="action-icon">💎</text>
                <text>配饰</text>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="empty">
          <text class="empty-emoji">🧺</text>
          <text>还没有搭配方案，先回衣橱生成一套吧</text>
        </view>
      </scroll-view>
    </view>

    <view v-if="replacing" class="mask" @tap="closeReplace">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">替换单品</view>
        <view class="sheet-sub">只能替换同类型：{{ categoryLabel(replacing.category) }}</view>
        <scroll-view scroll-y class="replace-list">
          <view
            v-for="item in replacementItems"
            :key="item.id"
            class="replace-item"
            :class="{ selected: replaceDraft === item.id }"
            @tap="replaceDraft = item.id"
          >
            <TileImage
              class="replace-img"
              :src="item.img"
              :emoji="item.emoji"
              :from="item.primaryColor || item.from"
              :to="item.secondaryColors?.[0] || item.to"
              ratio="1 / 1"
              rounded="16rpx"
            />
            <text class="replace-name">{{ item.name }}</text>
          </view>
        </scroll-view>
        <view
          class="btn btn-primary replace-submit"
          :class="{ 'btn-disabled': !replaceDraft }"
          @tap="replaceWith(replaceDraft)"
        >
          立即替换
        </view>
      </view>
    </view>

    <view v-if="algorithmTarget" class="mask" @tap="algorithmTarget = null">
      <view class="sheet" @tap.stop>
        <view class="sheet-title">为什么这样搭配</view>
        <view class="algorithm-row">
          <text class="algorithm-label">参与旧衣</text>
          <text class="algorithm-value">{{ algorithmTarget.algorithm?.garmentCount }} 件</text>
        </view>
        <view class="algorithm-row">
          <text class="algorithm-label">本套单品</text>
          <text class="algorithm-value">{{ algorithmTarget.algorithm?.selectedCount }} 件</text>
        </view>
        <view class="algorithm-row">
          <text class="algorithm-label">季节 / 场景</text>
          <text class="algorithm-value">
            {{ seasonLabel(algorithmTarget.algorithm?.season) }} /
            {{ occasionLabel(algorithmTarget.algorithm?.occasion) }}
          </text>
        </view>
        <view class="algorithm-row">
          <text class="algorithm-label">排序策略</text>
          <text class="algorithm-value">{{ algorithmTarget.algorithm?.strategy }}</text>
        </view>
        <view class="algorithm-note">{{ algorithmTarget.algorithm?.note }}</view>
        <view class="btn btn-ghost algorithm-close" @tap="algorithmTarget = null">关闭</view>
      </view>
    </view>

    <view v-if="shareTarget" class="mask" @tap="closeShare">
      <view class="sheet share-sheet" @tap.stop>
        <view class="sheet-title">分享搭配</view>
        <view class="poster">
          <view class="poster-top">{{ shareTarget.title }}</view>
          <view class="poster-items">
            <TileImage
              v-for="entry in shareTarget.items"
              :key="entry.id"
              class="poster-thumb"
              :src="entry.garment.img"
              :emoji="entry.garment.emoji"
              :from="entry.garment.primaryColor || entry.garment.from"
              :to="entry.garment.secondaryColors?.[0] || entry.garment.to"
              ratio="1 / 1"
              rounded="16rpx"
            />
          </view>
          <view class="poster-bottom">AI 旧衣智能搭配</view>
        </view>
        <view class="share-actions">
          <view class="btn btn-ghost share-btn" @tap="saveSharePoster">保存图片</view>
          <view class="btn btn-primary share-btn" @tap="copyShareText">复制分享文案</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  height: 100vh;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}
.head-stat {
  display: flex;
  align-items: baseline;
  gap: 4rpx;
}
.head-stat-num {
  color: var(--pink-deep);
  font-size: 30rpx;
  font-weight: 800;
}
.head-stat-label {
  color: var(--text-3);
  font-size: 20rpx;
}
.loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-2);
  font-size: 28rpx;
  gap: 20rpx;
}
.loading-dot {
  width: 54rpx;
  height: 54rpx;
  border: 8rpx solid #f1d8e6;
  border-top-color: var(--pink-deep);
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}
.stage {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 16rpx;
  padding: 8rpx 24rpx 28rpx;
}
.left-column {
  flex: 0 0 150rpx;
  min-width: 0;
  height: 100%;
  padding: 8rpx 2rpx;
}
.right-column {
  flex: 1;
  min-width: 0;
  height: 100%;
}
.wardrobe-item {
  position: relative;
  margin-bottom: 18rpx;
  padding: 7rpx;
  border-radius: 22rpx;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.wardrobe-index {
  position: absolute;
  left: -4rpx;
  top: -4rpx;
  z-index: 3;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 6rpx;
  border-radius: 999rpx;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 18rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}
.wardrobe-name {
  margin: 8rpx 4rpx 2rpx;
  font-size: 19rpx;
  color: var(--text-2);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.plans {
  display: flex;
  flex-direction: column;
  gap: 26rpx;
  padding-bottom: 20rpx;
}
.plan {
  padding: 16rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.plan-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-top: 18rpx;
}
.plan-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-1);
}
.plan-scene {
  margin-top: 4rpx;
  font-size: 21rpx;
  color: var(--text-3);
}
.algorithm-link {
  flex-shrink: 0;
  padding: 10rpx 18rpx;
  border-radius: 999rpx;
  background: #f1edff;
  color: var(--purple-deep);
  font-size: 21rpx;
  font-weight: 700;
}
.plan-reason {
  margin-top: 14rpx;
  color: var(--text-2);
  font-size: 23rpx;
  line-height: 1.55;
}
.items-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 18rpx;
}
.outfit-item {
  position: relative;
  padding: 8rpx;
  border-radius: 20rpx;
  background: #faf7ff;
}
.outfit-item-name {
  margin: 8rpx 2rpx 0;
  font-size: 19rpx;
  color: var(--text-2);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.replace-hint {
  position: absolute;
  right: 14rpx;
  bottom: 10rpx;
  color: var(--pink-deep);
  font-size: 18rpx;
  font-weight: 700;
}
.plan-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
  margin-top: 18rpx;
}
.plan-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5rpx;
  min-height: 64rpx;
  padding: 8rpx 4rpx;
  border-radius: 16rpx;
  background: #f4f0fb;
  color: var(--text-2);
  font-size: 20rpx;
  font-weight: 700;
}
.action-icon {
  font-size: 24rpx;
}
.empty {
  padding-top: 180rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18rpx;
  color: var(--text-3);
  font-size: 26rpx;
}
.empty-emoji {
  font-size: 82rpx;
}
.mask {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(35, 24, 48, 0.36);
}
.sheet {
  width: 100%;
  max-height: 78vh;
  padding: 34rpx 34rpx calc(34rpx + env(safe-area-inset-bottom, 0px));
  border-radius: 44rpx 44rpx 0 0;
  background: #fff;
  box-shadow: 0 -24rpx 80rpx rgba(70, 50, 110, 0.24);
}
.sheet-title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-1);
}
.sheet-sub {
  margin-top: 8rpx;
  color: var(--text-3);
  font-size: 23rpx;
}
.replace-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  max-height: 54vh;
  margin-top: 24rpx;
}
.replace-item {
  padding: 10rpx;
  border: 4rpx solid transparent;
  border-radius: 22rpx;
  background: #faf7ff;
}
.replace-item.selected {
  border-color: var(--pink);
  background: #fff;
}
.replace-img {
  width: 100%;
}
.replace-name {
  display: block;
  margin-top: 8rpx;
  color: var(--text-2);
  font-size: 20rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.replace-submit {
  margin-top: 24rpx;
}
.algorithm-row {
  display: flex;
  justify-content: space-between;
  gap: 20rpx;
  padding: 20rpx 0;
  border-bottom: 1px solid var(--line);
}
.algorithm-label {
  color: var(--text-3);
  font-size: 24rpx;
}
.algorithm-value {
  color: var(--text-1);
  font-size: 24rpx;
  font-weight: 700;
  text-align: right;
}
.algorithm-note {
  margin-top: 22rpx;
  padding: 18rpx;
  border-radius: 18rpx;
  background: #f7f2ff;
  color: var(--text-2);
  font-size: 23rpx;
  line-height: 1.5;
}
.algorithm-close {
  margin-top: 22rpx;
}
.share-sheet {
  display: flex;
  flex-direction: column;
}
.poster {
  margin-top: 24rpx;
  padding: 28rpx;
  border-radius: var(--radius);
  background: var(--brand-gradient);
  color: #fff;
}
.poster-top {
  font-size: 32rpx;
  font-weight: 800;
}
.poster-items {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14rpx;
  margin-top: 24rpx;
}
.poster-thumb {
  border: 4rpx solid rgba(255, 255, 255, 0.7);
}
.poster-bottom {
  margin-top: 24rpx;
  text-align: right;
  font-size: 22rpx;
  font-weight: 700;
}
.share-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 26rpx;
}
.share-btn {
  flex: 1;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
