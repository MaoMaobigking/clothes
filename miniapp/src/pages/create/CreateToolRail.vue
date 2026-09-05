<script setup lang="ts">
import { AI_TOOLS } from '@/constants/ui'

const emit = defineEmits<{ (e: 'tool', tool: (typeof AI_TOOLS)[number]): void }>()
</script>

<template>
  <view class="rail">
    <view v-for="t in AI_TOOLS" :key="t.key" class="tool" :class="{ disabled: t.disabled }" @tap="emit('tool', t)">
      <UiIcon :name="t.icon" :size="38" :tone="t.disabled ? 'muted' : 'dark'" />
      <text class="t-label">{{ t.label }}</text>
      <!-- 只灰不说话会被当成「点了没反应」；和「我的」页未开放菜单用同一句「开发中」 -->
      <text v-if="t.disabled" class="t-soon">开发中</text>
    </view>
  </view>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

/*
 * 设计稿里这排工具是「裸图标 + 文字」直接落在背景上，没有卡片外壳。
 * 之前每个都套了张白卡，6 个工具就是 6 块视觉噪音，把中间的模特压下去了。
 */
.tool {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
  align-items: center;
  width: 108rpx;
  padding: 8rpx 4rpx;
  transition: transform 0.15s ease;
}

.tool:active {
  transform: scale(0.92);
}

.tool.disabled {
  opacity: 0.4;
}

.tool.disabled .t-label {
  color: var(--text-4);
}

.tool.disabled:active {
  transform: none;
}

.t-soon {
  font-size: 18rpx;
  line-height: 1.2;
  color: var(--text-4);
}

.t-label {
  font-size: 20rpx;
  font-weight: 500;
  color: var(--text-2);
}
</style>
