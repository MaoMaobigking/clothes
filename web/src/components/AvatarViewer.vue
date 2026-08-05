<script setup lang="ts">
import { computed, ref } from 'vue'

/**
 * 多角度 CSS 3D 虚拟形象查看器。
 * 后续拿到 GLB/glTF 资产时，在 setEngine('three') 中接入 Three.js 或 model-viewer，
 * 对外保留 resetView / zoom 等一致接口。
 */

const props = withDefaults(
  defineProps<{
    src?: string
    emoji?: string
    label?: string
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
    frames: () => ({}),
  },
)

const rotateY = ref(-12)
const rotateX = ref(0)
const scale = ref(1)

const pointers = new Map<number, { x: number; y: number }>()
let lastX = 0
let lastY = 0
let startDist = 0
let startScale = 1

const modelSrc = computed(() => props.src || props.frames.front || '')

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
  if (pointers.size === 1) {
    lastX = e.clientX
    lastY = e.clientY
  }
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
    const dy = e.clientY - lastY
    lastX = e.clientX
    lastY = e.clientY
    rotateY.value += dx * 0.7
    rotateX.value = clamp(rotateX.value - dy * 0.35, -24, 24)
  } else if (pointers.size === 2 && startDist > 0) {
    scale.value = clamp(startScale * (twoFingerDist() / startDist), 0.6, 1.8)
  }
}

function onUp(e: PointerEvent) {
  pointers.delete(e.pointerId)
  const rest = [...pointers.values()][0]
  if (rest) {
    lastX = rest.x
    lastY = rest.y
  }
}

function onWheel(e: WheelEvent) {
  e.preventDefault()
  zoom(-e.deltaY * 0.001)
}

function zoom(delta: number) {
  scale.value = clamp(scale.value + delta, 0.6, 1.8)
}

function resetView() {
  rotateY.value = -12
  rotateX.value = 0
  scale.value = 1
}

// Three.js / GLB 接入点：后续替换为真实模型渲染，对外接口不变。
function setEngine(_engine: 'css' | 'three') {
  /* reserved */
}

defineExpose({ resetView, zoom, setEngine })
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
      <div class="podium" />

      <div
        class="figure"
        :style="{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
        }"
      >
        <img v-if="modelSrc" class="model-img" :src="modelSrc" :alt="label" draggable="false" />
        <span v-else class="emoji">{{ emoji }}</span>
      </div>

      <span class="tag">{{ label }}</span>
    </div>

    <div class="controls">
      <button class="ctrl" aria-label="缩小" @click="zoom(-0.15)">－</button>
      <button class="ctrl reset" aria-label="复位" @click="resetView">↺</button>
      <button class="ctrl" aria-label="放大" @click="zoom(0.15)">＋</button>
    </div>
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
  height: 320px;
  perspective: 900px;
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
  position: relative;
  width: 180px;
  height: 280px;
  transform-style: preserve-3d;
  transition: transform 0.06s linear;
  filter: drop-shadow(0 16px 24px rgba(154, 107, 255, 0.35));
  z-index: 2;
}
.model-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}
.emoji {
  font-size: 96px;
}

.podium {
  position: absolute;
  bottom: 34px;
  width: 190px;
  height: 48px;
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
  background: rgba(255, 255, 255, 0.72);
  padding: 4px 10px;
  border-radius: 999px;
  box-shadow: var(--shadow-card);
}

.controls {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 6px;
}
.ctrl {
  width: 42px;
  height: 40px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-1);
  font-size: 18px;
  font-weight: 700;
  box-shadow: var(--shadow-card);
  display: grid;
  place-items: center;
}
.ctrl.reset {
  font-size: 20px;
  color: var(--purple-deep);
}
</style>
