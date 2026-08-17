<script setup lang="ts">
import { computed, ref } from 'vue'
import { VISUAL_BODY_OPTIONS } from '@/data/questions'
import { iconForEmoji } from '@/utils/icons'
import type { AvatarShape, VisualBodyId } from '@/types'

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
    overlay?: {
      slot: string
      emoji?: string
      from?: string
      to?: string
      imageUrl?: string
      enabled?: boolean
    } | null
    /** 身形参数：驱动人台高矮胖瘦与肩腰臀比例（规格 §7.9）；不传则保持中性人台 */
    shape?: AvatarShape | null
  }>(),
  {
    src: '',
    emoji: '🧍‍♀️',
    label: '虚拟形象',
    initialView: 'front',
    frames: () => ({}),
    overlay: null,
    shape: null,
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

/*
 * 试戴素材缺图时退回 emoji（规格 §4.3 §14）。
 *
 * 配饰目录里的 imageUrl 是「约定好的路径」，图片还没到位很正常。
 * 没有这层兜底的话，路径一填上，试戴层就变成一块空白 —— 比先前的 emoji 还糟。
 */
const overlayFailed = ref('')
const overlayImage = computed(() => {
  const url = props.overlay?.imageUrl || ''
  return url && overlayFailed.value !== url ? url : ''
})

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

/* ---------------- 身形参数 → 人台比例（规格 §7.9） ---------------- */

/** 视觉体型对肩 / 腰 / 臀三段宽度的基准系数 */
const SHAPE_PRESET: Record<VisualBodyId, { shoulder: number; waist: number; hip: number }> = {
  hourglass: { shoulder: 1.05, waist: 0.89, hip: 1.05 },
  pear: { shoulder: 0.94, waist: 0.98, hip: 1.13 },
  rectangle: { shoulder: 1, waist: 1, hip: 1 },
  apple: { shoulder: 1.02, waist: 1.12, hip: 0.97 },
  'inverted-triangle': { shoulder: 1.13, waist: 0.95, hip: 0.9 },
}

/** 与 BODY_FIELDS 的默认值一致：用户没动滑块就等于中性默认值，不参与微调 */
const GIRTH_BASELINE = { shoulder: 39, waist: 66, hip: 90 }

/** 人台竖切份数：切得细才不会在肩腰臀交界处出现台阶 */
const SEGMENT_COUNT = 24
/** 相邻切片重叠一点，消除小数高度带来的发丝缝 */
const SEGMENT_OVERLAP = 0.4

const shaped = computed(() => !!props.shape)

/** 未填身高体重时退回中性默认值（规格 §7.5） */
const heightCm = computed(() => props.shape?.height || 165)
const weightKg = computed(() => props.shape?.weight || 52)

const bmi = computed(() => {
  const m = heightCm.value / 100
  return m > 0 ? weightKg.value / (m * m) : 21
})

/** 身高 140~200cm 映射到 0.90~1.10 的人台高度 */
const figureScaleY = computed(() =>
  clamp(0.9 + ((heightCm.value - 140) * 0.2) / 60, 0.9, 1.1),
)

/** BMI 越大人台整体越宽 */
const figureWidthScale = computed(() => clamp(1 + (bmi.value - 21) * 0.018, 0.86, 1.22))

/** 肩 / 腰 / 臀三处横向系数 = 视觉体型基准 × 性别修正 × 实测围度微调 */
const girth = computed(() => {
  const s = props.shape
  const preset = (s?.visualBody && SHAPE_PRESET[s.visualBody]) || SHAPE_PRESET.rectangle
  const male = s?.gender === 'male'
  const nudge = (value: number | undefined, baseline: number) =>
    value ? clamp(value / baseline, 0.9, 1.12) : 1
  return {
    shoulder: clamp(
      preset.shoulder * (male ? 1.06 : 1) * nudge(s?.shoulder, GIRTH_BASELINE.shoulder),
      0.85,
      1.2,
    ),
    waist: clamp(preset.waist * nudge(s?.waist, GIRTH_BASELINE.waist), 0.85, 1.2),
    hip: clamp(
      preset.hip * (male ? 0.95 : 1) * nudge(s?.hip, GIRTH_BASELINE.hip),
      0.85,
      1.2,
    ),
  }
})

function mix(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * 从头到脚的横向系数控制点（y 为占人台高度的比例，对齐人台素材上的肩 / 腰 / 臀位置）。
 * 头部只吃很少的肩宽变化，免得把脸拉变形；小腿逐渐收回中性值。
 */
const widthProfile = computed(() => {
  const g = girth.value
  return [
    [0, mix(1, g.shoulder, 0.25)],
    [0.13, mix(1, g.shoulder, 0.45)],
    [0.22, g.shoulder],
    [0.36, mix(g.shoulder, g.waist, 0.6)],
    [0.45, g.waist],
    [0.52, mix(g.waist, g.hip, 0.8)],
    [0.57, g.hip],
    [0.72, mix(g.hip, 1, 0.6)],
    [1, mix(g.hip, 1, 0.9)],
  ] as [number, number][]
})

/** 在控制点之间线性取值 */
function sampleWidth(points: [number, number][], y: number) {
  if (y <= points[0][0]) return points[0][1]
  for (let i = 1; i < points.length; i += 1) {
    const [y0, v0] = points[i - 1]
    const [y1, v1] = points[i]
    if (y <= y1) return mix(v0, v1, y1 === y0 ? 0 : (y - y0) / (y1 - y0))
  }
  return points[points.length - 1][1]
}

/**
 * 把人台竖切成若干片分别横向缩放：片内图片仍按整体高度排版后裁切，
 * 所以拼起来还是一个完整的人，只是肩腰臀宽度按身形参数走。
 */
const bodySegments = computed(() => {
  const step = 100 / SEGMENT_COUNT
  const points = widthProfile.value
  return Array.from({ length: SEGMENT_COUNT }, (_, i) => {
    const top = i * step
    const height = step + (i < SEGMENT_COUNT - 1 ? SEGMENT_OVERLAP : 0)
    const ratio = sampleWidth(points, (top + step / 2) / 100)
    return {
      key: i,
      style: {
        top: `${top.toFixed(3)}%`,
        height: `${height.toFixed(3)}%`,
        transform: `scaleX(${ratio.toFixed(3)})`,
      },
      imgStyle: {
        height: `${(10000 / height).toFixed(2)}%`,
        top: `${((-top * 100) / height).toFixed(2)}%`,
      },
    }
  })
})

const figureStyle = computed(() => {
  const mirror = viewMode.value === 'back' ? -1 : 1
  const sx = (shaped.value ? figureWidthScale.value : 1) * mirror
  const sy = shaped.value ? figureScaleY.value : 1
  return {
    transform:
      `rotateX(${rotateX.value}deg) rotateY(${rotateY.value}deg) ` +
      `scale(${scale.value}) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`,
  }
})

/** 人台下方的参数说明，演示时能直接看到差异是由哪些输入驱动的 */
const specText = computed(() => {
  const s = props.shape
  if (!s) return ''
  const parts: string[] = []
  if (s.gender) parts.push(s.gender === 'male' ? '男' : '女')
  if (s.height) parts.push(`${Math.round(s.height)}cm`)
  if (s.weight) parts.push(`${Math.round(s.weight)}kg`)
  const vb = VISUAL_BODY_OPTIONS.find((o) => o.id === s.visualBody)
  if (vb) parts.push(vb.label)
  return parts.join(' · ')
})

/* ---------------- 手势 ---------------- */

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

/* ---------------- 背面试戴（规格 §9.5） ---------------- */

/**
 * 这些槽位的配饰绕身体一圈或戴在头脚上，背面看得见；
 * 首饰（项链 / 耳环 / 戒指）只有正面素材，切到背面必须明说，不能静默消失。
 */
const BACK_VISIBLE_SLOTS = ['hat', 'scarf', 'belt', 'shoes']

const overlayVisible = computed(() => {
  if (!props.overlay?.enabled) return false
  if (viewMode.value === 'front') return true
  return BACK_VISIBLE_SLOTS.includes(props.overlay.slot)
})

/** 开着试戴、但当前槽位没有背面素材 */
const backUnavailable = computed(
  () => viewMode.value === 'back' && !!props.overlay?.enabled && !overlayVisible.value,
)

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

      <view class="figure" :style="figureStyle">
        <!-- 传了身形参数就按肩 / 腰 / 臀分段渲染，否则一张整图 -->
        <template v-if="modelSrc && shaped">
          <view
            v-for="seg in bodySegments"
            :key="seg.key"
            class="seg"
            :style="seg.style"
          >
            <image
              class="seg-img"
              :src="modelSrc"
              :alt="label"
              mode="aspectFit"
              :style="seg.imgStyle"
            />
          </view>
        </template>
        <image
          v-else-if="modelSrc"
          class="model-img"
          :src="modelSrc"
          :alt="label"
          mode="aspectFit"
        />
        <UiIcon v-else class="emoji" :name="iconForEmoji(emoji) ?? 'me'" :size="72" tone="muted" :stroke-width="1.3" />
        <view
          v-if="overlayVisible"
          class="accessory-overlay"
          :class="[`slot-${overlay?.slot}`, { mirrored: viewMode === 'back' }]"
          :style="{
            background: `linear-gradient(140deg, ${overlay?.from || '#ffffff'}, ${overlay?.to || '#e6e0ef'})`,
          }"
        >
          <image
            v-if="overlayImage"
            class="accessory-overlay-img"
            :src="overlayImage"
            mode="aspectFit"
            @error="overlayFailed = overlayImage"
          />
          <UiIcon v-else class="accessory-overlay-emoji" :name="iconForEmoji(overlay?.emoji) ?? 'gem'" :size="36" tone="muted" />
        </view>
      </view>

      <text class="tag">{{ displayLabel }}</text>
      <text v-if="specText" class="spec">{{ specText }}</text>
      <text v-if="backUnavailable" class="back-missing">该配饰暂无背面试戴素材</text>
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
  /* 比人台基准高度留出余量，身高拉满时不被裁掉 */
  height: 680rpx;
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
  /* 以脚下为基准缩放：长高往上长，不会陷进地台 */
  transform-origin: center bottom;
  transition: transform 0.06s linear;
  filter: drop-shadow(0 32rpx 48rpx rgba(154, 107, 255, 0.35));
  z-index: 2;
}
.model-img {
  width: 100%;
  height: 100%;
}
/* 肩 / 腰 / 臀分段：段内图片按整体高度排版后裁切，再各自横向缩放 */
.seg {
  position: absolute;
  left: 0;
  width: 100%;
  overflow: hidden;
}
.seg-img {
  position: absolute;
  left: 0;
  width: 100%;
}
.emoji {
  font-size: 192rpx;
}

