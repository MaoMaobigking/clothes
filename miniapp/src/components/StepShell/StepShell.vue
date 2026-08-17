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
  padding: 8rpx var(--page-x) 0;
  display: flex;
  flex-direction: column;
}
.head {
  margin-bottom: 32rpx;
  flex-shrink: 0;
}
/*
 * 步骤页大标题。44rpx/800 → 40rpx/500。
 * uv-ui 没有 800 这一档字重（它整套只用默认 400 和 bold），
 * 800 在冷灰 #303133 上会显得很硬。
 */
.title {
  font-size: 40rpx;
  font-weight: 500;
  color: var(--text-1);
  line-height: 1.3;
}
.subtitle {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: var(--text-3);
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
