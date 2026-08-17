<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  title: string
  /** 当前步（1 起） */
  current: number
  /** 总步数 */
  total: number
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()

/* total 传 0 时不能除，否则是 NaN，进度条会整条消失 */
const percent = computed(() => (props.total > 0 ? (props.current / props.total) * 100 : 0))

/* 必须是字面色值：uv-line-progress 把它们拼进 inline style，CSS 变量传不进去 */
const ACTIVE_COLOR = '#ff5c9d'
const TRACK_COLOR = '#ececec'
</script>

<template>
  <view class="app-header">
    <!--
      和 PageHeader 一样：:fixed="false" 保持流内，:safe-area-inset-top 补状态栏
      （原来这里同样没有状态栏留白，是同一个既有缺陷）。
      :border="false" —— 下面紧跟着进度条，再来一条发丝线就是两条横线叠着。
    -->
    <uv-navbar
      :title="title"
      :fixed="false"
      :placeholder="false"
      :safe-area-inset-top="true"
      :border="false"
      bg-color="#ffffff"
      left-icon=""
      @left-click="emit('back')"
    >
      <template #left>
        <UiIcon name="chevron-left" :size="40" tone="dark" :stroke-width="2" />
      </template>
      <template #right>
        <!--
          步数计数。
          原来这里是 `position: absolute; right: 32rpx`，但它的父级 .bar 没有
          position: relative —— 等于按最近的定位祖先（往往是页面）定位，是个隐蔽的错位 bug。
          放进 uv-navbar 的 #right 插槽后由 flex 排版，不再需要绝对定位。
        -->
        <text class="counter">{{ current }}/{{ total }}</text>
      </template>
    </uv-navbar>

    <view class="progress-wrap">
      <uv-line-progress
        :percentage="percent"
        :show-text="false"
        :height="6"
        :active-color="ACTIVE_COLOR"
        :inactive-color="TRACK_COLOR"
      />
    </view>
  </view>
</template>

<style scoped>
.app-header {
  flex-shrink: 0;
  background: var(--surface);
}
.progress-wrap {
  /* 左右和 uv-navbar 的内容区对齐（它内部是 0 15px = 0 30rpx） */
  padding: 0 30rpx 20rpx;
}
.counter {
  font-size: 24rpx;
  color: var(--text-3);
}
</style>
