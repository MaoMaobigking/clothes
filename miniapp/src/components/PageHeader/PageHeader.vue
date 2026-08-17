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

/** tabBar 五页：只能 switchTab，navigateTo 到 tab 页在小程序上必定失败 */
const TAB_ROUTES = [
  '/pages/home/home',
  '/pages/ai/ai',
  '/pages/closet/closet',
  '/pages/mall/mall',
  '/pages/me/me',
]

/*
 * 返回。
 *
 * 原来非 tab 页一律走 uni.navigateTo(props.to) —— 那是「前进」不是「返回」：
 * 页面栈只涨不落，定制页 ⇄ 分类页来回点五轮就顶到微信的 10 层上限，
 * 之后所有 navigateTo 静默失败，表现是「返回键按不了」，而且是全站一起坏。
 *
 * 现在分三种情况：
 *   1. 目标是 tab 页        → switchTab
 *   2. 上一页正好是目标     → navigateBack 出栈（栈深 -1，且保留用户真实来路）
 *   3. 其余（深链直接进来） → redirectTo 替换当前页（栈深不变，不再堆积）
 */
function back() {
  if (!props.to) {
    uni.navigateBack()
    return
  }
  const base = props.to.split('?')[0]
  if (TAB_ROUTES.includes(base)) {
    uni.switchTab({ url: props.to })
    return
  }
  const stack = getCurrentPages()
  const prev = stack.length > 1 ? `/${stack[stack.length - 2].route}` : ''
  if (prev === base) {
    uni.navigateBack()
    return
  }
  uni.redirectTo({ url: props.to })
}
</script>

<template>
  <!--
    :fixed="false" —— 本项目的 .page 骨架把顶栏当流内元素排（外层 .ph-slot 的 flex-shrink:0），
    uv-navbar 默认的 fixed 定位会让它脱离流、盖住 .body 顶部。placeholder 同理关掉。

    :safe-area-inset-top="true"（uv-navbar 的默认值，这里写出来是为了显眼）
    —— ⚠️ 这修掉了一个既有缺陷：原来的 PageHeader 只有 `padding: 20rpx 32rpx`，
    没有任何状态栏留白，而这 23 个页面全是 navigationStyle: custom，
    .body 也不带 top inset，所以顶栏第一行像素本来是压在状态栏底下的。
    换成 uv-navbar 后它会渲染 uv-status-bar 占位，内容整体下移一个状态栏高度 —— 那是正确位置。

    bgColor 白 + border 发丝线：原来顶栏是透明的、浮在粉紫渐变上；
    现在页面底是 #f3f4f6 冷灰，白底顶栏 + 底部一条 0.5px 线才是 uv-ui 的标准形态。
  -->
  <view class="ph-slot">
    <uv-navbar
      :title="sub ? '' : title"
      :fixed="false"
      :placeholder="false"
      :safe-area-inset-top="true"
      :border="true"
      bg-color="#ffffff"
      left-icon=""
      @left-click="back"
    >
      <template #left>
        <!--
          用项目自己的 UiIcon 而不是 uv-navbar 默认的 uvicon arrow-left：
          全站图标统一走 UiIcon 的线条风格，混两套图标风格会很明显。
          所以上面把 left-icon 置空，关掉它内建的 uv-icon。

          原来这里是个 72rpx 白色圆形 + 投影的按钮 —— 那是为了在粉紫渐变底上有分离感。
          现在顶栏本身是白底，圆形白底看不出来，而且 uv-ui 的 navbar 左键就是个裸图标。
        -->
        <UiIcon name="chevron-left" :size="40" tone="dark" :stroke-width="2" />
      </template>

      <!-- 有副标题时才接管 center；没有的话让 uv-navbar 用自己的 title（带 uv-line-1 截断） -->
      <template v-if="sub" #center>
        <view class="mid">
          <view class="title">{{ title }}</view>
          <view class="sub">{{ sub }}</view>
        </view>
      </template>

      <template #right>
        <slot name="right" />
      </template>
    </uv-navbar>
  </view>
</template>

<style scoped>
.ph-slot {
  flex-shrink: 0;
}
.mid {
  flex: 1;
  text-align: center;
  overflow: hidden;
}
.title {
  font-size: 32rpx;
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sub {
  margin-top: 2rpx;
  font-size: 22rpx;
  color: var(--text-3);
}
</style>
