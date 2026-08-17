<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    more?: string
  }>(),
  { more: '' },
)

const emit = defineEmits<{
  (e: 'more'): void
}>()
</script>

<template>
  <view class="st">
    <view class="title">{{ title }}</view>
    <view v-if="more" class="more" @tap="emit('more')">
      {{ more }}
      <text class="arrow">›</text>
    </view>
  </view>
</template>

<style scoped>
/*
 * 规格对齐 uv-cell-group 的 __title：30rpx + $uv-main-color、**不加粗**。
 * 原来是 34rpx / 800，比 uv-ui 重一大截。
 * 这是全站「太素了」感最明显的一处，如果实测压不住内容层级，
 * 统一在这里和 components.css 的 .section-title 提到 500，不要去页面里单独加粗。
 */
.st {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 30rpx;
  color: var(--text-1);
}
.more {
  font-size: 24rpx;
  color: var(--text-3);
  display: flex;
  align-items: center;
}
.arrow {
  margin-left: 4rpx;
  font-size: 32rpx;
  line-height: 1;
  color: var(--text-4);
}
</style>
