<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { MODEL_IMAGES } from '@/data/mock'
import { categoryLabel } from '@/data/wardrobeOptions'
import type { OutfitPiece } from '@/utils/outfitPieces'

const props = withDefaults(
  defineProps<{
    /** 要叠到人台上的真实单品，见 utils/outfitPieces.ts */
    pieces: OutfitPiece[]
    /** 场景底图（功能四）。不传就用品牌渐变底（功能二） */
    background?: string
    /** 底图缺素材时的中性占位（§4.3），不补卡通图 */
    backgroundEmoji?: string
    /** 滤镜遮罩，CSS background 值。功能四切滤镜只改这一层，衣物不动（§10.9） */
    filterStyle?: string
    /** 人台图，默认女款正面 */
    model?: string
    caption?: string
    height?: string
  }>(),
  {
    background: '',
    backgroundEmoji: '',
    filterStyle: '',
    model: MODEL_IMAGES.front,
    caption: '真实旧衣组合演示',
    height: '540rpx',
  },
)

/**
 * 全身效果图的叠加位（规格 §8.8 §10.7）。
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
  return props.pieces.map((piece, index) => {
    const slot = SLOTS[piece.category] || {
      top: FALLBACK.top + index * MIN_GAP,
      side: FALLBACK.side,
    }
    let top = slot.top
    while (used[slot.side].some((taken) => Math.abs(taken - top) < MIN_GAP)) {
      top += MIN_GAP
    }
    used[slot.side].push(top)
    return {
      ...piece,
      label: categoryLabel(piece.category),
      style: {
        top: `${Math.min(top, 84)}%`,
        [slot.side]: '3%',
      } as Record<string, string>,
    }
  })
})

// 缺素材时退回中性底，不显示裂图（§4.3）
const bgFailed = ref(false)
const modelFailed = ref(false)
watch(() => props.background, () => (bgFailed.value = false))
watch(() => props.model, () => (modelFailed.value = false))
</script>

<template>
  <view class="preview" :style="{ height }">
    <image
      v-if="background && !bgFailed"
      class="layer bg"
      :src="background"
      mode="aspectFill"
      @error="bgFailed = true"
    />
    <view v-else-if="backgroundEmoji" class="layer bg-emoji">
      <text>{{ backgroundEmoji }}</text>
    </view>

    <view v-if="filterStyle" class="layer filter" :style="{ background: filterStyle }" />

    <image
      v-if="!modelFailed"
      class="model"
      :src="model"
      mode="aspectFit"
      @error="modelFailed = true"
    />
    <text v-else class="model-fallback">🧍‍♀️</text>

    <view
      v-for="overlay in overlays"
      :key="overlay.id"
      class="overlay"
      :style="overlay.style"
    >
      <image
        v-if="overlay.img"
        :src="overlay.img"
        mode="aspectFill"
        class="overlay-img"
      />
      <view
        v-else
        class="overlay-img placeholder"
        :style="{ background: `linear-gradient(140deg, ${overlay.from}, ${overlay.to})` }"
      >
        <text>{{ overlay.emoji }}</text>
      </view>
      <text class="overlay-tag">{{ overlay.label }}</text>
    </view>

    <view v-if="caption" class="caption">{{ caption }}</view>
  </view>
</template>

<style scoped>
.preview {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  background: linear-gradient(155deg, #fff4f8, #f3ebff);
}
.layer {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.bg-emoji {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 108rpx;
  background: linear-gradient(150deg, #e9f2ff, #f3e8ff);
}
.filter {
  z-index: 1;
  pointer-events: none;
}
.model,
.model-fallback {
  position: absolute;
  left: 50%;
  top: 6%;
  width: 60%;
  height: 84%;
  transform: translateX(-50%);
  z-index: 2;
}
.model-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 120rpx;
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
.overlay-img.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 44rpx;
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
  right: 16rpx;
  z-index: 4;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  background: rgba(45, 33, 60, 0.68);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>
