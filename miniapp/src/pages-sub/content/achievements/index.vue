<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchAchievements, type AchievementSummary } from '@/api/community'
import { useAsyncTask } from '@/composables/useAsyncTask'

const summary = ref<AchievementSummary>({
  points: 0,
  badges: [],
  completed: [],
})
const { loading, errorText, run } = useAsyncTask({ message: '成就加载失败' })
const totalTutorials = 4

onMounted(async () => {
  const data = await run(() => fetchAchievements())
  if (data) summary.value = data
})

function progressWidth() {
  return `${Math.min(100, Math.round((summary.value.completed.length / totalTutorials) * 100))}%`
}
</script>

<template>
  <view class="page">
    <PageHeader title="学习成就" to="/pages/me/me" />

    <view v-if="loading" class="state state-fill">正在读取成就...</view>
    <view v-else-if="errorText" class="state state-fill error">{{ errorText }}</view>

    <view v-else class="body scroll-y hide-scrollbar">
      <view class="points-card">
        <text class="points-label">我的学习积分</text>
        <text class="points-number">{{ summary.points }}</text>
        <text class="points-sub">完成教程即可累计</text>
      </view>

      <view class="progress-card">
        <view class="progress-head">
          <text>教程完成进度</text>
          <text>{{ summary.completed.length }}/{{ totalTutorials }}</text>
        </view>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: progressWidth() }" />
        </view>
      </view>

      <view class="section-title">已获徽章</view>
      <view v-if="!summary.badges.length" class="empty">完成教程后解锁第一枚徽章</view>
      <view v-else class="badge-grid">
        <view v-for="badge in summary.badges" :key="badge.key" class="badge">
          <text class="badge-emoji">{{ badge.badge }}</text>
          <view class="badge-title">{{ badge.title }}</view>
          <text class="badge-points">{{ badge.points ? `${badge.points} 分` : '里程碑' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  padding: 12rpx 32rpx 48rpx;
}

.points-card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 34rpx;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
}

.points-label {
  font-size: var(--fs-base);
  font-weight: 700;
  opacity: 0.88;
}

.points-number {
  font-size: 76rpx;
  font-weight: 700;
  line-height: 1;
}

.points-sub {
  font-size: var(--fs-sm);
  opacity: 0.82;
}

.progress-card {
  padding: 24rpx;
  margin-top: 22rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--text-1);
}

.progress-track {
  height: 14rpx;
  margin-top: 18rpx;
  overflow: hidden;
  background: #e8e2ef;
  border-radius: var(--radius-pill);
}

.progress-fill {
  height: 100%;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
}

.section-title {
  margin: 30rpx 0 18rpx;
}

.empty {
  padding: 24rpx;
  font-size: var(--fs-base);
  color: var(--text-3);
  background: var(--surface-soft);
  border-radius: var(--radius);
}

.badge-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}

.badge {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  align-items: center;
  padding: 28rpx 20rpx;
  text-align: center;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.badge-emoji {
  font-size: 64rpx;
}

.badge-title {
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--text-1);
}

.badge-points {
  font-size: var(--fs-xs);
  color: var(--text-3);
}
</style>
