<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <view class="step-shell">
    <view class="head">
      <view class="title">{{ title }}</view>
      <view v-if="subtitle" class="subtitle">{{ subtitle }}</view>
    </view>
    <slot />
  </view>
</template>

<style scoped>
.step-shell {
  flex: 1;
  min-height: 0;
  padding: 8rpx 32rpx 40rpx;
}
.head {
  margin-bottom: 32rpx;
}
.title {
  font-size: 44rpx;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.subtitle {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: var(--text-2);
}
</style>
