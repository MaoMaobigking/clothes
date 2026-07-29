<script setup lang="ts">
/**
 * AvatarViewer 小程序版 —— 简化成静态 TileImage 占位
 * uni-app 不支持 Three.js，按规划表用静态图 + emoji 替代
 */
import TileImage from '@/components/TileImage/TileImage.vue'

withDefaults(
  defineProps<{
    src?: string
    emoji?: string
    label?: string
  }>(),
  {
    src: '',
    emoji: '🧍‍♀️',
    label: '虚拟形象',
  },
)
</script>

<template>
  <view class="viewer">
    <TileImage
      :src="src"
      :emoji="emoji"
      :label="label"
      :ratio="'4 / 5'"
      from="#ffd6e8"
      to="#d6a0ff"
      :rounded="'var(--radius-lg)'"
    />
    <text class="hint">虚拟形象 · 占位</text>
  </view>
</template>

<style scoped>
.viewer {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 32rpx;
}
.hint {
  margin-top: 24rpx;
  font-size: 24rpx;
  color: var(--text-3);
}
</style>
