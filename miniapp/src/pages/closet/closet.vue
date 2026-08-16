<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BottomNav from '@/components/BottomNav/BottomNav.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import {
  apiGenerateOutfits,
  apiListOutfits,
  type Outfit,
  type WardrobeItem,
} from '@/api/wardrobe'
import {
  WARDROBE_CATEGORIES,
  categoryLabel,
  seasonLabel,
} from '@/data/wardrobeOptions'
import {
  garmentToAccessoryContext,
  setAccessoryPageContext,
} from '@/utils/accessoryContext'

const wardrobe = useWardrobeStore()
const tab = ref<'today' | 'mine'>('today')
const activeCategory = ref('all')
const manage = ref(false)
const generating = ref(false)
const history = ref<Outfit[]>([])
const sortOpen = ref(false)
const sortItems = ref<WardrobeItem[]>([])
const dragIndex = ref(-1)
const dragOffset = ref(0)
const dragStartY = ref(0)
/*
 * 拖拽排序的行间距。
 *
 * 这个常量必须等于 .sort-row 的「高度 + margin-bottom」，否则每拖过一行就
 * 累积一点误差，列表越长偏得越远。CSS 那边写死 height: 114rpx + margin-bottom: 12rpx，
 * 改一边记得改另一边。
 */
const ROW_PITCH_RPX = 126
const rowHeight = uni.upx2px(ROW_PITCH_RPX)

const filtered = computed(() =>
  activeCategory.value === 'all'
    ? wardrobe.items
    : wardrobe.items.filter((item) => item.category === activeCategory.value),
)

onMounted(async () => {
  await wardrobe.load()
  await loadHistory()
})

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
}

async function loadHistory() {
  try {
    history.value = await apiListOutfits(true)
  } catch {
    history.value = []
  }
}

function goUpload() {
  uni.navigateTo({ url: '/pages/wardrobe-upload/index' })
}

function goManual() {
  uni.navigateTo({ url: '/pages/wardrobe-match/index' })
}

async function generateNow() {
  if (generating.value) return
  if (wardrobe.items.length < 2) {
    toast('先上传至少 2 件旧衣')
    return
  }
  generating.value = true
  try {
    const batch = await apiGenerateOutfits()
    uni.navigateTo({ url: `/pages/outfit-result/index?batchId=${batch.id}` })
  } catch (error) {
    toast((error as Error).message || '生成失败')
  } finally {
    generating.value = false
  }
}

async function toggleFrequent(id: string) {
  try {
    await wardrobe.toggleFrequentlyWorn(id)
  } catch {
    toast('标记常穿失败')
  }
}

async function removeItem(id: string) {
  uni.showModal({
    title: '删除旧衣',
    content: '删除后会同时从搭配历史中移除，确定继续吗？',
    success: async (result) => {
      if (!result.confirm) return
      await wardrobe.removeItem(id)
      toast('已删除')
    },
  })
}

function openSort() {
  sortItems.value = [...wardrobe.items]
  dragIndex.value = -1
  dragOffset.value = 0
  sortOpen.value = true
}

function startDrag(event: TouchEvent, index: number) {
  dragIndex.value = index
  dragOffset.value = 0
  dragStartY.value = event.touches[0].clientY
}

function moveDrag(event: TouchEvent) {
  if (dragIndex.value < 0) return
  dragOffset.value = event.touches[0].clientY - dragStartY.value
}

function endDrag() {
  if (dragIndex.value < 0) return
  const offset = dragOffset.value
  const sourceIndex = dragIndex.value
  const target = Math.max(
    0,
    Math.min(
      sortItems.value.length - 1,
      Math.round((sourceIndex * rowHeight + offset) / rowHeight),
    ),
  )
  if (target !== sourceIndex) {
    const next = [...sortItems.value]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(target, 0, moved)
    sortItems.value = next
  }
  dragIndex.value = -1
  dragOffset.value = 0
}

async function saveSort() {
  const ids = sortItems.value.map((item) => item.id)
  try {
    await wardrobe.reorder(ids)
    sortOpen.value = false
    toast('衣柜顺序已保存')
  } catch {
    toast('保存排序失败')
  }
}

function openHistory(item: Outfit) {
  uni.navigateTo({ url: `/pages/outfit-result/index?batchId=${item.batchId}` })
}

function maskClose(event: any) {
  if (event.target === event.currentTarget) sortOpen.value = false
}

function goAccessory(item: WardrobeItem) {
  setAccessoryPageContext({
    source: 'garment',
    title: item.name,
    outfit: [garmentToAccessoryContext(item)],
  })
  uni.navigateTo({ url: '/pages/accessory/index' })
}
</script>

