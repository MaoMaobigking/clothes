<script setup lang="ts">
import { computed } from 'vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { MODEL_IMAGES } from '@/data/mock'
import { categoryLabel } from '@/data/wardrobeOptions'
import type { Outfit } from '@/api/wardrobe'

const props = defineProps<{ outfit: Outfit }>()

/**
 * 全身效果图的叠加位（规格 §8.8）。
 *
 * 以前是 6 个固定角标位，谁先来占谁 —— 鞋可能贴在胸口，帽子挂在腿边。
 * 现在按品类给高度：帽子在头、上衣在胸、下装在腿、鞋在脚，
 * 包和首饰走侧边配饰位。人台是窄条居中，所以左右错开摆，不挡身体。
 */
const SLOTS: Record<string, { top: number; side: 'left' | 'right' }> = {
  hat: { top: 3, side: 'right' },
  jewelry: { top: 15, side: 'right' },
  top: { top: 26, side: 'left' },
  dress: { top: 30, side: 'left' },
  bag: { top: 40, side: 'right' },
  pants: { top: 52, side: 'left' },
  skirt: { top: 52, side: 'left' },
  accessory: { top: 62, side: 'right' },
  shoes: { top: 78, side: 'left' },
}
/** 品类没登记时的兜底位，按出现顺序往下排 */
const FALLBACK = { top: 34, side: 'left' as const }
/** 同一侧两件挨太近就往下挪，避免叠成一坨 */
const MIN_GAP = 15

const overlays = computed(() => {
  const used: Record<'left' | 'right', number[]> = { left: [], right: [] }
  return props.outfit.items.map((item, index) => {
    const slot = SLOTS[item.garment.category] || {
      top: FALLBACK.top + index * MIN_GAP,
      side: FALLBACK.side,
    }
    let top = slot.top
    while (used[slot.side].some((taken) => Math.abs(taken - top) < MIN_GAP)) {
      top += MIN_GAP
    }
    used[slot.side].push(top)
    return {
      ...item,
      label: categoryLabel(item.garment.category),
      style: {
        top: `${Math.min(top, 84)}%`,
        [slot.side]: '3%',
      } as Record<string, string>,
    }
  })
})
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
      <text class="overlay-tag">{{ overlay.label }}</text>
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
  width: 108rpx;
  height: 108rpx;
  border-radius: 20rpx;
  border: 4rpx solid #fff;
  background: #fff;
  box-shadow: 0 8rpx 18rpx rgba(70, 50, 110, 0.22);
  overflow: hidden;
}
.overlay-img {
  width: 100%;
  height: 100%;
}
.overlay-tag {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  text-align: center;
  font-size: 18rpx;
  font-weight: 700;
  color: #fff;
  background: rgba(45, 33, 60, 0.62);
  padding: 2rpx 0;
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
