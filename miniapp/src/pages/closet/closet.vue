<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import BottomNav from '@/components/BottomNav/BottomNav.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import {
  apiGenerateOutfits,
  type WardrobeItem,
} from '@/api/wardrobe'
import { categoryLabel, seasonLabel } from '@/data/wardrobeOptions'
import { CLOSET_CATEGORIES } from '@/data/mock'
import { iconForEmoji } from '@/utils/icons'
import {
  garmentToAccessoryContext,
  setAccessoryPageContext,
} from '@/utils/accessoryContext'

const wardrobe = useWardrobeStore()
const activeCategory = ref('all')
const manage = ref(false)
const generating = ref(false)
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
})

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
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

/** 收藏的搭配和场景模板都在同一页（§8.11 §10.10），带上来源筛选过去 */
function goMyOutfits() {
  uni.navigateTo({ url: '/pages/outfits/index?source=wardrobe' })
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
  <view class="page page-stage">
    <view class="topbar">
      <view>
        <view class="title">我的衣橱</view>
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
      <view class="seg-item on">
        今日搭配
      </view>
      <!-- 「我的搭配」只有一页（§8.11 §10.10），这里跳过去而不是再维护一份列表 -->
      <view class="seg-item" @tap="goMyOutfits">
        我的搭配 ›
      </view>
    </view>

    <view class="today-panel">
      <view class="action-card">
        <view class="action-main">
          <view class="action-text">
            <view class="action-title">一键生成今日穿搭</view>
            <view class="action-sub">优先使用靠前和常穿的 30 件旧衣</view>
          </view>
          <view class="btn btn-primary action-btn" @tap="generateNow">
            {{ generating ? '生成中…' : '生成 3 套' }}
          </view>
        </view>
        <view class="manual-link" @tap="goManual">手动调整搭配 →</view>
      </view>

      <view v-if="manage" class="sort-row">
        <view class="sort-link" @tap="openSort">拖动排序</view>
      </view>

      <!--
        设计稿（开发手册 §4 图③）是「左侧竖排分类 + 右侧两列大图」，
        不是顶部横向 chips —— 分类有 10 项，横排永远看不全，还要左右滑。
      -->
      <view class="closet-body">
        <scroll-view scroll-y class="cat-rail hide-scrollbar">
          <view
            v-for="category in CLOSET_CATEGORIES"
            :key="category.key"
            class="cat"
            :class="{ on: activeCategory === category.key }"
            @tap="activeCategory = category.key"
          >
            <UiIcon
              :name="iconForEmoji(category.emoji) ?? 'grid'"
              :size="34"
              :tone="activeCategory === category.key ? 'brand' : 'muted'"
            />
            <text class="cat-label">{{ category.label }}</text>
          </view>
        </scroll-view>

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
          <UiIcon class="empty-emoji" name="warn" :size="88" tone="muted" :stroke-width="1.3" />
          <view class="empty-title">衣橱加载失败</view>
          <view class="empty-sub">{{ wardrobe.loadError }}</view>
          <view class="btn btn-primary empty-btn" @tap="wardrobe.load()">重新加载</view>
        </view>
        <view v-else class="empty">
          <UiIcon class="empty-emoji" name="box" :size="88" tone="muted" :stroke-width="1.3" />
          <view class="empty-title">衣橱还是空的</view>
          <view class="empty-sub">先上传几张真实旧衣照片</view>
          <view class="btn btn-primary empty-btn" @tap="goUpload">上传旧衣</view>
        </view>
      </scroll-view>
      </view>
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
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin: 0 32rpx 18rpx;
  padding: 26rpx;
  border-radius: var(--radius);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-float);
  color: #fff;
}
/*
 * 「手动调整搭配」原本是 position:absolute + bottom 定位，卡片高度由上面的
 * 标题/副标题撑开，两者必然叠在一起。改成正常的纵向流式布局。
 */
.action-main {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.action-text {
  flex: 1;
  min-width: 0;
}
.action-title {
  font-size: 31rpx;
  font-weight: 800;
}
.action-sub {
  margin-top: 8rpx;
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
  font-size: 21rpx;
  font-weight: 700;
  opacity: 0.9;
}
.sort-row {
  flex-shrink: 0;
  display: flex;
  justify-content: flex-end;
  padding: 0 32rpx 12rpx;
}
.sort-link {
  color: var(--purple-deep);
  font-size: 23rpx;
  font-weight: 700;
}

/* 左栏 + 右网格 */
.closet-body {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12rpx;
  padding: 0 24rpx 0 12rpx;
}
.cat-rail {
  flex-shrink: 0;
  width: 118rpx;
  height: 100%;
}
.cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 16rpx 0;
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}
.cat.on {
  background: var(--pink-soft);
}
.cat-label {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--text-3);
}
.cat.on .cat-label {
  color: var(--pink-deep);
  font-weight: 700;
}
.grid-scroll {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 0 28rpx;
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
  color: var(--success);
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
  background: var(--surface-tint);
  color: var(--text-2);
  font-size: 20rpx;
  font-weight: 700;
  text-align: center;
}
.cell-control.danger {
  color: #d04c5b;
}
.empty {
  padding-top: 140rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  color: var(--text-3);
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
.sort-sheet {
  width: 100%;
  max-height: 82vh;
  padding: 30rpx 30rpx calc(30rpx + env(safe-area-inset-bottom, 0px));
  border-radius: 44rpx 44rpx 0 0;
  background: #fff;
  box-shadow: 0 -24rpx 80rpx rgba(70, 50, 110, 0.24);
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
  background: var(--surface-tint);
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