<template>
  <view class="page">
    <view class="topbar">
      <view>
        <view class="title">旧衣新穿</view>
        <view class="subtitle">让衣柜里的旧衣服重新搭起来</view>
      </view>
      <view class="top-actions">
        <view class="icon-btn" :class="{ active: manage }" @tap="manage = !manage">
          {{ manage ? '完成' : '管理' }}
        </view>
        <view class="icon-btn add" @tap="goUpload">＋</view>
      </view>
    </view>

    <view class="seg">
      <view class="seg-item" :class="{ on: tab === 'today' }" @tap="tab = 'today'">
        今日搭配
      </view>
      <view class="seg-item" :class="{ on: tab === 'mine' }" @tap="tab = 'mine'">
        我的搭配
      </view>
    </view>

    <view v-if="tab === 'today'" class="today-panel">
      <view class="action-card">
        <view>
          <view class="action-title">一键生成今日穿搭</view>
          <view class="action-sub">优先使用靠前和常穿的 30 件旧衣</view>
        </view>
        <view class="btn btn-primary action-btn" @tap="generateNow">
          {{ generating ? '生成中…' : '生成 3 套' }}
        </view>
        <view class="manual-link" @tap="goManual">手动调整搭配 →</view>
      </view>

      <view class="filter-row">
        <scroll-view scroll-x class="filters hide-scrollbar">
          <view
            class="filter"
            :class="{ on: activeCategory === 'all' }"
            @tap="activeCategory = 'all'"
          >
            全部
          </view>
          <view
            v-for="category in WARDROBE_CATEGORIES"
            :key="category.key"
            class="filter"
            :class="{ on: activeCategory === category.key }"
            @tap="activeCategory = category.key"
          >
            {{ category.label }}
          </view>
        </scroll-view>
        <view v-if="manage" class="sort-link" @tap="openSort">拖动排序</view>
      </view>

      <scroll-view scroll-y class="grid-scroll hide-scrollbar">
        <view v-if="filtered.length" class="grid">
          <view v-for="item in filtered" :key="item.id" class="cell">
            <TileImage
              :src="item.img"
              :from="item.primaryColor || item.from"
              :to="item.secondaryColors?.[0] || item.to"
              :emoji="item.emoji"
              ratio="3 / 4"
              rounded="24rpx"
            />
            <view v-if="item.frequentlyWorn" class="frequent-badge">常穿</view>
            <view v-if="item.recognitionStatus === 'suggested'" class="suggested-badge">待确认</view>
            <view class="accessory-entry" @tap="goAccessory(item)">配饰</view>
            <view class="cell-name">{{ item.name }}</view>
            <view class="cell-meta">
              {{ categoryLabel(item.category) }} · {{ seasonLabel(item.seasons?.[0]) }}
            </view>
            <view v-if="manage" class="cell-controls">
              <view class="cell-control" @tap="toggleFrequent(item.id)">
                {{ item.frequentlyWorn ? '取消常穿' : '设为常穿' }}
              </view>
              <view class="cell-control danger" @tap="removeItem(item.id)">删除</view>
            </view>
          </view>
        </view>
        <view v-else-if="wardrobe.loadError" class="empty">
          <view class="empty-emoji">⚠️</view>
          <view class="empty-title">衣橱加载失败</view>
          <view class="empty-sub">{{ wardrobe.loadError }}</view>
          <view class="btn btn-primary empty-btn" @tap="wardrobe.load()">重新加载</view>
        </view>
        <view v-else class="empty">
          <view class="empty-emoji">🧺</view>
          <view class="empty-title">衣橱还是空的</view>
          <view class="empty-sub">先上传几张真实旧衣照片</view>
          <view class="btn btn-primary empty-btn" @tap="goUpload">上传旧衣</view>
        </view>
      </scroll-view>
    </view>

    <view v-else class="history-panel">
      <scroll-view scroll-y class="history-scroll hide-scrollbar">
        <view v-if="history.length" class="history-list">
          <view v-for="item in history" :key="item.id" class="history-card" @tap="openHistory(item)">
            <view class="history-top">
              <view>
                <view class="history-title">{{ item.title }}</view>
                <view class="history-time">{{ item.createdAt }}</view>
              </view>
              <view class="history-go">查看 →</view>
            </view>
            <view class="history-items">
              <TileImage
                v-for="entry in item.items.slice(0, 5)"
                :key="entry.id"
                class="history-thumb"
                :src="entry.garment.img"
                :emoji="entry.garment.emoji"
                :from="entry.garment.primaryColor || entry.garment.from"
                :to="entry.garment.secondaryColors?.[0] || entry.garment.to"
                ratio="1 / 1"
                rounded="18rpx"
              />
            </view>
            <view class="history-names">
              {{ item.items.map((entry) => entry.garment.name).join('、') }}
            </view>
          </view>
        </view>
        <view v-else class="empty history-empty">
          <view class="empty-emoji">☆</view>
          <view class="empty-title">还没有收藏搭配</view>
          <view class="empty-sub">在搭配结果页点“收藏”即可回看</view>
        </view>
      </scroll-view>
    </view>

    <BottomNav active="closet" />

    <view v-if="sortOpen" class="mask" @tap="maskClose">
      <view class="sort-sheet" @tap.stop>
        <view class="sheet-title">拖动排序</view>
        <view class="sheet-sub">拖动单品行调整优先级，点击保存后生效</view>
        <scroll-view scroll-y class="sort-list">
          <view
            v-for="(item, index) in sortItems"
            :key="item.id"
            class="sort-row"
            :class="{ dragging: dragIndex === index }"
            :style="{ transform: dragIndex === index ? `translateY(${dragOffset}px)` : 'none' }"
            @touchstart="startDrag($event, index)"
            @touchmove="moveDrag"
            @touchend="endDrag"
          >
            <view class="drag-handle">≡</view>
            <TileImage
              class="sort-thumb"
              :src="item.img"
              :emoji="item.emoji"
              :from="item.primaryColor || item.from"
              :to="item.secondaryColors?.[0] || item.to"
              ratio="1 / 1"
              rounded="16rpx"
            />
            <view class="sort-info">
              <view class="sort-name">{{ item.name }}</view>
              <view class="sort-meta">{{ categoryLabel(item.category) }}</view>
            </view>
            <view class="sort-index">{{ index + 1 }}</view>
          </view>
        </scroll-view>
        <view class="btn btn-primary sort-save" @tap="saveSort">保存排序</view>
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
.topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 24rpx) 32rpx 14rpx;
}
.title {
  font-size: 44rpx;
  font-weight: 800;
  color: var(--text-1);
}
.subtitle {
  margin-top: 4rpx;
  font-size: 23rpx;
  color: var(--text-3);
}
.top-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.icon-btn {
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: var(--text-2);
  font-size: 25rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}
