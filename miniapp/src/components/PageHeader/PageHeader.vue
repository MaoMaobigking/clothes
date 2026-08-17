<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    title: string
    /** 返回目标路由；不传则 uni.navigateBack() */
    to?: string
    sub?: string
  }>(),
  { to: '', sub: '' },
)

function back() {
  if (props.to) {
    // 判断是否是 tab 页，是则 switchTab
    const tabRoutes = ['/pages/home/home', '/pages/ai/ai', '/pages/closet/closet', '/pages/mall/mall', '/pages/me/me']
    if (tabRoutes.includes(props.to)) {
      uni.switchTab({ url: props.to })
    } else {
      uni.navigateTo({ url: props.to })
    }
  } else {
    uni.navigateBack()
  }
}
</script>

<template>
  <view class="ph">
    <view class="back" aria-label="返回" @tap="back">
      <UiIcon name="chevron-left" :size="40" tone="dark" :stroke-width="2" />
    </view>
    <view class="mid">
      <view class="title">{{ title }}</view>
      <view v-if="sub" class="sub">{{ sub }}</view>
    </view>
    <view class="right">
      <slot name="right" />
    </view>
  </view>
</template>

<style scoped>
.ph {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  padding: 20rpx 32rpx;
}
.back {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}
.mid {
  flex: 1;
  text-align: center;
  overflow: hidden;
}
.title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  margin-top: 4rpx;
  font-size: 24rpx;
  color: var(--text-2);
}
.right {
  min-width: 72rpx;
  display: flex;
  justify-content: flex-end;
}
</style>
