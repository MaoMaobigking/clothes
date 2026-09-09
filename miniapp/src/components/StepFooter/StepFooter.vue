<script setup lang="ts">
withDefaults(
  defineProps<{
    current: number
    total: number
    canNext: boolean
    nextLabel?: string
    skipLabel?: string
    showPrev?: boolean
    showSkip?: boolean
  }>(),
  {
    nextLabel: '下一步',
    skipLabel: '跳过',
    showPrev: true,
    showSkip: true,
  },
)

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'skip'): void
}>()
</script>

<template>
  <view class="footer">
    <!-- 圆点进度 -->
    <view class="dots">
      <view v-for="n in total" :key="n" class="dot" :class="{ on: n === current, passed: n < current }" />
    </view>

    <view class="actions">
      <view v-if="showPrev && current > 1" class="btn btn-ghost prev" @tap="emit('prev')">上一步</view>

      <view class="btn btn-primary next" :class="{ 'btn-disabled': !canNext }" @tap="canNext && emit('next')">
        {{ nextLabel }}
      </view>

      <view v-if="showSkip" class="skip" @tap="emit('skip')">
        {{ skipLabel }}
      </view>
    </view>
  </view>
</template>

<style scoped>
/*
 * ⚠️ 这里原来把整套 .btn / .btn-primary / .btn-ghost / .btn-disabled 复制了一份。
 * scoped 样式编译成 .btn[data-v-xxx]，优先级高于 components.css 里的全局定义 ——
 * 结果是全局改了按钮，这个组件不跟着变（那份复制里还留着
 * box-shadow: 0 16rpx 40rpx rgba(177,140,255,0.4) 的紫光晕）。
 * 已全部删除，改用全局类。本文件只保留「这一处独有」的排版差异。
 */
.footer {
  flex-shrink: 0;
  padding: 24rpx var(--page-x) calc(24rpx + env(safe-area-inset-bottom, 0px));

  /*
   * 原来是一层白色渐变蒙版，用来把内容和吸底栏区分开。
   * uv-ui 用的是发丝线，不是渐变蒙版 —— 换成实心白底 + 顶部一条线。
   */
  background: var(--surface);
  border-top: var(--hairline);
}

.dots {
  display: flex;
  justify-content: center;
  margin-bottom: 24rpx;
}

.dots .dot {
  width: 12rpx;
  height: 12rpx;
  margin: 0 6rpx;
  background: var(--line);
  border-radius: var(--radius-pill);
  transition: all 0.25s ease;
}

/* 当前步拉长成胶囊，是这个组件里唯一的主色元素 */
.dots .dot.on {
  width: 40rpx;
  background: var(--pink-deep);
}

/* 已走过的步骤：比未到达的深一档，但不用主色 —— 免得一排全是粉点分不出当前在哪 */
.dots .dot.passed {
  background: var(--text-4);
}

.actions {
  display: flex;
  align-items: center;
}

.prev {
  flex-shrink: 0;
  margin-right: 20rpx;
}

.next {
  flex: 1;
}

.skip {
  flex-shrink: 0;
  padding: 16rpx 20rpx;
  margin-left: 20rpx;
  font-size: var(--fs-md);
  color: var(--text-3);
}
</style>