.icon-btn.active {
  color: var(--pink-deep);
}
.icon-btn.add {
  width: 64rpx;
  padding: 0;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 40rpx;
}
.seg {
  flex-shrink: 0;
  display: flex;
  gap: 10rpx;
  margin: 4rpx 32rpx 18rpx;
  padding: 8rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.65);
  box-shadow: var(--shadow-card);
}
.seg-item {
  flex: 1;
  text-align: center;
  padding: 15rpx 10rpx;
  border-radius: 999rpx;
  color: var(--text-2);
  font-size: 27rpx;
  font-weight: 700;
}
.seg-item.on {
  background: var(--brand-gradient);
  color: #fff;
  box-shadow: 0 12rpx 28rpx rgba(177, 140, 255, 0.4);
}
.today-panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.action-card {
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  gap: 20rpx;
  margin: 0 32rpx 18rpx;
  padding: 26rpx;
  border-radius: var(--radius);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-float);
  color: #fff;
}
.action-title {
  font-size: 31rpx;
  font-weight: 800;
}
.action-sub {
  margin-top: 8rpx;
  max-width: 390rpx;
  font-size: 21rpx;
  opacity: 0.9;
  line-height: 1.4;
}
.action-btn {
  flex-shrink: 0;
  height: 76rpx;
  padding: 0 22rpx;
  background: rgba(255, 255, 255, 0.95);
  color: var(--purple-deep);
  font-size: 24rpx;
  box-shadow: 0 10rpx 20rpx rgba(80, 45, 120, 0.24);
}
.manual-link {
  position: absolute;
  left: 26rpx;
  bottom: 12rpx;
  font-size: 21rpx;
  font-weight: 700;
  opacity: 0.9;
}
.filter-row {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 0 32rpx 16rpx;
}
.filters {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
}
.filter {
  display: inline-flex;
  margin-right: 12rpx;
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: var(--surface-soft);
  box-shadow: var(--shadow-card);
  color: var(--text-2);
  font-size: 23rpx;
  font-weight: 700;
}
.filter.on {
  background: var(--brand-gradient);
  color: #fff;
}
.sort-link {
  flex-shrink: 0;
  color: var(--purple-deep);
  font-size: 23rpx;
  font-weight: 700;
}
.grid-scroll {
  flex: 1;
  min-height: 0;
  padding: 0 32rpx 28rpx;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}
