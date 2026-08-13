<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import {
  completeCommunityTutorial,
  fetchCommunityContent,
  type CommunityContent,
} from '@/api/community'

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
    errorText.value = error instanceof Error ? error.message : '教程加载失败'
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
    uni.showToast({
      title: error instanceof Error ? error.message : '完成失败',
      icon: 'none',
    })
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
        <view v-if="!content.body.videoUrl" class="video-note">
          真实视频素材待人工放入
        </view>
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
        <view
          class="finish-button"
          :class="{ done: content.completed }"
          @tap="finishTutorial"
        >
          {{ content.completed ? '已完成' : '完成学习' }}
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx 48rpx;
}
.state {
  flex: 1;
  padding: 80rpx 24rpx;
  text-align: center;
  color: var(--text-2);
  font-size: 26rpx;
}
.state.error {
  color: #d45a78;
}
.player {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 12px;
  overflow: hidden;
  background: #2f2a3d;
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
  color: rgba(255, 255, 255, 0.82);
  font-size: 24rpx;
  font-weight: 700;
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
  line-height: 1.35;
  font-weight: 900;
  color: var(--text-1);
}
.subtitle {
  margin-top: 10rpx;
  font-size: 25rpx;
  line-height: 1.55;
  color: var(--text-2);
}
.steps {
  margin-top: 28rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.step {
  display: flex;
  align-items: flex-start;
  gap: 20rpx;
  padding: 22rpx;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.step.on {
  border: 2rpx solid var(--pink);
}
.step-index {
  flex: 0 0 54rpx;
  width: 54rpx;
  height: 54rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 25rpx;
  font-weight: 800;
}
.step.on .step-index {
  background: var(--brand-gradient);
  color: #fff;
}
.step-text {
  flex: 1;
  min-width: 0;
}
.step-title {
  font-size: 27rpx;
  font-weight: 800;
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
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin-top: 28rpx;
  padding: 24rpx;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--shadow-card);
}
.finish-title {
  font-size: 27rpx;
  font-weight: 800;
  color: var(--text-1);
}
.finish-sub {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-3);
}
.finish-button {
  flex-shrink: 0;
  height: 74rpx;
  padding: 0 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 25rpx;
  font-weight: 700;
}
.finish-button.done {
  background: var(--mint);
}
</style>
