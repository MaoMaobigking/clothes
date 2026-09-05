<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import { apiGenerateOutfits } from '@/api/wardrobe'
import { WARDROBE_CATEGORIES, categoryLabel } from '@/data/wardrobeOptions'

const wardrobe = useWardrobeStore()
const selectedIds = ref<string[]>([])
const filter = ref('all')
const generating = ref(false)

const filtered = computed(() =>
  filter.value === 'all' ? wardrobe.items : wardrobe.items.filter((item) => item.category === filter.value),
)

onMounted(() => wardrobe.load())

function toast(title: string) {
  uni.showToast({ title, icon: 'none' })
}

function toggle(id: string) {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(id)
}

function clearSelection() {
  selectedIds.value = []
}

async function generate() {
  if (generating.value) return
  if (selectedIds.value.length < 2) {
    toast('至少选择 2 件旧衣')
    return
  }
  generating.value = true
  try {
    const batch = await apiGenerateOutfits(selectedIds.value)
    uni.navigateTo({
      url: `/pages/outfit-result/index?batchId=${batch.id}`,
    })
  } catch (error) {
    toast((error as Error).message || '生成失败')
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <view class="page page-stage">
    <PageHeader title="手动调整搭配" to="/pages/closet/closet" />

    <view class="summary">
      <view>
        <view class="summary-title">已选 {{ selectedIds.length }} 件旧衣</view>
        <view class="summary-sub">排序与常穿标记会直接影响生成顺序</view>
      </view>
      <view class="clear" @tap="clearSelection">清空</view>
    </view>

    <scroll-view scroll-x class="filters hide-scrollbar">
      <view class="filter" :class="{ on: filter === 'all' }" @tap="filter = 'all'">全部</view>
      <view
        v-for="category in WARDROBE_CATEGORIES"
        :key="category.key"
        class="filter"
        :class="{ on: filter === category.key }"
        @tap="filter = category.key"
      >
        {{ category.label }}
      </view>
    </scroll-view>

    <scroll-view scroll-y class="body hide-scrollbar">
      <view v-if="filtered.length" class="grid">
        <view
          v-for="item in filtered"
          :key="item.id"
          class="garment"
          :class="{ selected: selectedIds.includes(item.id) }"
          @tap="toggle(item.id)"
        >
          <TileImage
            :src="item.img"
            :from="item.primaryColor || item.from"
            :to="item.secondaryColors?.[0] || item.to"
            :emoji="item.emoji"
            ratio="3 / 4"
            rounded="24rpx"
          />
          <view class="check">
            {{ selectedIds.includes(item.id) ? '✓' : '' }}
          </view>
          <view class="garment-name">{{ item.name }}</view>
          <view class="garment-tags">
            {{ categoryLabel(item.category) }}
            <text v-if="item.frequentlyWorn" class="frequent">常穿</text>
          </view>
        </view>
      </view>
      <view v-else class="empty">当前分类还没有旧衣</view>
    </scroll-view>

    <view class="footer">
      <view class="selected-list">
        <scroll-view scroll-x class="selected-scroll">
          <view v-for="id in selectedIds" :key="id" class="selected-chip" @tap="toggle(id)">
            {{ wardrobe.items.find((item) => item.id === id)?.name || id }} ×
          </view>
        </scroll-view>
      </view>
      <view class="btn btn-primary generate" :class="{ 'btn-disabled': selectedIds.length < 2 }" @tap="generate">
        {{ generating ? '生成中…' : '生成 3 套搭配' }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.summary {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 32rpx 18rpx;
}

.summary-title {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-1);
}

.summary-sub {
  margin-top: 4rpx;
  font-size: 22rpx;
  color: var(--text-3);
}

.clear {
  padding: 12rpx 24rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--pink-deep);
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.filters {
  flex-shrink: 0;
  padding: 4rpx 32rpx 20rpx;
  white-space: nowrap;
}

.filter {
  display: inline-flex;
  padding: 13rpx 28rpx;
  margin-right: 14rpx;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface-soft);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.filter.on {
  color: #fff;
  background: var(--brand-gradient);
}

.body {
  padding: 8rpx 32rpx 28rpx;
}

.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
}

.garment {
  position: relative;
  padding: 10rpx;
  background: var(--surface);
  border: 4rpx solid transparent;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.garment.selected {
  border-color: var(--pink);
  transform: translateY(-4rpx);
}

.check {
  position: absolute;
  top: 22rpx;
  right: 22rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48rpx;
  height: 48rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: var(--pink-deep);
  background: rgb(255 255 255 / 90%);
  border-radius: 50%;
}

.garment-name {
  margin: 14rpx 4rpx 2rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 23rpx;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.garment-tags {
  margin: 4rpx 4rpx 8rpx;
  font-size: 20rpx;
  color: var(--text-3);
}

.frequent {
  margin-left: 8rpx;
  font-weight: 700;
  color: var(--success);
}

.empty {
  padding-top: 180rpx;
  font-size: 27rpx;
  color: var(--text-3);
  text-align: center;
}

.footer {
  flex-shrink: 0;
  padding: 16rpx 32rpx calc(18rpx + env(safe-area-inset-bottom, 0px));
  background: rgb(255 255 255 / 84%);
  box-shadow: 0 -4rpx 16rpx rgb(0 0 0 / 6%);
}

.selected-list {
  min-height: 58rpx;
  margin-bottom: 10rpx;
}

.selected-scroll {
  white-space: nowrap;
}

.selected-chip {
  display: inline-flex;
  max-width: 300rpx;
  padding: 10rpx 20rpx;
  margin-right: 10rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 21rpx;
  font-weight: 700;
  color: var(--pink-deep);
  white-space: nowrap;
  background: #fff0f5;
  border-radius: var(--radius-pill);
}

.generate {
  width: 100%;
}

.hide-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
