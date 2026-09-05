<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useWardrobeStore } from '@/stores/wardrobe'
import { useCartStore } from '@/stores/cart'
import {
  apiGenerateOutfits,
  apiGetOutfitBatch,
  apiReplaceOutfitItem,
  apiSaveOutfit,
  type Outfit,
  type OutfitBatch,
} from '@/api/wardrobe'
import { isAuthError } from '@/utils/request'
import { categoryLabel, occasionLabel, seasonLabel } from '@/data/wardrobeOptions'
import { garmentToAccessoryContext, setAccessoryPageContext } from '@/utils/accessoryContext'
import { piecesFromOutfit } from '@/utils/outfitPieces'
/*
 * 只导入**类型**，不导入值。
 *
 * OutfitPoster 在模板里靠 easycom 自动注册（显式 import 组件会触发
 * uni-app 的组件路径 marker 前向引用 bug，全站白屏，见 docs/开发手册.md §3.5）。
 * 但下面 posterRef 的 `InstanceType<typeof OutfitPoster>` 需要这个标识符存在，
 * 否则 vue-tsc 报 TS2304 Cannot find name。
 * `import type` 会被编译器完全擦除，产物里不会留 require —— 两边都满足。
 */
import type OutfitPoster from '@/components/OutfitPoster/OutfitPoster.vue'
import { MOMENT_HINT, copyText } from '@/utils/share'

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
const posterRef = ref<InstanceType<typeof OutfitPoster> | null>(null)

const outfits = computed(() => batch.value?.outfits || [])

// 海报副标题与日期：以前由 OutfitPoster 从 Outfit 里自己抠，
// 组件通用化后由调用方给（功能四给的是场景 + 天气）
const posterSubtitle = computed(() => {
  const target = shareTarget.value
  if (!target) return ''
  return [target.scene, target.occasion].filter(Boolean).join(' · ')
})
const posterDate = computed(() => {
  const raw = shareTarget.value?.createdAt
  const date = raw ? new Date(raw) : new Date()
  const d = Number.isNaN(date.getTime()) ? new Date() : date
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
})
const leftItems = computed(() => wardrobe.items.map((item, index) => ({ item, index: index + 1 })).slice(0, 100))
const replacementItems = computed(() =>
  replacing.value ? wardrobe.items.filter((item) => item.category === replacing.value?.category) : [],
)

/*
 * 左栏「勾选参与搭配」（客户需求原文：左侧衣物列表可勾选参与搭配）。
 *
 * 语义要和后端对齐，别自己造第三种：`apiGenerateOutfits(ids)` 传空数组时，
 * 服务端按「最近上传 + 常穿」自己挑（top_30 策略）。所以这里**不默认全选** ——
 * 默认一件不勾 = 交给 AI 挑；勾了就是用户指定这几件。
 * 少于 2 件生不成一套上下装，所以按钮 2 件起才亮。
 */
const participants = ref<string[]>([])
const regenerating = ref(false)
const canRegenerate = computed(() => participants.value.length >= 2 && !regenerating.value)

function toggleParticipant(id: string) {
  const index = participants.value.indexOf(id)
  if (index >= 0) participants.value.splice(index, 1)
  else participants.value.push(id)
}

async function regenerateWithSelection() {
  if (participants.value.length < 2) {
    toast('至少勾选 2 件才能重新生成')
    return
  }
  regenerating.value = true
  loading.value = true
  try {
    batch.value = await apiGenerateOutfits(participants.value)
    toast(`已用勾选的 ${participants.value.length} 件重新生成`)
  } catch (error) {
    if (!isAuthError(error)) {
      toast((error as Error).message || '生成失败')
    }
  } finally {
    regenerating.value = false
    loading.value = false
  }
}

/*
 * 底部 Tab 切「我的搭配」（客户需求原文：历史搭配记录 · 底部 Tab 切换「我的搭配」）。
 * 注意**不能**做成第 6 个全局 tabBar —— 微信 tabBar 最多 5 项，现在正好占满
 * （pages.json 的 tabBar.list）。所以这是搭配页自己的页内底部 Tab。
 */