.cell {
  position: relative;
  padding: 12rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.frequent-badge,
.suggested-badge {
  position: absolute;
  top: 22rpx;
  left: 22rpx;
  z-index: 3;
  padding: 6rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.88);
  font-size: 19rpx;
  font-weight: 800;
}
.frequent-badge {
  color: #2e8a6e;
}
.suggested-badge {
  top: 64rpx;
  color: #5f78a8;
}
.accessory-entry {
  position: absolute;
  right: 22rpx;
  top: 22rpx;
  z-index: 4;
  padding: 7rpx 14rpx;
  border-radius: 999rpx;
  background: rgba(255, 255, 255, 0.9);
  color: var(--purple-deep);
  font-size: 19rpx;
  font-weight: 800;
  box-shadow: var(--shadow-card);
}
.cell-name {
  margin: 14rpx 4rpx 2rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cell-meta {
  margin: 4rpx 4rpx 10rpx;
  font-size: 20rpx;
  color: var(--text-3);
}
.cell-controls {
  display: flex;
  gap: 8rpx;
  margin-top: 4rpx;
}
.cell-control {
  flex: 1;
  padding: 10rpx 4rpx;
  border-radius: 14rpx;
  background: #f4f0fb;
  color: var(--text-2);
  font-size: 20rpx;
  font-weight: 700;
  text-align: center;
}
.cell-control.danger {
  color: #d04c5b;
}
.history-panel {
  flex: 1;
  min-height: 0;
  padding: 0 32rpx 28rpx;
}
.history-scroll {
  height: 100%;
}
.history-list {
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
.history-card {
  padding: 24rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.history-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.history-title {
  font-size: 30rpx;
  font-weight: 800;
}
.history-time {
  margin-top: 5rpx;
  color: var(--text-3);
  font-size: 20rpx;
}
.history-go {
  flex-shrink: 0;
  color: var(--pink-deep);
  font-size: 23rpx;
  font-weight: 700;
}
.history-items {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12rpx;
  margin-top: 20rpx;
}
.history-thumb {
  border-radius: 18rpx;
}
.history-names {
  margin-top: 16rpx;
  color: var(--text-2);
  font-size: 22rpx;
  line-height: 1.5;
}
.empty {
  padding-top: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  color: var(--text-3);
}
.history-empty {
  padding-top: 110rpx;
}
.empty-emoji {
  font-size: 88rpx;
}
.empty-title {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-1);
}
.empty-sub {
  font-size: 23rpx;
}
.empty-btn {
  margin-top: 16rpx;
  height: 82rpx;
  padding: 0 40rpx;
  font-size: 27rpx;
}
.mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(35, 24, 48, 0.36);
}
.sort-sheet {
  width: 100%;
  max-height: 82vh;
  padding: 30rpx 30rpx calc(30rpx + env(safe-area-inset-bottom, 0px));
  border-radius: 44rpx 44rpx 0 0;
  background: #fff;
  box-shadow: 0 -24rpx 80rpx rgba(70, 50, 110, 0.24);
}
.sheet-title {
  font-size: 34rpx;
  font-weight: 800;
}
.sheet-sub {
  margin-top: 8rpx;
  color: var(--text-3);
  font-size: 22rpx;
}
.sort-list {
  max-height: 60vh;
  margin-top: 24rpx;
}
.sort-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
  /* 高度 + margin-bottom 必须等于 closet.vue 里的 ROW_PITCH_RPX(126)，见那里的注释 */
  height: 114rpx;
  margin-bottom: 12rpx;
  padding: 10rpx 14rpx;
  border-radius: 22rpx;
  background: #faf7ff;
  box-shadow: var(--shadow-card);
  transition: transform 0.12s ease, opacity 0.12s ease;
}
.sort-row.dragging {
  z-index: 5;
  opacity: 0.86;
  background: #fff;
}
.drag-handle {
  width: 40rpx;
  color: var(--text-3);
  font-size: 42rpx;
  text-align: center;
}
.sort-thumb {
  width: 76rpx;
  flex-shrink: 0;
}
.sort-info {
  flex: 1;
  min-width: 0;
}
.sort-name {
  font-size: 25rpx;
  font-weight: 700;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sort-meta {
  margin-top: 5rpx;
  color: var(--text-3);
  font-size: 20rpx;
}
.sort-index {
  flex-shrink: 0;
  color: var(--purple-deep);
  font-size: 24rpx;
  font-weight: 800;
}
.sort-save {
  margin-top: 24rpx;
}
.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
