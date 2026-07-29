<script setup lang="ts">
import type { StepMeta } from '@/types'

defineProps<{
  steps: StepMeta[]
  /** 当前步（1 起） */
  current: number
}>()

const emit = defineEmits<{
  (e: 'select', step: number): void
}>()
</script>

<template>
  <scroll-view scroll-x class="steps" :show-scrollbar="false">
    <view
      v-for="(s, i) in steps"
      :key="s.key"
      class="step"
      :class="{
        active: current === i + 1,
        done: current > i + 1,
      }"
      @tap="emit('select', i + 1)"
    >
      <view class="dot">
        <text v-if="current > i + 1" class="check">✓</text>
        <text v-else class="emoji">{{ s.emoji }}</text>
      </view>
      <text class="label">{{ s.title }}</text>
    </view>
  </scroll-view>
</template>

<style scoped>
.steps {
  display: flex;
  padding: 8rpx 32rpx 24rpx;
  flex-shrink: 0;
  white-space: nowrap;
}

.step {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 112rpx;
  opacity: 0.55;
  transition: opacity 0.2s ease;
  margin-right: 12rpx;
}
.step.active,
.step.done {
  opacity: 1;
}

.dot {
  width: 88rpx;
  height: 88rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: var(--shadow-card);
  font-size: 40rpx;
  transition: transform 0.2s ease, background 0.2s ease;
}
.step.active .dot {
  background: var(--brand-gradient);
  transform: scale(1.08);
}
.step.done .dot {
  background: var(--mint);
}
.emoji {
  font-size: 40rpx;
}

.check {
  color: #fff;
  font-weight: 800;
  font-size: 36rpx;
}

.label {
  font-size: 22rpx;
  font-weight: 600;
  color: var(--text-2);
  margin-top: 12rpx;
}
.step.active .label {
  color: var(--purple-deep);
}
</style>
