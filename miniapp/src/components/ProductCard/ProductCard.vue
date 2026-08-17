<script setup lang="ts">
import TileImage from '@/components/TileImage/TileImage.vue'

withDefaults(
  defineProps<{
    title: string
    price?: number
    emoji?: string
    from?: string
    to?: string
    tag?: string
    fav?: boolean
    ratio?: string
    /** 真实图片路径（缺图自动回退占位） */
    src?: string
  }>(),
  {
    price: undefined,
    emoji: '',
    from: '#ffd1e8',
    to: '#c9b8ff',
    tag: '',
    fav: false,
    ratio: '1 / 1',
    src: '',
  },
)

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'fav'): void
}>()
</script>

<template>
  <view class="pcard" @tap="emit('click')">
    <view class="thumb">
      <TileImage :from="from" :to="to" :emoji="emoji" :ratio="ratio" :src="src" />
      <text v-if="tag" class="tag">{{ tag }}</text>
      <view
        class="fav"
        :class="{ on: fav }"
        aria-label="收藏"
        @tap.stop="emit('fav')"
      >
        <UiIcon name="heart" :size="32" :tone="fav ? 'brand' : 'muted'" :stroke-width="fav ? 2.6 : 1.7" />
      </view>
    </view>
    <view class="name">{{ title }}</view>
    <view v-if="price !== undefined" class="price">
      <text class="price-symbol">¥</text>{{ price.toFixed(2) }}
    </view>
  </view>
</template>

<style scoped>
.pcard {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16rpx;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.pcard:active {
  transform: scale(0.97);
}
.thumb {
  position: relative;
}
.tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  font-size: 22rpx;
  font-weight: 700;
  color: #fff;
  background: rgba(0, 0, 0, 0.35);
  padding: 6rpx 16rpx;
  border-radius: 999px;
}
.fav {
  position: absolute;
  top: 12rpx;
  right: 12rpx;
  width: 60rpx;
  height: 60rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  box-shadow: var(--shadow-card);
}
.fav.on {
  background: #fff;
}
.name {
  margin-top: 16rpx;
  margin-left: 8rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-1);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.price {
  margin-top: 4rpx;
  margin-left: 8rpx;
  margin-bottom: 8rpx;
  font-size: 32rpx;
  font-weight: 800;
  color: var(--pink-deep);
}
.price-symbol {
  font-size: 24rpx;
  margin-right: 2rpx;
}
</style>
