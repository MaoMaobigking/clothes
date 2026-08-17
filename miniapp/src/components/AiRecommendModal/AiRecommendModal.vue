<script setup lang="ts">
defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'view'): void
  (e: 'close'): void
}>()
</script>

<template>
  <view v-if="visible" class="mask" @tap="emit('close')">
    <view class="sheet" @tap.stop>
      <UiIcon class="spark" name="sparkle" :size="44" tone="purple" />
      <view class="title">智能推荐已生成</view>
      <view class="desc">
        AI 已根据你的风格、肤色、脸型、体型和偏好，生成了专属风格报告
      </view>
      <view class="btn btn-primary view" @tap="emit('view')">
        查看我的专属风格报告
      </view>
      <view class="btn-text" @tap="emit('close')">再改改</view>
    </view>
  </view>
</template>

<style scoped>
.spark {
  width: 144rpx;
  height: 144rpx;
  border-radius: 50%;
  background: var(--brand-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 72rpx;
  box-shadow: var(--shadow-float);
  margin-top: -112rpx;
  animation: pop 0.4s ease;
}
@keyframes pop {
  from {
    transform: scale(0.4);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

.title {
  margin-top: 24rpx;
  font-size: 40rpx;
  font-weight: 800;
  color: var(--text-1);
}
.desc {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: var(--text-2);
}
.view {
  width: 100%;
  margin-top: 48rpx;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  padding: 0 48rpx;
  border-radius: var(--radius-pill);
  font-size: 32rpx;
  font-weight: 600;
}
.btn-primary {
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  box-shadow: 0 16rpx 40rpx rgba(177, 140, 255, 0.4);
}

.btn-text {
  margin-top: 20rpx;
  font-size: 28rpx;
  color: var(--text-3);
  padding: 16rpx 32rpx;
}
</style>
