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
.st {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 34rpx;
  font-weight: 800;
  color: var(--text-1);
}
.more {
  font-size: 26rpx;
  color: var(--text-3);
  display: flex;
  align-items: center;
}
.arrow {
  font-size: 36rpx;
  line-height: 1;
}
</style>