function goMyOutfits() {
  uni.navigateTo({ url: '/pages/outfits/index?source=wardrobe' })
}

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
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      uni.showToast({ title: (error as Error).message || '加载失败', icon: 'none' })
    }
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
    const updated = await apiReplaceOutfitItem(replacing.value.outfitId, replacing.value.oldGarmentId, newGarmentId)
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
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      toast((error as Error).message || '替换失败')
    }
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
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      toast((error as Error).message || '保存失败')
    }
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
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      toast((error as Error).message || '加入购物车失败')
    }
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
  copyText(`${shareTarget.value.title}：${names}。来自 AI 旧衣智能搭配。`, '搭配文案已复制')
}

function saveSharePoster() {
  if (!shareTarget.value) return
  // 真导出走 OutfitPoster 的 canvas（规格 §8.9），不再是假保存提示
  posterRef.value?.savePoster()
}
</script>

<template>
  <view class="page page-stage">
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
        <view class="left-hint">勾选参与</view>
        <view
          v-for="entry in leftItems"
          :key="entry.item.id"
          class="wardrobe-item"
          :class="{ picked: participants.includes(entry.item.id) }"
          @tap="toggleParticipant(entry.item.id)"
        >
          <TileImage
            :src="entry.item.img"
            :from="entry.item.primaryColor || entry.item.from"
            :to="entry.item.secondaryColors?.[0] || entry.item.to"
            :emoji="entry.item.emoji"
            ratio="3 / 4"
            rounded="20rpx"
          />
          <view class="wardrobe-index">{{ entry.index }}</view>
          <view class="wardrobe-check">
            <text v-if="participants.includes(entry.item.id)">✓</text>
          </view>
          <view class="wardrobe-name">{{ entry.item.name }}</view>
        </view>
      </scroll-view>

      <scroll-view scroll-y class="right-column hide-scrollbar">
        <view v-if="outfits.length" class="plans">
          <view v-for="outfit in outfits" :key="outfit.id" class="plan">
            <OutfitPreview :pieces="piecesFromOutfit(outfit)" />
            <view class="plan-head">
              <view>
                <view class="plan-title">{{ outfit.title }}</view>
                <view class="plan-scene">{{ occasionLabel(outfit.occasion) }} · {{ seasonLabel(outfit.season) }}</view>
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
                <UiIcon class="action-icon" name="cart" :size="34" tone="dark" />
                <text>加入购物车</text>
              </view>
              <view class="plan-action" @tap="saveOutfit(outfit)">
                <UiIcon
                  class="action-icon"
                  name="star"
                  :size="34"
                  :tone="outfit.isSaved ? 'brand' : 'muted'"
                  :stroke-width="outfit.isSaved ? 2.6 : 1.7"
                />
                <text>{{ outfit.isSaved ? '已收藏' : '收藏' }}</text>
              </view>
              <view class="plan-action" @tap="openShare(outfit)">
                <text class="action-icon">↗</text>
                <text>分享</text>
              </view>
              <view class="plan-action" @tap="goAccessory(outfit)">
                <UiIcon class="action-icon" name="gem" :size="34" tone="purple" />
                <text>配饰</text>
              </view>
            </view>
          </view>
        </view>
        <view v-else class="empty">
          <UiIcon class="empty-emoji" name="box" :size="88" tone="muted" :stroke-width="1.3" />
          <text>还没有搭配方案，先回衣橱生成一套吧</text>
        </view>
      </scroll-view>
    </view>

    <!--
      页内底部 Tab（客户需求原文：历史搭配记录 · 底部 Tab 切换「我的搭配」）。
      勾了参与衣物时上面多一条重新生成，没勾就只有两个 Tab，不占地方。
    -->
    <view v-if="!loading" class="result-footer">
      <view v-if="participants.length" class="regen-row">
        <text class="regen-hint">已勾选 {{ participants.length }} 件参与搭配</text>
        <view
          class="btn btn-primary regen-btn"
          :class="{ 'btn-disabled': !canRegenerate }"
          @tap="regenerateWithSelection"
        >
          {{ regenerating ? '生成中…' : '重新生成' }}
        </view>
      </view>
      <view class="result-tabs">
        <view class="result-tab on">今日搭配</view>
        <view class="result-tab" @tap="goMyOutfits">我的搭配 ›</view>
      </view>
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
        <!--
          客户需求原文里 AI 算法说明浮层的那句话，件数是真实参与数量，
          不是写死的文案（规格 §8.10 要求浮层展示当前实际参与衣物数量）。
        -->
        <view class="algorithm-lead">
          本搭配基于你上传的 {{ algorithmTarget.algorithm?.garmentCount ?? 0 }} 件衣物，结合季节 / 场合 / 流行趋势生成
        </view>
        <view class="algorithm-row">
          <text class="algorithm-label">参与旧衣</text>
          <text class="algorithm-value">{{ algorithmTarget.algorithm?.garmentCount }} 件</text>
        </view>
        <view v-if="algorithmTarget.algorithm?.input" class="algorithm-row">
          <text class="algorithm-label">输入范围</text>
          <text class="algorithm-value">{{ algorithmTarget.algorithm.input }}</text>
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
        <OutfitPoster
          ref="posterRef"
          :title="shareTarget.title"
          :subtitle="posterSubtitle"
          :pieces="piecesFromOutfit(shareTarget)"
          :footnote="posterDate"
        />
        <view class="share-actions">
          <view class="btn btn-ghost share-btn" @tap="saveSharePoster">保存图片</view>
          <view class="btn btn-primary share-btn" @tap="copyShareText">复制分享文案</view>
        </view>
        <!-- 小程序发不了朋友圈，这条限制必须写在界面上，见 utils/share.ts -->
        <text class="share-hint">{{ MOMENT_HINT }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.head-stat {
  display: flex;
  gap: 4rpx;
  align-items: baseline;
}

.head-stat-num {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--pink-deep);
}

