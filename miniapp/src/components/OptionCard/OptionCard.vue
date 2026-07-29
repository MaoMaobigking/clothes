<script setup lang="ts">
import type { Option } from '@/types'

withDefaults(
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
</script>

<template>
  <view
    class="card"
    :class="{ selected }"
    @tap="emit('select', option.id)"
  >
    <!-- 预览色块 + emoji -->
    <view class="preview" :style="{ background: option.color || 'var(--line)' }">
      <text v-if="option.emoji" class="emoji">{{ option.emoji }}</text>
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
  width: 100%;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  /* aspect-ratio: 1.35 在小程序不支持，用固定高度 */
  height: 180rpx;
}
.emoji {
  font-size: 68rpx;
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
