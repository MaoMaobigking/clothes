<script setup lang="ts">
import { iconForEmoji } from '@/utils/icons'
import { computed, onMounted, ref } from 'vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import type { WardrobeItem } from '@/api/wardrobe'
import { WARDROBE_CATEGORIES, WARDROBE_COLORS, WARDROBE_OCCASIONS, WARDROBE_SEASONS } from '@/constants/wardrobe'
import { toast } from '@/utils/toast'
import { back } from '@/utils/nav'

interface ReviewDraft {
  name: string
  category: string
  primaryColor: string
  secondaryColors: string[]
  seasons: string[]
  occasions: string[]
  frequentlyWorn: boolean
}

const wardrobe = useWardrobeStore()
const selectedPaths = ref<string[]>([])
const reviewItems = ref<WardrobeItem[]>([])
const drafts = ref<Record<string, ReviewDraft>>({})
const uploading = ref(false)

/*
 * 单次上传上限 9 张，是客户需求原文「支持多张上传（最多9张）」。
 * 之前放宽到 20 是项目自己的规格改的，2026-08-18 按客户原文收回来。
 * 衣橱总量 100 件不是客户提的，属于防炸库的实现约束，保留。
 */
const BATCH_LIMIT = 9

const remaining = computed(() => Math.max(0, 100 - wardrobe.items.length))
const canUpload = computed(() => selectedPaths.value.length > 0 && remaining.value > 0)

onMounted(() => wardrobe.load())

function chooseImages(source: 'album' | 'camera') {
  if (remaining.value <= 0) {
    toast('衣橱最多 100 件，请先整理')
    return
  }
  const room = Math.min(BATCH_LIMIT - selectedPaths.value.length, remaining.value)
  if (room <= 0) {
    toast(`单次最多 ${BATCH_LIMIT} 张，请先识别当前这批`)
    return
  }
  uni.chooseImage({
    count: room,
    sourceType: [source],
    success: (res) => {
      const next = [...selectedPaths.value, ...res.tempFilePaths]
      selectedPaths.value = next.slice(0, BATCH_LIMIT)
    },
    fail: () => toast('没有选择图片'),
  })
}

function removePreview(index: number) {
  selectedPaths.value.splice(index, 1)
}

function createDraft(item: WardrobeItem): ReviewDraft {
  return {
    name: item.name || '',
    category: item.category || 'top',
    primaryColor: item.primaryColor || WARDROBE_COLORS[0].key,
    secondaryColors: item.secondaryColors?.slice() || [],
    seasons: item.seasons?.slice() || [],
    occasions: item.occasions?.slice() || [],
    frequentlyWorn: Boolean(item.frequentlyWorn),
  }
}

async function recognize() {
  if (!selectedPaths.value.length || uploading.value) return
  uploading.value = true
  try {
    const items = await wardrobe.uploadItems(selectedPaths.value)
    reviewItems.value = items
    for (const item of items) drafts.value[item.id] = createDraft(item)
    selectedPaths.value = []
    toast(`识别完成，请确认 ${items.length} 件旧衣`)
  } catch (error) {
    toast((error as Error).message || '识别失败')
  } finally {
    uploading.value = false
  }
}

function toggleOption(item: ReviewDraft, field: 'secondaryColors' | 'seasons' | 'occasions', key: string) {
  const list = item[field]
  const index = list.indexOf(key)
  if (index >= 0) list.splice(index, 1)
  else list.push(key)
}

async function confirm(item: WardrobeItem) {
  const draft = drafts.value[item.id]
  if (!draft || !draft.name.trim()) {
    toast('请先填写衣物名称')
    return
  }
  await wardrobe.updateItem(item.id, {
    ...draft,
    name: draft.name.trim(),
    recognitionStatus: 'confirmed',
    recognitionSource: 'manual',
  })
  reviewItems.value = reviewItems.value.filter((entry) => entry.id !== item.id)
  delete drafts.value[item.id]
  if (reviewItems.value.length === 0) {
    toast('旧衣已保存到衣橱')
    setTimeout(() => back('closet'), 600)
  }
}

function resetReview() {
  reviewItems.value = []
  drafts.value = {}
}
</script>

