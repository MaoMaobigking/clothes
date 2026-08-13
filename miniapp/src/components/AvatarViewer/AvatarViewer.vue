<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 小程序版多角度虚拟形象查看器。
 * 后续拿到 GLB/glTF 资产时，在此组件内接入小程序 3D 渲染方案，
 * 对外保留 resetView / zoom 等一致接口。
 */

const props = withDefaults(
  defineProps<{
    src?: string
    emoji?: string
    label?: string
    initialView?: 'front' | 'back'
    frames?: {
      front?: string
      side?: string
      back?: string
    }
  }>(),
  {
    src: '',
    emoji: '🧍‍♀️',
    label: '虚拟形象',
    initialView: 'front',
    frames: () => ({}),
  },
)

const rotateY = ref(-12)
const rotateX = ref(0)
const scale = ref(1)
const viewMode = ref<'front' | 'back'>(props.initialView)

let lastX = 0
let lastY = 0
let startDist = 0
let startScale = 1

const modelSrc = computed(() => {
  if (viewMode.value === 'back') return props.frames.back || props.src || props.frames.front || ''
  return props.src || props.frames.front || ''
})
const displayLabel = computed(() =>
  viewMode.value === 'back' ? `${props.label} · 背面演示` : props.label,
)

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function touchList(e: any) {
  return Array.from(e.touches || []).map((t: any) => ({ x: t.clientX, y: t.clientY }))
}

function dist(list: { x: number; y: number }[]) {
  return Math.hypot(list[0].x - list[1].x, list[0].y - list[1].y)
}

function onTouchStart(e: any) {
  const list = touchList(e)
  if (list.length === 1) {
    lastX = list[0].x
    lastY = list[0].y
  }
  if (list.length === 2) {
    startDist = dist(list)
    startScale = scale.value
  }
}

function onTouchMove(e: any) {
  const list = touchList(e)
  if (list.length === 1) {
    const dx = list[0].x - lastX
    const dy = list[0].y - lastY
    lastX = list[0].x
    lastY = list[0].y
    rotateY.value += dx * 0.7
    rotateX.value = clamp(rotateX.value - dy * 0.35, -24, 24)
  } else if (list.length === 2 && startDist > 0) {
    scale.value = clamp(startScale * (dist(list) / startDist), 0.6, 1.8)
  }
}

function onTouchEnd(e: any) {
  const list = touchList(e)
  if (list.length === 1) {
    lastX = list[0].x
    lastY = list[0].y
  }
}

function zoom(delta: number) {
  scale.value = clamp(scale.value + delta, 0.6, 1.8)
}

function resetView() {
  rotateY.value = -12
  rotateX.value = 0
  scale.value = 1
}

function setView(view: 'front' | 'back') {
  viewMode.value = view
}

// Three.js / GLB 接入点：后续替换为真实模型渲染，对外接口不变。
function setEngine(_engine: 'css' | 'three') {
  /* reserved */
}

defineExpose({ resetView, zoom, setEngine, setView })
</script>

<template>
  <view class="viewer">
    <view
      class="stage"
      @touchstart="onTouchStart"
      @touchmove.stop.prevent="onTouchMove"
      @touchend="onTouchEnd"
      @touchcancel="onTouchEnd"
    >
      <view class="podium" />

      <view
        class="figure"
        :style="{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale}) ${viewMode === 'back' ? 'scaleX(-1)' : ''}`,
        }"
      >
        <image v-if="modelSrc" class="model-img" :src="modelSrc" :alt="label" mode="aspectFit" />
        <text v-else class="emoji">{{ emoji }}</text>
      </view>

      <text class="tag">{{ displayLabel }}</text>
    </view>

    <view class="controls">
      <view class="ctrl" aria-label="缩小" @tap="zoom(-0.15)">－</view>
      <view class="ctrl reset" aria-label="复位" @tap="resetView">↺</view>
      <view class="ctrl" aria-label="放大" @tap="zoom(0.15)">＋</view>
    </view>
    <view class="view-switch">
      <view
        class="view-option"
        :class="{ on: viewMode === 'front' }"
        @tap="setView('front')"
      >
        正面
      </view>
      <view
        class="view-option"
        :class="{ on: viewMode === 'back' }"
        @tap="setView('back')"
      >
        背面
      </view>
    </view>
  </view>
</template>

<style scoped>
.viewer {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stage {
  position: relative;
  width: 100%;
  height: 640rpx;
  perspective: 900px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.figure {
  position: relative;
  width: 360rpx;
  height: 560rpx;
  transform-style: preserve-3d;
  transition: transform 0.06s linear;
  filter: drop-shadow(0 32rpx 48rpx rgba(154, 107, 255, 0.35));
  z-index: 2;
}
.model-img {
  width: 100%;
  height: 100%;
}
.emoji {
  font-size: 192rpx;
}

.podium {
  position: absolute;
  bottom: 68rpx;
  width: 380rpx;
  height: 96rpx;
  border-radius: 50%;
  background: radial-gradient(
    ellipse at center,
    rgba(255, 143, 192, 0.55),
    rgba(177, 140, 255, 0.15) 70%,
    transparent
  );
  z-index: 1;
}

.tag {
  position: absolute;
  top: 24rpx;
  right: 24rpx;
  font-size: 22rpx;
  color: var(--text-3);
  background: rgba(255, 255, 255, 0.72);
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  box-shadow: var(--shadow-card);
}

.controls {
  display: flex;
  align-items: center;
  gap: 24rpx;
  margin-top: 12rpx;
}
.view-switch {
  display: flex;
  gap: 8rpx;
  margin-top: 18rpx;
  background: rgba(255, 255, 255, 0.72);
  border-radius: 999rpx;
  padding: 6rpx;
  box-shadow: var(--shadow-card);
}
.view-option {
  min-width: 112rpx;
  height: 56rpx;
  padding: 0 24rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-2);
}
.view-option.on {
  color: #fff;
  background: var(--brand-gradient);
}
.ctrl {
  width: 84rpx;
  height: 80rpx;
  border-radius: 999rpx;
  background: var(--surface);
  color: var(--text-1);
  font-size: 36rpx;
  font-weight: 700;
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  justify-content: center;
}
.ctrl.reset {
  font-size: 40rpx;
  color: var(--purple-deep);
}
</style>
