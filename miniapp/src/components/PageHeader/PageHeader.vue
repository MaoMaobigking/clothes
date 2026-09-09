<script setup lang="ts">
import { ROUTES, isTabPath } from '@/constants/routes'

const props = withDefaults(
  defineProps<{
    title: string
    /** 返回目标路由；不传则 uni.navigateBack() */
    to?: string
    sub?: string
  }>(),
  { to: '', sub: '' },
)

/*
 * 返回。
 *
 * 一次踩过两个坑，所以逻辑是现在这个形状：
 *
 * 坑一（旧）：非 tab 页一律走 uni.navigateTo(props.to) —— 那是「前进」不是「返回」，
 *   页面栈只涨不落，定制页 ⇄ 分类页来回点五轮就顶到微信的 10 层上限，
 *   之后所有 navigateTo 静默失败，表现是「返回键按不了」，而且是全站一起坏。
 *
 * 坑二（本次）：上一版把 props.to 当成了「返回目标」，只要它是 tab 页就无条件 switchTab。
 *   可 props.to 写的是**典型**来路，不是**真实**来路：
 *   「我的 → 时尚社群」的社群页 to="/pages/home/home"，返回就跳去了首页而不是我的。
 *   全站 24 处 to= 里有 17 处指向 tab 页，这个错是普遍的。
 *
 * 所以现在以页面栈为准，props.to 退化成兜底：
 *   1. 栈里有上一页 → navigateBack 出栈。回用户真实来路，栈深 -1，两个坑都不沾。
 *   2. 栈底（分享/深链/扫码直接落在这一页，没有上一页可回）→ 用 props.to：
 *      tab 页只能 switchTab（navigateTo 到 tab 页在小程序上必定失败），
 *      其余 redirectTo 替换当前页（栈深不变，不堆积）。
 *
 * tabBar 五页的名单原先在本文件里又抄了一遍（全站第四份），
 * 现在统一由 constants/routes.ts 的 isTabPath 判定。
 */
function back() {
  // getCurrentPages() 至少含当前页；> 1 才说明真有上一页
  if (getCurrentPages().length > 1) {
    uni.navigateBack()
    return
  }
  const target = props.to || ROUTES.home
  if (isTabPath(target)) {
    uni.switchTab({ url: target })
    return
  }
  uni.redirectTo({ url: target })
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
  overflow: hidden;
  text-align: center;
}

.title {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--fs-2xl);
  font-weight: 500;
  color: var(--text-1);
  white-space: nowrap;
}

.sub {
  margin-top: 2rpx;
  font-size: var(--fs-sm);
  color: var(--text-3);
}
</style>
