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
      <view
        v-for="n in total"
        :key="n"
        class="dot"
        :class="{ on: n === current, passed: n < current }"
      />
    </view>

    <view class="actions">
      <view
        v-if="showPrev && current > 1"
        class="btn btn-ghost prev"
        @tap="emit('prev')"
      >
        上一步
      </view>

      <view
        class="btn btn-primary next"
        :class="{ 'btn-disabled': !canNext }"
        @tap="canNext && emit('next')"
      >
        {{ nextLabel }}
      </view>

      <view v-if="showSkip" class="skip" @tap="emit('skip')">
        {{ skipLabel }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.footer {
  flex-shrink: 0;
  padding: 24rpx 32rpx calc(24rpx + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 40%);
}

.dots {
  display: flex;
  justify-content: center;
  margin-bottom: 24rpx;
}
.dots .dot {
  width: 12rpx;
  height: 12rpx;
  border-radius: 999px;
  background: rgba(154, 107, 255, 0.28);
  margin: 0 6rpx;
  transition: all 0.25s ease;
}
.dots .dot.on {
  width: 40rpx;
  background: var(--purple-deep);
}
.dots .dot.passed {
  background: var(--mint-deep);
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
  margin-left: 20rpx;
  font-size: 26rpx;
  color: var(--text-3);
  padding: 16rpx 20rpx;
}

.btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 96rpx;
  padding: 0 48rpx;
  border-radius: var(--radius-pill);
  font-size: 32rpx;
  font-weight: 600;
}
.btn-primary {
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  box-shadow: 0 16rpx 40rpx rgba(177, 140, 255, 0.4);
}
.btn-ghost {
  background: var(--surface);
  color: var(--text-2);
  box-shadow: var(--shadow-card);
}
.btn-disabled {
  background: #e6e0ef;
  color: #b7b0c6;
  box-shadow: none;
}
</style>
