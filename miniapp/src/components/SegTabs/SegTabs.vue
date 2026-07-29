<script setup lang="ts">
defineProps<{
  tabs: { key: string; label: string }[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', key: string): void
}>()
</script>

<template>
  <view class="seg">
    <view
      v-for="t in tabs"
      :key="t.key"
      class="seg-item"
      :class="{ on: modelValue === t.key }"
      @tap="emit('update:modelValue', t.key)"
    >
      {{ t.label }}
    </view>
  </view>
</template>

<style scoped>
.seg {
  display: flex;
  gap: 8rpx;
  padding: 8rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-card);
}
.seg-item {
  padding: 16rpx 40rpx;
  border-radius: var(--radius-pill);
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-2);
  transition: all 0.2s ease;
}
.seg-item.on {
  background: var(--brand-gradient);
  color: #fff;
  box-shadow: 0 12rpx 28rpx rgba(177, 140, 255, 0.4);
}
</style>
