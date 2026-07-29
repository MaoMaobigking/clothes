<script setup lang="ts">
defineProps<{
  title: string
  /** 当前步（1 起） */
  current: number
  /** 总步数 */
  total: number
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <view class="app-header">
    <view class="bar">
      <view class="back" aria-label="返回" @tap="emit('back')">
        <text class="arrow-icon">‹</text>
      </view>
      <view class="title">{{ title }}</view>
      <text class="counter">{{ current }}/{{ total }}</text>
    </view>

    <!-- 进度条 -->
    <view class="progress">
      <view class="progress-fill" :style="{ width: `${(current / total) * 100}%` }" />
    </view>
  </view>
</template>

<style scoped>
.app-header {
  padding: 16rpx 32rpx 24rpx;
  flex-shrink: 0;
}

.bar {
  display: flex;
  align-items: center;
}

.back {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}
.arrow-icon {
  font-size: 48rpx;
  font-weight: 300;
  line-height: 1;
  color: var(--text-1);
}

.title {
  flex: 1;
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
}

.counter {
  position: absolute;
  right: 32rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--purple-deep);
  background: rgba(255, 255, 255, 0.7);
  padding: 8rpx 20rpx;
  border-radius: var(--radius-pill);
}

.progress {
  margin-top: 28rpx;
  height: 12rpx;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--brand-gradient);
  transition: width 0.35s ease;
}
</style>