.head-stat-label {
  font-size: 20rpx;
  color: var(--text-3);
}

.loading {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 20rpx;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  color: var(--text-2);
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
  to {
    transform: rotate(360deg);
  }
}

.stage {
  display: flex;
  flex: 1;
  gap: 16rpx;
  min-height: 0;
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
  box-sizing: border-box;
  padding: 7rpx;
  margin-bottom: 18rpx;
  background: var(--surface);
  border: 2rpx solid transparent;
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

/* 勾中「参与搭配」的衣物：主色描边，和右侧方案里的选中态一个语言 */
.wardrobe-item.picked {
  border-color: var(--pink-deep);
}

.left-hint {
  padding-bottom: 8rpx;
  font-size: 20rpx;
  color: var(--text-3);
  text-align: center;
}

.wardrobe-check {
  position: absolute;
  right: -2rpx;
  bottom: 34rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32rpx;
  height: 32rpx;
  font-size: 22rpx;
  color: #fff;
  background: var(--surface);
  border: 2rpx solid var(--line);
  border-radius: 50%;
}

.wardrobe-item.picked .wardrobe-check {
  background: var(--pink-deep);
  border-color: var(--pink-deep);
}

/* 页内底部 Tab + 重新生成条 */
.result-footer {
  flex-shrink: 0;
  padding: 0 24rpx calc(16rpx + env(safe-area-inset-bottom));
}

.regen-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 0;
}

.regen-hint {
  font-size: 24rpx;
  color: var(--text-2);
}

.regen-btn {
  display: flex;
  align-items: center;
  height: var(--btn-h-sm, 64rpx);
  padding: 0 28rpx;
  font-size: 26rpx;
}

