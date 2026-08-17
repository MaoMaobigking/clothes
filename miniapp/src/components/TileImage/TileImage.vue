<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import UiIcon from '@/components/UiIcon/UiIcon.vue'
import { iconForEmoji, type IconName } from '@/utils/icons'

const props = withDefaults(
  defineProps<{
    from?: string
    to?: string
    emoji?: string
    /** 缺图时显示的线性图标；不传则从 emoji 自动查表 */
    icon?: IconName
    /** 宽高比，如 '3 / 4'（也接受 '3/4'、'1.35' 这种纯数字写法） */
    ratio?: string
    label?: string
    rounded?: string
    /** 真实图片路径 */
    src?: string
    /** 图片填充方式 */
    fit?: 'cover' | 'contain'
    alt?: string
    /**
     * 撑满父容器高度（父容器需有确定高度）。
     * 默认 false，此时高度由 ratio 决定。
     */
    fill?: boolean
    /**
     * 用 from/to 画彩色渐变底。默认 false —— 缺图位一律走中性浅灰底。
     * 彩色渐变块 + 大号 emoji 是「卡通感」的主要来源，设计稿里没有这种东西。
     */
    tint?: boolean
  }>(),
  {
    from: '#ffd1e8',
    to: '#c9b8ff',
    emoji: '',
    icon: undefined,
    ratio: '1 / 1',
    label: '',
    rounded: 'var(--radius)',
    src: '',
    fit: 'cover',
    alt: '',
    fill: false,
    tint: false,
  },
)

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)

const showPlaceholder = computed(() => !props.src || failed.value)

/*
 * 缺图占位用什么图标：显式传的 icon 优先，其次拿 emoji 查表
 * （全站 20 个调用点都还在传 emoji，查表让它们零改动就换成线性图标），
 * 都没有就退到通用的图片图标。
 */
const placeholderIcon = computed<IconName>(
  () => props.icon ?? iconForEmoji(props.emoji) ?? 'image',
)

/*
 * 宽高比用 padding-top 撑开，不用 CSS aspect-ratio。
 *
 * 小程序低版本基础库不支持 aspect-ratio（OptionCard.vue 里也是因为这个改的固定高度）。
 * padding-top 百分比是相对**父元素宽度**算的，H5 和小程序行为一致，是最稳的做法。
 *
 * 之前这个 prop 声明了却没接到样式上，.tile-inner 里唯一的子元素 <image> 又是绝对定位、
 * 不撑高度，结果是「一传 src 图片就渲染成 0 高」。磁盘上长期只有 2 张图所以没暴露。
 */
const padTop = computed(() => {
  const m = String(props.ratio).trim().match(/^([\d.]+)\s*(?:\/\s*([\d.]+))?$/)
  if (!m) return '100%'
  const w = Number(m[1])
  const h = m[2] === undefined ? 1 : Number(m[2])
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return '100%'
  return `${((h / w) * 100).toFixed(4)}%`
})

const tileStyle = computed(() => ({
  background: props.tint ? `linear-gradient(140deg, ${props.from}, ${props.to})` : '',
  borderRadius: props.rounded,
}))
</script>

<template>
  <view
    class="tile"
    :class="{ 'tile-fill': fill, 'tile-plain': showPlaceholder && !tint }"
    :style="tileStyle"
  >
    <view
      class="tile-inner"
      :class="{ 'tile-fill': fill }"
      :style="fill ? {} : { paddingTop: padTop }"
    >
      <!-- 内容层铺满这个按比例撑开的盒子 -->
      <view class="tile-content">
        <image
          v-if="!showPlaceholder"
          class="img"
          :src="src"
          :mode="fit === 'contain' ? 'aspectFit' : 'aspectFill'"
          @error="failed = true"
        />
        <UiIcon v-else :name="placeholderIcon" :size="56" tone="muted" :stroke-width="1.4" />
        <text v-if="label" class="label">{{ label }}</text>
        <slot />
      </view>
    </view>
  </view>
</template>

<style scoped>
.tile {
  position: relative;
  width: 100%;
  overflow: hidden;
}
/* 中性占位底：浅灰偏冷。只在「没有图」时铺，图加载出来了就不该再垫一层灰底
   —— 抠图立绘（模特那种透明 PNG）会被这层灰框住，看着像贴了张卡片。 */
.tile-plain {
  background: #f2f0f6;
}
.tile-inner {
  position: relative;
  width: 100%;
}
/* fill 模式下撑满父容器，供左图右文这类需要图片占满整列的卡片使用 */
.tile-fill {
  height: 100%;
  padding-top: 0;
}
.tile-content {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.img {
  width: 100%;
  height: 100%;
}
.label {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-2);
}
</style>
