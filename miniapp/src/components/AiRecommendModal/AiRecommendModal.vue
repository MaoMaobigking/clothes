<script setup lang="ts">
import { ref, watch } from 'vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  (e: 'view'): void
  (e: 'close'): void
}>()

/*
 * uv-popup 是**命令式**的：没有 show / v-model 这类 prop，只能拿 ref 调 open() / close()
 * （uView 系一贯如此）。本组件对外仍然是 `visible` 这个声明式 prop —— 6 处调用点不用改，
 * 桥接放在这里。
 */
const popup = ref<{ open: () => void; close: () => void } | null>(null)

watch(
  () => props.visible,
  (v) => {
    if (v) popup.value?.open()
    else popup.value?.close()
  },
  { immediate: true },
)

/*
 * uv-popup 自己关闭时（点遮罩）会发 change {show:false}，
 * 要把状态回传给父组件，否则父组件的 visible 还是 true，下次就打不开了。
 * 只在「关」的时候发，别在「开」的时候也发一遍。
 */
function onChange(e: { show: boolean }) {
  if (!e.show && props.visible) emit('close')
}
</script>

<template>
  <uv-popup ref="popup" mode="center" :round="8" :safe-area-inset-bottom="false" @change="onChange">
    <view class="ai-modal">
      <!--
        原来这个图标球是 `margin-top: -112rpx` 挂在弹窗上沿外面的。
        uv-popup 的圆角容器会裁掉溢出内容，挂出去就没了 —— 改成正常排在内部。
        同时去掉了 --brand-gradient 的圆形底和投影：uv-ui 里没有这种发光球，
        换成极浅主色底 + 主色图标，是它标准的「强调图标」形态。
      -->
      <view class="spark">
        <UiIcon name="sparkle" :size="56" tone="brand" />
      </view>
      <view class="title">智能推荐已生成</view>
      <view class="desc">AI 已根据你的风格、肤色、脸型、体型和偏好，生成了专属风格报告</view>
      <view class="btn btn-primary view" @tap="emit('view')">查看我的专属风格报告</view>
      <view class="btn-text" @tap="emit('close')">再改改</view>
    </view>
  </uv-popup>
</template>

<style scoped>
.ai-modal {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 600rpx;
  padding: 48rpx 40rpx 32rpx;
  text-align: center;
}

.spark {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 112rpx;
  height: 112rpx;
  background: var(--pink-soft);
  border-radius: 50%;
}

.title {
  margin-top: 24rpx;
  font-size: var(--fs-3xl);
  font-weight: 500;
  color: var(--text-1);
}

.desc {
  margin-top: 12rpx;
  font-size: var(--fs-md);
  line-height: 1.6;
  color: var(--text-2);
}

/*
 * .btn / .btn-primary 走 components.css 的全局类，这里只写「这一处独有」的宽度和间距。
 * 原来这个文件把整套 .btn 规则复制了一份（还带着 rgba(177,140,255,0.4) 的紫光晕），
 * 复制出来的那份优先级更高，全局改了它也不跟着变 —— 已删掉。
 */
.view {
  width: 100%;
  margin-top: 40rpx;
}

.btn-text {
  padding: 16rpx 32rpx;
  margin-top: 16rpx;
  font-size: var(--fs-lg);
  color: var(--text-3);
}
</style>
