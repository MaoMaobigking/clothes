<script setup lang="ts">
import { AI_TOOLS } from '@/data/mock'

const emit = defineEmits<{ (e: 'tool', tool: (typeof AI_TOOLS)[number]): void }>()
</script>

<template>
  <view class="rail">
    <view
      v-for="t in AI_TOOLS"
      :key="t.key"
      class="tool"
      :class="{ disabled: t.disabled }"
      @tap="emit('tool', t)"
    >
      <text class="t-ico">{{ t.emoji }}</text>
      <text class="t-label">{{ t.label }}</text>
    </view>
  </view>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.tool {
  width: 116rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  padding: 14rpx 4rpx;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-card);
  border: 2rpx solid var(--line);
  transition: transform 0.15s ease;
}
.tool:active {
  transform: scale(0.92);
}
.tool.disabled {
  opacity: 0.45;
  filter: grayscale(0.8);
}
.tool.disabled:active {
  transform: none;
}
.t-ico {
  font-size: 36rpx;
}
.t-label {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--text-2);
}
</style>
