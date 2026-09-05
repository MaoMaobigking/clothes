<script setup lang="ts">
import { ref, watch } from 'vue'
import type { StepMeta } from '@/types'

const props = defineProps<{
  steps: StepMeta[]
  /** 当前步（1 起） */
  current: number
}>()

const emit = defineEmits<{
  (e: 'select', step: number): void
}>()

/*
 * 轮播式步骤引导（客户需求原文「步骤引导区（轮播式）」）。
 *
 * 一屏显示 3 步，当前步尽量居中：左端两步和右端两步没法居中，
 * 所以 leftmost = clamp(current - 2, 0, steps - 3)。
 *
 * viewIndex 是**本地**的，不是直接绑 props.current 算出来的值 ——
 * 用户手动滑动引导区时 swiper 会自己改 current，若直接绑计算值，
 * Vue 下一次渲染就把它拽回去，手感像滑不动。所以本地存一份，
 * props.current 变化（真的进了下一步）时才同步过去。
 */
const PER_VIEW = 3

function centered(step: number) {
  const max = Math.max(0, props.steps.length - PER_VIEW)
  return Math.min(Math.max(step - 2, 0), max)
}

const viewIndex = ref(centered(props.current))

watch(
  () => props.current,
  (step) => {
    viewIndex.value = centered(step)
  },
)

function onSwiperChange(e: { detail: { current: number } }) {
  viewIndex.value = e.detail.current
}
</script>

<template>
  <swiper
    class="steps"
    :current="viewIndex"
    :display-multiple-items="PER_VIEW"
    :circular="false"
    :duration="240"
    @change="onSwiperChange"
  >
    <swiper-item v-for="(s, i) in steps" :key="s.key">
      <view
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
    </swiper-item>
  </swiper>
</template>

<style scoped>
/*
 * 这个组件**保留自绘，没换成 uv-steps** —— uv-steps-item 没有点击事件，
 * 换过去会丢掉「点某一步跳转」的功能（pages/test/index.vue 用了 @select）。
 *
 * 2026-08-18 从 scroll-view 换成 swiper（客户要「轮播式」）。
 * swiper 必须有显式高度，height:auto 在小程序端会塌成 0。
 */
.steps {
  height: 156rpx;
  padding: 8rpx var(--page-x) 16rpx;
  flex-shrink: 0;
  box-sizing: content-box;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
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
