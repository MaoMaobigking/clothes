<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    subtitle?: string
    /**
     * 内容只有一横排卡片时（风格 / 肤色 / 脸型三步改横滑之后）打开：
     * 让内容块撑满滚动区并垂直居中，否则卡片挤在顶部、下面空一大片。
     */
    center?: boolean
  }>(),
  { subtitle: '', center: false },
)
</script>

<template>
  <view class="step-shell">
    <view class="head">
      <view class="title">{{ title }}</view>
      <view v-if="subtitle" class="subtitle">{{ subtitle }}</view>
    </view>
    <!--
      center 模式直接用普通 view，不套 scroll-view。
      原因：uni 的 scroll-view 在 H5 端会多包一层高度 auto 的 .uni-scroll-view-content，
      里面写 min-height:100% 会按 auto 的父级解析成 0，居中根本不生效。
      走这条分支的三步内容只有一横排卡片，本来也不需要竖向滚动。
    -->
    <view v-if="center" class="content center-box">
      <slot />
    </view>
    <scroll-view v-else scroll-y class="content" :show-scrollbar="false">
      <view class="content-inner">
        <slot />
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.step-shell {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
  padding: 8rpx var(--page-x) 0;
}

.head {
  flex-shrink: 0;
  margin-bottom: 32rpx;
}

/*
 * 步骤页大标题。44rpx/800 → 40rpx/500。
 * uv-ui 没有 800 这一档字重（它整套只用默认 400 和 bold），
 * 800 在冷灰 #303133 上会显得很硬。
 */
.title {
  font-size: 40rpx;
  font-weight: 500;
  line-height: 1.3;
  color: var(--text-1);
}

.subtitle {
  margin-top: 12rpx;
  font-size: var(--fs-md);
  color: var(--text-3);
}

.content {
  flex: 1;
  width: 100%;
  min-height: 0;
}

.content-inner {
  padding-bottom: 40rpx;
}

.center-box {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-bottom: 40rpx;
}
</style>
