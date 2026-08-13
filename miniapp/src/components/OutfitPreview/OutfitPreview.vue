<script setup lang="ts">
import { computed } from 'vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { MODEL_IMAGES } from '@/data/mock'
import type { Outfit } from '@/api/wardrobe'

const props = defineProps<{ outfit: Outfit }>()

const positions = [
  { left: '2%', top: '20%' },
  { right: '2%', top: '24%' },
  { left: '3%', top: '48%' },
  { right: '3%', top: '52%' },
  { left: '4%', top: '72%' },
  { right: '4%', top: '76%' },
]

const overlays = computed(() =>
  props.outfit.items.slice(0, positions.length).map((item, index) => ({
    ...item,
    style: positions[index],
  })),
)
</script>

<template>
  <view class="preview">
    <TileImage
      class="model"
      :src="MODEL_IMAGES.front"
      from="#ffe3ef"
      to="#e7d4ff"
      emoji="🧍‍♀️"
      ratio="3 / 4"
      fit="contain"
    />
    <view
      v-for="overlay in overlays"
      :key="overlay.id"
      class="overlay"
      :style="overlay.style"
    >
      <image
        :src="overlay.garment.img"
        mode="aspectFill"
        class="overlay-img"
      />
    </view>
    <view class="caption">真实旧衣组合演示</view>
  </view>
</template>

<style scoped>
.preview {
  position: relative;
  height: 540rpx;
  border-radius: var(--radius);
  overflow: hidden;
  background: linear-gradient(155deg, #fff4f8, #f3ebff);
}
.model {
  position: absolute;
  inset: 0;
}
.overlay {
  position: absolute;
  z-index: 3;
  width: 74rpx;
  height: 74rpx;
  border-radius: 18rpx;
  border: 4rpx solid #fff;
  background: #fff;
  box-shadow: 0 8rpx 18rpx rgba(70, 50, 110, 0.22);
  overflow: hidden;
}
.overlay-img {
  width: 100%;
  height: 100%;
}
.caption {
  position: absolute;
  left: 16rpx;
  bottom: 14rpx;
  z-index: 4;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(45, 33, 60, 0.68);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}
</style>
