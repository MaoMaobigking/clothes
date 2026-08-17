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
        <UiIcon v-else :name="s.icon" :size="34" :tone="current === i + 1 ? 'white' : 'light'" />
      </view>
      <text class="label">{{ s.title }}</text>
    </view>
  </scroll-view>
</template>

<style scoped>
/*
 * 这个组件**保留自绘，没换成 uv-steps** —— uv-steps-item 没有点击事件，
 * 换过去会丢掉「点某一步跳转」的功能（pages/test/index.vue 用了 @select）。
 * 所以这里只做换皮，结构不动。
 */
.steps {
  display: flex;
  padding: 8rpx var(--page-x) 24rpx;
  flex-shrink: 0;
  white-space: nowrap;
}

.step {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 112rpx;
  margin-right: 12rpx;
}
/*
 * 未到达的步骤原来是整块 opacity: 0.55 压暗，这里已去掉。
 * uv-ui 表达「未激活」用的是颜色档位（$uv-light-color）而不是透明度 ——
 * 透明度会让图标和文字一起发灰，在 #f3f4f6 浅灰底上糊成一片。
 */

.dot {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: var(--hairline);
  font-size: 40rpx;
  transition: background 0.2s ease, border-color 0.2s ease;
}
/* 当前步：主色实底。uv-ui 的激活态一律是主色纯底，不是渐变、不放大 */
.step.active .dot {
  background: var(--pink-deep);
  border-color: var(--pink-deep);
}
/* 已完成：语义 success 色，和「当前」区分开 */
.step.done .dot {
  background: var(--success);
  border-color: var(--success);
}
.check {
  color: #fff;
  font-weight: 700;
  font-size: 34rpx;
}

.label {
  font-size: 22rpx;
  color: var(--text-4);
  margin-top: 12rpx;
}
.step.done .label {
  color: var(--text-2);
}
.step.active .label {
  color: var(--pink-deep);
}
</style>
