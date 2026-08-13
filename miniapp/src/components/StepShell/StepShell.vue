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
    <scroll-view scroll-y class="content" :show-scrollbar="false">
      <view class="content-inner">
        <slot />
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.step-shell {
  flex: 1;
  min-height: 0;
  padding: 8rpx 32rpx 0;
  display: flex;
  flex-direction: column;
}
.head {
  margin-bottom: 32rpx;
  flex-shrink: 0;
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
.content {
  flex: 1;
  min-height: 0;
  width: 100%;
}
.content-inner {
  padding-bottom: 40rpx;
}
</style>
