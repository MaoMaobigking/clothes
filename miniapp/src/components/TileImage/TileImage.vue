<script setup lang="ts">
import { ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    from?: string
    to?: string
    emoji?: string
    /** CSS aspect-ratio，如 '3 / 4' */
    ratio?: string
    label?: string
    rounded?: string
    /** 真实图片路径 */
    src?: string
    /** 图片填充方式 */
    fit?: 'cover' | 'contain'
    alt?: string
  }>(),
  {
    from: '#ffd1e8',
    to: '#c9b8ff',
    emoji: '',
    ratio: '1 / 1',
    label: '',
    rounded: 'var(--radius)',
    src: '',
    fit: 'cover',
    alt: '',
  },
)

const failed = ref(false)
watch(
  () => props.src,
  () => {
    failed.value = false
  },
)
</script>

<template>
  <view
    class="tile"
    :style="{
      background: `linear-gradient(140deg, ${from}, ${to})`,
      borderRadius: rounded,
    }"
  >
    <!-- aspect-ratio 用 padding-top hack 模拟 -->
    <view class="tile-inner">
      <image
        v-if="src && !failed"
        class="img"
        :src="src"
        :mode="fit === 'contain' ? 'aspectFit' : 'aspectFill'"
        @error="failed = true"
      />
      <text v-else-if="emoji" class="emoji">{{ emoji }}</text>
      <text v-if="label" class="label">{{ label }}</text>
      <slot />
    </view>
  </view>
</template>

<style scoped>
.tile {
  position: relative;
  width: 100%;
  overflow: hidden;
}
.tile-inner {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* 用 aspect-ratio 在 H5 生效；小程序用 JS 动态 padding */
/* 注意：这里简化为直接依赖 CSS aspect-ratio（H5可用，小程序需后续处理） */
.img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}
.emoji {
  font-size: 56rpx;
}
.label {
  position: absolute;
  bottom: 8px;
  left: 8px;
  font-size: 24rpx;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}
</style>
