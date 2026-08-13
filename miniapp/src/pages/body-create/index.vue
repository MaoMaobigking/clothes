<script setup lang="ts">
import { computed, onMounted } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { STEPS } from '@/data/questions'
import { MODEL_IMAGES } from '@/data/mock'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()

const started = computed(
  () => store.profile.styles.length > 0 || store.profile.visualBody !== '' || store.answeredPreferences > 0,
)

const nextStep = computed(() => {
  if (store.profile.styles.length < 3) return 1
  if (!store.bodyReady) return 4
  if (store.answeredPreferences < 3) return 5
  return 5
})

onMounted(() => store.loadPersisted())

function start() {
  if (store.isComplete) {
    uni.navigateTo({ url: '/pages/result/index' })
    return
  }
  uni.navigateTo({ url: `/pages/test/index?step=${nextStep.value}` })
}
</script>

<template>
  <view class="page">
    <PageHeader title="个人身形创建" to="/pages/home/home" />

    <scroll-view scroll-y class="body">
      <view class="hero">
        <TileImage
          :src="MODEL_IMAGES.front"
          from="#ffe3ef"
          to="#e7d4ff"
          emoji="🧍‍♀️"
          ratio="3 / 4"
          fit="contain"
          class="hero-model"
        />
        <view class="hero-copy">
          <text class="eyebrow">AI BODY PROFILE</text>
          <text class="title">开始你的专属穿搭之旅</text>
          <text class="subtitle">5 个步骤生成个人画像、风格报告与虚拟形象</text>
        </view>
      </view>

      <view class="guide-card">
        <view class="guide-title">测试包含</view>
        <view
          v-for="(step, index) in STEPS"
          :key="step.key"
          class="guide-row"
        >
          <view class="guide-index">{{ index + 1 }}</view>
          <view class="guide-meta">
            <text class="guide-label">{{ step.title }}</text>
            <text class="guide-emoji">{{ step.emoji }}</text>
          </view>
          <text v-if="index === 0 || index === 3" class="guide-tag">必答</text>
          <text v-else class="guide-tag optional">可跳过</text>
        </view>
      </view>

      <view class="foot">
        <button class="btn btn-primary start" @tap="start">
          {{ store.isComplete ? '查看风格报告' : started ? '继续完成' : '开始测试' }}
        </button>
      </view>
    </scroll-view>
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
  padding: 12rpx 32rpx calc(32rpx + env(safe-area-inset-bottom, 0px));
}

.hero {
  position: relative;
  min-height: 520rpx;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: linear-gradient(155deg, rgba(255, 230, 242, 0.95), rgba(239, 226, 255, 0.92));
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: flex-end;
}
.hero-model {
  width: 44%;
  margin-left: 20rpx;
}
.hero-copy {
  flex: 1;
  padding: 0 26rpx 34rpx 8rpx;
  display: flex;
  flex-direction: column;
}
.eyebrow {
  font-size: 20rpx;
  letter-spacing: 1px;
  color: var(--pink-deep);
  font-weight: 800;
  margin-bottom: 12rpx;
}
.title {
  font-size: 46rpx;
  line-height: 1.2;
  font-weight: 900;
  color: var(--text-1);
}
.subtitle {
  margin-top: 16rpx;
  font-size: 24rpx;
  color: var(--text-2);
  line-height: 1.5;
}

.guide-card {
  margin-top: 28rpx;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 30rpx 28rpx;
  box-shadow: var(--shadow-card);
}
.guide-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-1);
  margin-bottom: 24rpx;
}
.guide-row {
  display: flex;
  align-items: center;
  gap: 18rpx;
  min-height: 78rpx;
  border-bottom: 1rpx solid var(--line);
}
.guide-row:last-child {
  border-bottom: 0;
}
.guide-index {
  width: 52rpx;
  height: 52rpx;
  border-radius: 18rpx;
  background: rgba(177, 140, 255, 0.15);
  color: var(--purple-deep);
  font-size: 26rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.guide-meta {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.guide-label {
  font-size: 27rpx;
  font-weight: 700;
  color: var(--text-1);
}
.guide-emoji {
  font-size: 30rpx;
}
.guide-tag {
  font-size: 20rpx;
  font-weight: 700;
  color: var(--pink-deep);
  background: rgba(255, 92, 157, 0.1);
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  flex-shrink: 0;
}
.guide-tag.optional {
  color: var(--text-3);
  background: #f0edf6;
}

.foot {
  margin-top: 28rpx;
}
.start {
  width: 100%;
}
</style>