<template>
  <view class="page page-stage">
    <PageHeader title="旧衣上传" to="/pages/closet/closet" />

    <scroll-view scroll-y class="body hide-scrollbar">
      <view v-if="reviewItems.length" class="review-section">
        <view class="section-head">
          <view>
            <view class="section-title">AI 识别建议</view>
            <view class="section-sub">这是演示识别结果，可逐件修正</view>
          </view>
          <view class="text-btn" @tap="resetReview">取消确认</view>
        </view>

        <view v-for="item in reviewItems" :key="item.id" class="review-card">
          <view class="review-top">
            <TileImage
              class="review-img"
              :src="item.img"
              :emoji="item.emoji"
              :from="item.primaryColor || item.from"
              :to="item.secondaryColors?.[0] || item.to"
              ratio="3 / 4"
              rounded="24rpx"
            />
            <view class="review-main">
              <view class="recognition-badge">演示识别</view>
              <input v-model="drafts[item.id].name" class="name-input" placeholder="衣物名称" maxlength="24" />
              <view class="field-label">衣物类型</view>
              <scroll-view scroll-x class="chips">
                <view
                  v-for="category in WARDROBE_CATEGORIES"
                  :key="category.key"
                  class="chip"
                  :class="{ on: drafts[item.id].category === category.key }"
                  @tap="drafts[item.id].category = category.key"
                >
                  {{ category.label }}
                </view>
              </scroll-view>
            </view>
          </view>

          <view class="field-block">
            <view class="field-label">主色</view>
            <scroll-view scroll-x class="colors">
              <view
                v-for="color in WARDROBE_COLORS"
                :key="color.key"
                class="color"
                :class="{ on: drafts[item.id].primaryColor === color.key }"
                :style="{ background: color.color }"
                @tap="drafts[item.id].primaryColor = color.key"
              />
            </scroll-view>
          </view>

          <view class="field-block">
            <view class="field-label">辅助色</view>
            <view class="option-list">
              <view
                v-for="color in WARDROBE_COLORS"
                :key="color.key"
                class="option"
                :class="{ on: drafts[item.id].secondaryColors.includes(color.key) }"
                @tap="toggleOption(drafts[item.id], 'secondaryColors', color.key)"
              >
                {{ color.label }}
              </view>
            </view>
          </view>

          <view class="field-block">
            <view class="field-label">季节</view>
            <view class="option-list">
              <view
                v-for="season in WARDROBE_SEASONS"
                :key="season.key"
                class="option"
                :class="{ on: drafts[item.id].seasons.includes(season.key) }"
                @tap="toggleOption(drafts[item.id], 'seasons', season.key)"
              >
                <UiIcon :name="iconForEmoji(season.emoji) ?? 'season-spring'" :size="26" tone="soft" />
                <text>{{ season.label }}</text>
              </view>
            </view>
          </view>

          <view class="field-block">
            <view class="field-label">场合</view>
            <view class="option-list">
              <view
                v-for="occasion in WARDROBE_OCCASIONS"
                :key="occasion.key"
                class="option"
                :class="{ on: drafts[item.id].occasions.includes(occasion.key) }"
                @tap="toggleOption(drafts[item.id], 'occasions', occasion.key)"
              >
                <UiIcon :name="iconForEmoji(occasion.emoji) ?? 'sc-daily'" :size="26" tone="soft" />
                <text>{{ occasion.label }}</text>
              </view>
            </view>
          </view>

          <view class="confirm-row">
            <view
              class="frequent"
              :class="{ on: drafts[item.id].frequentlyWorn }"
              @tap="drafts[item.id].frequentlyWorn = !drafts[item.id].frequentlyWorn"
            >
              {{ drafts[item.id].frequentlyWorn ? '✓ 常穿' : '标记常穿' }}
            </view>
            <view class="btn btn-primary confirm-btn" @tap="confirm(item)">确认保存</view>
          </view>
        </view>
      </view>

      <template v-else>
        <view class="hero">
          <UiIcon class="hero-icon" name="camera" :size="72" tone="purple" :stroke-width="1.4" />
          <view class="hero-title">把旧衣拍成穿搭灵感</view>
          <view class="hero-sub">单次最多 {{ BATCH_LIMIT }} 张，衣橱最多 100 件</view>
        </view>

        <view class="upload-grid">
          <view class="upload-cell" @tap="chooseImages('camera')">
            <UiIcon class="upload-icon" name="camera" :size="52" tone="purple" />
            <view class="upload-title">拍照</view>
            <view class="upload-sub">拍一张真实旧衣</view>
          </view>
          <view class="upload-cell" @tap="chooseImages('album')">
            <UiIcon class="upload-icon" name="image" :size="52" tone="purple" />
            <view class="upload-title">从相册选择</view>
            <view class="upload-sub">可一次选择多张</view>
          </view>
        </view>

        <view v-if="selectedPaths.length" class="preview-panel">
          <view class="section-title">待识别图片（{{ selectedPaths.length }}/{{ BATCH_LIMIT }}）</view>
          <view class="preview-grid">
            <view v-for="(path, index) in selectedPaths" :key="path" class="preview-item">
              <image :src="path" mode="aspectFill" class="preview-img" />
              <view class="remove" @tap="removePreview(index)">×</view>
            </view>
          </view>
        </view>
      </template>
    </scroll-view>

    <view v-if="!reviewItems.length" class="footer">
      <view class="remain">还可上传 {{ remaining }} 件</view>
      <view class="btn btn-primary footer-btn" :class="{ 'btn-disabled': !canUpload }" @tap="recognize">
        {{ uploading ? 'AI 识别中…' : `识别 ${selectedPaths.length || 0} 张旧衣` }}
      </view>
    </view>

    <view v-if="uploading" class="loading-mask">
      <view class="loading-card">
        <view class="loading-dot" />
        <view class="loading-title">AI 识别中</view>
        <view class="loading-sub">正在读取颜色、季节与场合建议</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  padding: 12rpx 32rpx 32rpx;
}

