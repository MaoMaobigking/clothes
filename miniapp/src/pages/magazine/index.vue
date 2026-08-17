<script setup lang="ts">
/*
 * 旧版 mock 杂志页已下线（规格 §12.3 §12.4，批次 7）。
 *
 * 这个页面读的是 data/mock.ts 的 MAGAZINES —— 六本写死的假期刊，
 * 点开只有一句「敬请期待」。功能六合入后，杂志内容走服务端
 * community_contents，入口是「时尚社群」的杂志推送 tab，
 * 两套杂志数据并存只会让人分不清哪份是真的。
 *
 * 页面保留成一个跳转壳，是为了让历史链接、二维码、分享卡片仍能落到
 * 真正的杂志列表上，而不是撞一个不存在的路由。
 */
import { onLoad } from '@dcloudio/uni-app'

const TARGET = '/pages/community/index?tab=magazine'

onLoad(() => {
  // redirectTo 而不是 navigateTo：这个壳不该留在页面栈里，
  // 否则从社群按返回会回到一个空白中转页。
  uni.redirectTo({
    url: TARGET,
    fail: () => uni.reLaunch({ url: TARGET }),
  })
})
</script>

<template>
  <view class="page">
    <text class="hint">正在前往时尚杂志…</text>
  </view>
</template>

<style scoped>
.hint {
  font-size: 26rpx;
  color: var(--text-3);
}
</style>
