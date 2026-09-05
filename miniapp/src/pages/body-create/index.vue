<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { STEPS } from '@/constants/questions'
import { MODEL_IMAGES } from '@/constants/ui'
import { useProfileStore } from '@/stores/profile'
import { iconForEmoji } from '@/utils/icons'

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
        <view v-for="(step, index) in STEPS" :key="step.key" class="guide-row">
          <view class="guide-index">{{ index + 1 }}</view>
          <view class="guide-meta">
            <text class="guide-label">{{ step.title }}</text>
            <UiIcon class="guide-emoji" :name="iconForEmoji(step.emoji) ?? 'check'" :size="40" tone="purple" />
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
.body {
  padding: 12rpx 32rpx calc(32rpx + env(safe-area-inset-bottom, 0px));
}

.hero {
  position: relative;
  display: flex;
  align-items: flex-end;
  min-height: 520rpx;
  overflow: hidden;
  background: linear-gradient(155deg, rgb(255 230 242 / 95%), rgb(239 226 255 / 92%));
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.hero-model {
  width: 44%;
  margin-left: 20rpx;
}

.hero-copy {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 0 26rpx 34rpx 8rpx;
}

.eyebrow {
  margin-bottom: 12rpx;
  font-size: 20rpx;
  font-weight: 500;
  color: var(--pink-deep);
  letter-spacing: 1px;
}

.title {
  font-size: 46rpx;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text-1);
}

.subtitle {
  margin-top: 16rpx;
  font-size: 24rpx;
  line-height: 1.5;
  color: var(--text-2);
}

.guide-card {
  padding: 30rpx 28rpx;
  margin-top: 28rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.guide-title {
  margin-bottom: 24rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-1);
}

.guide-row {
  display: flex;
  gap: 18rpx;
  align-items: center;
  min-height: 78rpx;
  border-bottom: 1rpx solid var(--line);
}

.guide-row:last-child {
  border-bottom: 0;
}

.guide-index {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 52rpx;
  height: 52rpx;
  font-size: 26rpx;
  font-weight: 500;
  color: var(--purple-deep);
  background: var(--pink-soft);
  border-radius: var(--radius);
}

.guide-meta {
  display: flex;
  flex: 1;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
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
  flex-shrink: 0;
  padding: 6rpx 16rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: var(--pink-deep);
  background: rgb(255 92 157 / 10%);
  border-radius: var(--radius-pill);
}

.guide-tag.optional {
  color: var(--text-3);
  background: var(--surface-tint);
}

.foot {
  margin-top: 28rpx;
}

.start {
  width: 100%;
}
</style>