.result-tabs {
  display: flex;
  gap: 12rpx;
  padding: 8rpx;
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.result-tab {
  flex: 1;
  padding: 16rpx 0;
  font-size: 26rpx;
  color: var(--text-2);
  text-align: center;
  border-radius: var(--radius-pill);
}

.result-tab.on {
  color: #fff;
  background: var(--pink-deep);
}

.wardrobe-index {
  position: absolute;
  top: -4rpx;
  left: -4rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32rpx;
  height: 32rpx;
  padding: 0 6rpx;
  font-size: 18rpx;
  font-weight: 500;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
}

.wardrobe-name {
  margin: 8rpx 4rpx 2rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 19rpx;
  color: var(--text-2);
  text-align: center;
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
  background: var(--surface);
  border-radius: var(--radius);
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
  font-weight: 500;
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
  font-size: 21rpx;
  font-weight: 700;
  color: var(--purple-deep);
  background: #f1edff;
  border-radius: var(--radius-pill);
}

.plan-reason {
  margin-top: 14rpx;
  font-size: 23rpx;
  line-height: 1.55;
  color: var(--text-2);
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
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.outfit-item-name {
  /*
   * 右边留出「换一件」的位置。
   * 它是 absolute 浮在右下角的，名字却按整格宽度截断，
   * 「红色链条包」「宽松工装外套」这种长名字的尾巴会被它盖住糊成一团。
   * 74rpx = 三个 18rpx 字 + right:14rpx 的偏移。
   */
  padding-right: 74rpx;
  margin: 8rpx 2rpx 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 19rpx;
  color: var(--text-2);
  white-space: nowrap;
}

.replace-hint {
  position: absolute;
  right: 14rpx;
  bottom: 10rpx;
  font-size: 18rpx;
  font-weight: 700;
  color: var(--pink-deep);
}

.plan-actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10rpx;
  margin-top: 18rpx;
}

.plan-action {
  display: flex;
  gap: 5rpx;
  align-items: center;
  justify-content: center;
  min-height: 64rpx;
  padding: 8rpx 4rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.action-icon {
  font-size: 24rpx;
}

.empty {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
  align-items: center;
  padding-top: 180rpx;
  font-size: 26rpx;
  color: var(--text-3);
}

.empty-emoji {
  font-size: 82rpx;
}

.sheet-sub {
  margin-top: 8rpx;
  font-size: 23rpx;
  color: var(--text-3);
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
  background: var(--surface-tint);
  border: 4rpx solid transparent;
  border-radius: var(--radius);
}

.replace-item.selected {
  background: #fff;
  border-color: var(--pink);
}

.replace-img {
  width: 100%;
}

.replace-name {
  display: block;
  margin-top: 8rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 20rpx;
  color: var(--text-2);
  white-space: nowrap;
}

.replace-submit {
  margin-top: 24rpx;
}

.algorithm-lead {
  padding: 18rpx 20rpx;
  margin-bottom: 4rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--text-1);
  background: var(--pink-soft);
  border-radius: var(--radius-sm);
}

.algorithm-row {
  display: flex;
  gap: 20rpx;
  justify-content: space-between;
  padding: 20rpx 0;
  border-bottom: 1px solid var(--line);
}

.algorithm-label {
  font-size: 24rpx;
  color: var(--text-3);
}

.algorithm-value {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-1);
  text-align: right;
}

.algorithm-note {
  padding: 18rpx;
  margin-top: 22rpx;
  font-size: 23rpx;
  line-height: 1.5;
  color: var(--text-2);
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.algorithm-close {
  margin-top: 22rpx;
}

.share-sheet {
  display: flex;
  flex-direction: column;
}

.share-actions {
  display: flex;
  gap: 16rpx;
  margin-top: 26rpx;
}

.share-btn {
  flex: 1;
}

.share-hint {
  display: block;
  margin-top: 16rpx;
  font-size: 21rpx;
  line-height: 1.5;
  color: var(--text-3);
  text-align: center;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
