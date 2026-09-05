<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { iconForEmoji } from '@/utils/icons'
import type { Option } from '@/types'

const props = withDefaults(
  defineProps<{
    option: Option
    selected: boolean
    /** 选中角标里显示的序号（风格多选时用），不传则显示对勾 */
    order?: number
    /** 小图高度。横滑卡片比网格卡片大一号，靠调用方给 */
    previewHeight?: string
  }>(),
  { order: undefined, previewHeight: '180rpx' },
)

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()

/** 小图加载失败（素材尚未配置）时回落到占位，见规格 §7.4 */
const imgFailed = ref(false)
watch(
  () => props.option.img,
  () => {
    imgFailed.value = false
  },
)

/*
 * 肤色选项没有 emoji —— 它的 color 就是真实肤色色卡，是内容本身，必须原样显示。
 * 风格 / 脸型 / 体型选项带 emoji，它们的 color 只是装饰性的高饱和底色，
 * 配上 3D emoji 就是整页最卡通的地方，缺图时一律走中性底 + 线性图标。
 */
const isSwatch = computed(() => !props.option.emoji && !!props.option.color)
const swatchStyle = computed(() => (isSwatch.value ? { background: props.option.color } : {}))
const fallbackIcon = computed(() => iconForEmoji(props.option.emoji) ?? 'image')
</script>

<template>
  <!--
    根类从 .card 改名成 .opt-card：
    .card 是 components.css 里的全局类，这里同名会撞（scoped 优先级更高，
    全局的 .card 在这个组件里永远不生效）—— 功能上没坏，但很误导，
    css-audit 也会把它算成一处「.card 的重复定义」。
  -->
  <view class="opt-card" :class="{ selected }" @tap="emit('select', option.id)">
    <!-- 优先真实小图预览，缺素材时回落到占位 -->
    <view class="preview" :class="{ 'preview-plain': !isSwatch }" :style="{ ...swatchStyle, height: previewHeight }">
      <uv-image
        v-if="option.img && !imgFailed"
        :src="option.img"
        mode="aspectFill"
        width="100%"
        height="100%"
        :show-loading="false"
        :show-error="false"
        @error="imgFailed = true"
      />
      <!-- 查不到映射也要给个通用图标，不能留一块空白灰底 -->
      <UiIcon v-else :name="fallbackIcon" :size="64" tone="muted" :stroke-width="1.4" />
    </view>

    <view class="meta">
      <text class="label">{{ option.label }}</text>
      <text v-if="option.desc" class="desc">{{ option.desc }}</text>
    </view>

    <!-- 选中角标 -->
    <view v-if="selected" class="badge">
      <template v-if="order !== undefined">{{ order }}</template>
      <template v-else>✓</template>
    </view>
  </view>
</template>

<style scoped>
.opt-card {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 20rpx;
  background: var(--surface);

  /*
   * 边框从 4rpx 降到 2rpx，且未选中时不再是 transparent 而是发丝线色。
   * 原来靠「透明 4rpx 边 + 选中变色」避免选中时尺寸跳动；
   * 现在未选中本来就有边（uv-ui 的卡片都带边），选中只换颜色，同样不跳。
   */
  border: 2rpx solid var(--line);
  border-radius: var(--radius);
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    opacity 0.15s ease;
}

/* 按压反馈用透明度，对齐 uv-ui 的 .uv-hover-class { opacity: 0.7 } */
.opt-card:active {
  opacity: 0.7;
}

/*
 * 选中态：主色描边 + 极浅主色底。
 * 原来是主色描边 + 0 20rpx 48rpx rgba(255,126,179,0.28) 的粉色光晕投影 ——
 * uv-ui 里没有彩色投影，选中一律靠描边和浅底表达。
 */
.opt-card.selected {
  background: var(--pink-soft);
  border-color: var(--pink-deep);
}

.preview {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;

  /* aspect-ratio: 1.35 在小程序不支持，高度由 previewHeight 内联给，这里只兜底 */
  height: 180rpx;
  overflow: hidden;
  border-radius: var(--radius-sm);
}

.preview-plain {
  background: var(--surface-placeholder);
}

.meta {
  display: flex;
  flex-direction: column;
  padding: 0 4rpx 4rpx;
  margin-top: 16rpx;
}

.label {
  font-size: 28rpx;
  color: var(--text-1);
}

.desc {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: var(--text-3);
}

/* 选中角标：主色实底，无投影 */
.badge {
  position: absolute;
  top: 14rpx;
  right: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 40rpx;
  height: 40rpx;
  padding: 0 10rpx;
  font-size: 24rpx;
  color: #fff;
  background: var(--pink-deep);
  border-radius: var(--radius-pill);
}
</style>
