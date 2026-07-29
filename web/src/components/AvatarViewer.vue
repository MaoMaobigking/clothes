<script setup lang="ts">
import { ref } from 'vue'

/**
 * 3D 虚拟形象「占位」组件。
 * 目前用一个可拖拽旋转、可缩放的矢量人偶顶位，
 * 以后拿到真实 .glb 模型时，把这里换成 three.js / <model-viewer> 即可，
 * 对外的交互（旋转 / 缩放）保持不变。
 */

const rotate = ref(-12) // 绕 Y 轴角度
const scale = ref(1)

const pointers = new Map<number, { x: number; y: number }>()
let lastX = 0
let startDist = 0
let startScale = 1

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function twoFingerDist() {
  const ps = [...pointers.values()]
  return Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)
}

function onDown(e: PointerEvent) {
  ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (pointers.size === 1) lastX = e.clientX
  if (pointers.size === 2) {
    startDist = twoFingerDist()
    startScale = scale.value
  }
}

function onMove(e: PointerEvent) {
  if (!pointers.has(e.pointerId)) return
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })

  if (pointers.size === 1) {
    const dx = e.clientX - lastX
    lastX = e.clientX
    rotate.value += dx * 0.7
  } else if (pointers.size === 2 && startDist > 0) {
    scale.value = clamp(startScale * (twoFingerDist() / startDist), 0.6, 1.8)
  }
}

function onUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  const rest = [...pointers.values()][0]
  if (rest) lastX = rest.x
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  scale.value = clamp(scale.value - e.deltaY * 0.001, 0.6, 1.8)
}

function zoom(delta: number) {
  scale.value = clamp(scale.value + delta, 0.6, 1.8)
}

function resetView() {
  rotate.value = -12
  scale.value = 1
}
</script>

<template>
  <div class="viewer">
    <div
      class="stage"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @wheel="onWheel"
    >
      <!-- 转盘 -->
      <div class="podium" />

      <!-- 人偶（占位）：绕 Y 轴旋转 + 缩放 -->
      <div
        class="figure"
        :style="{
          transform: `rotateY(${rotate}deg) scale(${scale})`,
        }"
      >
        <svg viewBox="0 0 120 240" width="120" height="240">
          <defs>
            <linearGradient id="bodyGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#ffffff" />
              <stop offset="1" stop-color="#eadcff" />
            </linearGradient>
          </defs>
          <!-- 头 -->
          <circle cx="60" cy="26" r="18" fill="url(#bodyGrad)" stroke="#d9c9f5" />
          <!-- 颈 -->
          <rect x="54" y="42" width="12" height="12" rx="4" fill="url(#bodyGrad)" />
          <!-- 上身 -->
          <path
            d="M40 56 Q60 48 80 56 L84 120 Q60 130 36 120 Z"
            fill="url(#bodyGrad)"
            stroke="#d9c9f5"
          />
          <!-- 手臂 -->
          <rect x="30" y="58" width="10" height="66" rx="5" fill="url(#bodyGrad)" stroke="#e4d7f7" />
          <rect x="80" y="58" width="10" height="66" rx="5" fill="url(#bodyGrad)" stroke="#e4d7f7" />
          <!-- 下身 / 腿 -->
          <rect x="42" y="120" width="15" height="96" rx="7" fill="url(#bodyGrad)" stroke="#d9c9f5" />
          <rect x="63" y="120" width="15" height="96" rx="7" fill="url(#bodyGrad)" stroke="#d9c9f5" />
        </svg>
      </div>

      <span class="tag">虚拟形象 · 占位</span>
    </div>

    <!-- 操作 -->
    <div class="controls">
      <button class="ctrl" aria-label="缩小" @click="zoom(-0.15)">－</button>
      <button class="ctrl reset" @click="resetView">复位</button>
      <button class="ctrl" aria-label="放大" @click="zoom(0.15)">＋</button>
    </div>

    <p class="hint">拖动可旋转 · 双指 / 滚轮可缩放</p>
  </div>
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
  height: 300px;
  perspective: 800px;
  display: grid;
  place-items: center;
  touch-action: none;
  cursor: grab;
  overflow: hidden;
}
.stage:active {
  cursor: grabbing;
}

.figure {
  transform-style: preserve-3d;
  transition: transform 0.05s linear;
  filter: drop-shadow(0 12px 18px rgba(154, 107, 255, 0.35));
  z-index: 2;
}

.podium {
  position: absolute;
  bottom: 34px;
  width: 180px;
  height: 46px;
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
  top: 12px;
  right: 12px;
  font-size: 11px;
  color: var(--text-3);
  background: rgba(255, 255, 255, 0.7);
  padding: 4px 10px;
  border-radius: 999px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}
.ctrl {
  min-width: 44px;
  height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-1);
  font-size: 18px;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.ctrl.reset {
  font-size: 14px;
  color: var(--purple-deep);
}

.hint {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--text-3);
}
</style>