.hero {
  padding: 54rpx 36rpx;
  margin-top: 20rpx;
  color: #fff;
  text-align: center;
  background: var(--brand-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
}

.hero-icon {
  font-size: 84rpx;
}

.hero-title {
  margin-top: 20rpx;
  font-size: 38rpx;
  font-weight: 500;
}

.hero-sub {
  margin-top: 12rpx;
  font-size: var(--fs-base);
  opacity: 0.9;
}

.upload-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-top: 28rpx;
}

.upload-cell {
  min-height: 250rpx;
  padding: 38rpx 24rpx;
  text-align: center;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.upload-icon {
  font-size: 70rpx;
}

.upload-title {
  margin-top: 18rpx;
  font-size: var(--fs-xl);
  font-weight: 500;
  color: var(--text-1);
}

.upload-sub {
  margin-top: 8rpx;
  font-size: var(--fs-sm);
  color: var(--text-3);
}

.preview-panel {
  margin-top: 28rpx;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-top: 18rpx;
}

.preview-item {
  position: relative;
  height: 160rpx;
  overflow: hidden;
  background: #f1ecf8;
  border-radius: var(--radius);
}

.preview-img {
  width: 100%;
  height: 100%;
}

.remove {
  position: absolute;
  top: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40rpx;
  height: 40rpx;
  color: #fff;
  background: rgb(0 0 0 / 62%);
  border-radius: 0 0 0 16rpx;
}

.footer {
  display: flex;
  flex-shrink: 0;
  gap: 20rpx;
  align-items: center;
  padding: 20rpx 32rpx calc(20rpx + env(safe-area-inset-bottom, 0px));
  background: rgb(255 255 255 / 82%);
  box-shadow: 0 -4rpx 16rpx rgb(0 0 0 / 6%);
}

.remain {
  font-size: var(--fs-base);
  color: var(--text-3);
}

.footer-btn {
  flex: 1;
}

.loading-mask {
  position: absolute;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(40 26 54 / 35%);
}

.loading-card {
  width: 420rpx;
  padding: 48rpx 32rpx;
  text-align: center;
  background: #fff;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
}

.loading-dot {
  width: 54rpx;
  height: 54rpx;
  margin: 0 auto;
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

.loading-title {
  margin-top: 22rpx;
  font-size: var(--fs-2xl);
  font-weight: 500;
}

.loading-sub {
  margin-top: 8rpx;
  font-size: var(--fs-base);
  color: var(--text-2);
}

.review-section {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-sub {
  font-size: var(--fs-sm);
}

.text-btn {
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--pink-deep);
}

.review-card {
  padding: 24rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.review-top {
  display: flex;
  gap: 20rpx;
}

.review-img {
  flex-shrink: 0;
  width: 230rpx;
}

.review-main {
  flex: 1;
  min-width: 0;
}

.recognition-badge {
  align-self: flex-start;
  padding: 6rpx 16rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: #5f78a8;
  background: #eef4ff;
  border-radius: var(--radius-pill);
}

.name-input {
  height: 72rpx;
  padding: 0 20rpx;
  margin-top: 12rpx;
  font-size: var(--fs-lg);
  background: var(--surface-tint);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

.field-label {
  margin-top: 18rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-2);
}

.chips {
  margin-top: 10rpx;
  white-space: nowrap;
}

.chip,
.option {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12rpx 22rpx;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: var(--text-2);
  background: var(--surface-tint);
  border-radius: var(--radius-pill);
}

.chip {
  margin-right: 10rpx;
}

.chip.on,
.option.on {
  color: #fff;
  background: var(--brand-gradient);
}

.field-block {
  margin-top: 22rpx;
}

.colors {
  display: flex;
  gap: 16rpx;
  margin-top: 10rpx;
  white-space: nowrap;
}

.color {
  flex-shrink: 0;
  width: 54rpx;
  height: 54rpx;
  border: 4rpx solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 2rpx var(--line);
}

.color.on {
  box-shadow: 0 0 0 4rpx var(--pink);
}

.option-list {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 10rpx;
}

.confirm-row {
  display: flex;
  gap: 20rpx;
  align-items: center;
  margin-top: 28rpx;
}

.frequent {
  flex-shrink: 0;
  padding: 18rpx 28rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.frequent.on {
  color: var(--success);
  background: #e9f9f4;
  border-color: #8fd5c1;
}

.confirm-btn {
  flex: 1;
  height: 82rpx;
  font-size: var(--fs-md);
}
</style>