.accessory-overlay {
  position: absolute;
  left: 50%;
  z-index: 5;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 4rpx solid rgba(255, 255, 255, 0.86);
  box-shadow: 0 8rpx 22rpx rgba(70, 50, 110, 0.28);
  transform: translateX(-50%);
}
/* 背面视角整个人台是镜像的，配饰再反一次才不会左右颠倒 */
.accessory-overlay.mirrored {
  transform: translateX(-50%) scaleX(-1);
}
.slot-jewelry {
  top: 20%;
  width: 54rpx;
  height: 54rpx;
  border-radius: 50%;
}
.slot-hat {
  top: -3%;
  width: 150rpx;
  height: 82rpx;
  border-radius: 48% 48% 20rpx 20rpx;
}
.slot-scarf {
  top: 31%;
  width: 126rpx;
  height: 60rpx;
  border-radius: 999rpx;
}
.slot-belt {
  top: 63%;
  width: 134rpx;
  height: 28rpx;
  border-radius: 999rpx;
}
.slot-shoes {
  bottom: 1%;
  top: auto;
  width: 146rpx;
  height: 54rpx;
  border-radius: 999rpx 999rpx 28rpx 28rpx;
}
.accessory-overlay-img {
  width: 100%;
  height: 100%;
}
.accessory-overlay-emoji {
  font-size: 38rpx;
  line-height: 1;
  transform: scale(1.2);
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

.spec {
  position: absolute;
  bottom: 20rpx;
  left: 24rpx;
  z-index: 3;
  font-size: 22rpx;
  font-weight: 700;
  color: var(--purple-deep);
  background: rgba(255, 255, 255, 0.78);
  padding: 8rpx 20rpx;
  border-radius: 999rpx;
  box-shadow: var(--shadow-card);
}

/* 背面没有对应素材时的明示，宁可占块地方也别让配饰静默消失（§9.5） */
.back-missing {
  position: absolute;
  top: 88rpx;
  right: 24rpx;
  z-index: 6;
  max-width: 62%;
  font-size: 21rpx;
  font-weight: 700;
  color: var(--warning);
  background: rgba(255, 243, 240, 0.94);
  padding: 10rpx 20rpx;
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
