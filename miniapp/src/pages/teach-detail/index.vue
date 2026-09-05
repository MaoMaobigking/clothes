<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { completeCommunityTutorial, fetchCommunityContent, type CommunityContent } from '@/api/community'
import { isAuthError } from '@/api/http'

const contentId = ref('')
const content = ref<CommunityContent | null>(null)
const loading = ref(true)
const errorText = ref('')
const activeStep = ref(0)
const finishing = ref(false)
let videoContext: any = null

onLoad((options) => {
  contentId.value = String(options?.id || '')
})

onMounted(async () => {
  if (contentId.value) await loadTutorial()
  else {
    loading.value = false
    errorText.value = '缺少教程 ID'
  }
  videoContext = uni.createVideoContext('tutorial-video')
})

async function loadTutorial() {
  loading.value = true
  errorText.value = ''
  try {
    content.value = await fetchCommunityContent(contentId.value)
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复报错（规格 §5）
    if (!isAuthError(error)) {
      errorText.value = error instanceof Error ? error.message : '教程加载失败'
    }
  } finally {
    loading.value = false
  }
}

function selectStep(index: number) {
  activeStep.value = index
  videoContext?.pause()
}

async function finishTutorial() {
  if (!content.value || finishing.value) return
  finishing.value = true
  try {
    const result = await completeCommunityTutorial(content.value.id)
    content.value = result.content
    uni.showToast({
      title: result.alreadyCompleted ? '已完成过本教程' : `完成，积分 ${result.points}`,
      icon: 'none',
    })
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      uni.showToast({
        title: error instanceof Error ? error.message : '完成失败',
        icon: 'none',
      })
    }
  } finally {
    finishing.value = false
  }
}
</script>

<template>
  <view class="page">
    <PageHeader title="穿搭教程" to="/pages/community/index?tab=tutorial" />

    <view v-if="loading" class="state">正在加载教程...</view>
    <view v-else-if="errorText || !content" class="state error">{{ errorText }}</view>

    <view v-else class="body scroll-y hide-scrollbar">
      <view class="player">
        <video
          id="tutorial-video"
          class="video"
          :src="content.body.videoUrl"
          :poster="content.body.posterUrl"
          controls
          object-fit="contain"
          show-center-play-btn
        />
        <view v-if="!content.body.videoUrl" class="video-note">真实视频素材待人工放入</view>
      </view>

      <view class="header">
        <text class="category">{{ content.category }}</text>
        <text v-if="content.body.verified" class="verified">认证博主 · 独家教程</text>
        <view class="title">{{ content.title }}</view>
        <view class="subtitle">{{ content.subtitle }}</view>
      </view>

      <view class="steps">
        <view
          v-for="(step, index) in content.body.steps"
          :key="`${step.title}-${index}`"
          class="step"
          :class="{ on: activeStep === index }"
          @tap="selectStep(index)"
        >
          <view class="step-index">{{ index + 1 }}</view>
          <view class="step-text">
            <view class="step-title">{{ step.title }}</view>
            <view v-if="activeStep === index" class="step-desc">{{ step.text }}</view>
          </view>
        </view>
      </view>

      <view class="finish-panel">
        <view>
          <view class="finish-title">
            {{ content.completed ? '本教程已完成' : '按步骤跟练后完成打卡' }}
          </view>
          <view class="finish-sub">完成后获得 10 积分</view>
        </view>
        <view class="finish-button" :class="{ done: content.completed }" @tap="finishTutorial">
          {{ content.completed ? '已完成' : '完成学习' }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx 48rpx;
}

.state {
  flex: 1;
  padding: 80rpx 24rpx;
  font-size: 26rpx;
  color: var(--text-2);
  text-align: center;
}

.state.error {
  color: var(--danger);
}

.player {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  overflow: hidden;

  /* 播放器底色。原来是 #2f2a3d（旧调色板的紫调黑），换成 uv-ui 的 $uv-main-color */
  background: var(--text-1);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
}

.video {
  width: 100%;
  height: 100%;
}

.video-note {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 700;
  color: rgb(255 255 255 / 82%);
  pointer-events: none;
}

.header {
  margin-top: 28rpx;
}

.category {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--purple-deep);
}

.verified {
  display: inline-block;
  margin-left: 10rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: var(--mint-deep);
}

.title {
  margin-top: 12rpx;
  font-size: 40rpx;
  font-weight: 700;
  line-height: 1.35;
  color: var(--text-1);
}

.subtitle {
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.55;
  color: var(--text-2);
}

.steps {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-top: 28rpx;
}

.step {
  display: flex;
  gap: 20rpx;
  align-items: flex-start;
  padding: 22rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.step.on {
  border: 2rpx solid var(--pink);
}

.step-index {
  display: flex;
  flex: 0 0 54rpx;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 54rpx;
  font-size: 25rpx;
  font-weight: 500;
  color: var(--text-2);
  background: var(--surface-soft);
  border-radius: 50%;
}

.step.on .step-index {
  color: #fff;
  background: var(--brand-gradient);
}

.step-text {
  flex: 1;
  min-width: 0;
}

.step-title {
  font-size: 27rpx;
  font-weight: 500;
  color: var(--text-1);
}

.step-desc {
  margin-top: 10rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: var(--text-2);
}

.finish-panel {
  display: flex;
  gap: 20rpx;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx;
  margin-top: 28rpx;
  background: rgb(255 255 255 / 72%);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.finish-title {
  font-size: 27rpx;
  font-weight: 500;
  color: var(--text-1);
}

.finish-sub {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-3);
}

.finish-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 74rpx;
  padding: 0 26rpx;
  font-size: 25rpx;
  font-weight: 700;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
}

.finish-button.done {
  background: var(--mint);
}
</style>
