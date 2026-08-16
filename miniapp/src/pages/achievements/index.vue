<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import {
  fetchAchievements,
  type AchievementSummary,
} from '@/api/community'
import { isAuthError } from '@/api/http'

const summary = ref<AchievementSummary>({
  points: 0,
  badges: [],
  completed: [],
})
const loading = ref(true)
const errorText = ref('')
const totalTutorials = 4

onMounted(async () => {
  try {
    summary.value = await fetchAchievements()
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复报错（规格 §5）
    if (!isAuthError(error)) {
      errorText.value = error instanceof Error ? error.message : '成就加载失败'
    }
  } finally {
    loading.value = false
  }
})

function progressWidth() {
  return `${Math.min(100, Math.round((summary.value.completed.length / totalTutorials) * 100))}%`
}
</script>

<template>
  <view class="page">
    <PageHeader title="学习成就" to="/pages/me/me" />

    <view v-if="loading" class="state">正在读取成就...</view>
    <view v-else-if="errorText" class="state error">{{ errorText }}</view>

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
.points-card {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 34rpx;
  border-radius: 12px;
  background: var(--brand-gradient);
  color: #fff;
  box-shadow: var(--shadow-float);
}
.points-label {
  font-size: 24rpx;
  font-weight: 700;
  opacity: 0.88;
}
.points-number {
  font-size: 76rpx;
  line-height: 1;
  font-weight: 900;
}
.points-sub {
  font-size: 22rpx;
  opacity: 0.82;
}
.progress-card {
  margin-top: 22rpx;
  padding: 24rpx;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.progress-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 25rpx;
  font-weight: 800;
  color: var(--text-1);
}
.progress-track {
  height: 14rpx;
  margin-top: 18rpx;
  border-radius: var(--radius-pill);
  background: #e8e2ef;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
}
.section-title {
  margin: 30rpx 0 18rpx;
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-1);
}
.empty {
  padding: 24rpx;
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--text-3);
  font-size: 24rpx;
  text-align: center;
}
.badge-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20rpx;
}
.badge {
  padding: 28rpx 20rpx;
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  text-align: center;
}
.badge-emoji {
  font-size: 64rpx;
}
.badge-title {
  font-size: 25rpx;
  font-weight: 800;
  color: var(--text-1);
}
.badge-points {
  font-size: 20rpx;
  color: var(--text-3);
}
</style>
