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
  }>(),
  { order: undefined },
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
const swatchStyle = computed(() =>
  isSwatch.value ? { background: props.option.color } : {},
)
const fallbackIcon = computed(() => iconForEmoji(props.option.emoji) ?? 'image')
</script>

<template>
  <view
    class="card"
    :class="{ selected }"
    @tap="emit('select', option.id)"
  >
    <!-- 优先真实小图预览，缺素材时回落到占位 -->
    <view class="preview" :class="{ 'preview-plain': !isSwatch }" :style="swatchStyle">
      <image
        v-if="option.img && !imgFailed"
        class="preview-img"
        :src="option.img"
        mode="aspectFill"
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
.card {
  position: relative;
  width: 100%;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 20rpx;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  border: 4rpx solid transparent;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  box-sizing: border-box;
}
.card:active {
  transform: scale(0.97);
}
.card.selected {
  border-color: var(--pink);
  box-shadow: 0 20rpx 48rpx rgba(255, 126, 179, 0.28);
}

.preview {
  position: relative;
  width: 100%;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  /* aspect-ratio: 1.35 在小程序不支持，用固定高度 */
  height: 180rpx;
}
.preview-plain {
  background: #f2f0f6;
}
.preview-img {
  width: 100%;
  height: 100%;
}

.meta {
  display: flex;
  flex-direction: column;
  margin-top: 16rpx;
  padding: 0 4rpx 4rpx;
}
.label {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-1);
}
.desc {
  font-size: 24rpx;
  color: var(--text-3);
  margin-top: 4rpx;
}

.badge {
  position: absolute;
  top: 16rpx;
  right: 16rpx;
  min-width: 48rpx;
  height: 48rpx;
  padding: 0 12rpx;
  border-radius: 999px;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 26rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(177, 140, 255, 0.5);
}
</style>
