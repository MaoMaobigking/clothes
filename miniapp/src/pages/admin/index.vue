<script setup lang="ts">
import { ref } from 'vue'
import {
  fetchAdminDashboard,
  type AdminDashboard,
} from '@/api/community'
import { isAuthError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const password = ref('')
const logging = ref(false)
const errorText = ref('')
const dashboard = ref<AdminDashboard | null>(null)

/**
 * 管理员密码闸（规格 §5.3）。
 * 验过之后当前身份就切成管理员账号了，所以走 auth store 而不是自己写 token，
 * 否则「我的」页还显示着上一个人的昵称，实际请求已经是管理员在发。
 */
async function login() {
  if (!password.value || logging.value) return
  logging.value = true
  errorText.value = ''
  try {
    await auth.signInAsAdmin(password.value)
    dashboard.value = await fetchAdminDashboard()
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '管理员登录失败'
  } finally {
    logging.value = false
  }
}

async function refresh() {
  try {
    dashboard.value = await fetchAdminDashboard()
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复报错（规格 §5）
    if (!isAuthError(error)) {
      errorText.value = error instanceof Error ? error.message : '数据刷新失败'
    }
  }
}

/** 退出管理员：身份已经是管理员账号，只能整体登出回登录页，不能悄悄退回原来那个人 */
function logout() {
  dashboard.value = null
  password.value = ''
  auth.logout()
}
</script>

<template>
  <view class="page">
    <PageHeader title="管理员看板" to="/pages/me/me" />

    <view class="body scroll-y hide-scrollbar">
      <template v-if="!dashboard">
        <view class="login-panel">
          <UiIcon class="login-emoji" name="lock" :size="88" tone="purple" :stroke-width="1.4" />
          <view class="login-title">轻量管理员入口</view>
          <view class="login-sub">统计数据来自当前数据库真实记录</view>
          <input
            v-model="password"
            class="password-input"
            password
            maxlength="64"
            placeholder="请输入管理员密码"
          />
          <text v-if="errorText" class="error">{{ errorText }}</text>
          <view class="login-button" @tap="login">
            {{ logging ? '验证中...' : '进入看板' }}
          </view>
        </view>
      </template>

      <template v-else>
        <view class="toolbar">
          <view class="toolbar-title">实时统计</view>
          <view class="toolbar-actions">
            <view class="tool-button" @tap="refresh">刷新</view>
            <view class="tool-button" @tap="logout">退出</view>
          </view>
        </view>

        <view class="stats-grid">
          <view class="stat">
            <text class="stat-number">{{ dashboard.stats.userCount }}</text>
            <text class="stat-label">用户数</text>
          </view>
          <view class="stat">
            <text class="stat-number">{{ dashboard.stats.contentCount }}</text>
            <text class="stat-label">内容数</text>
          </view>
          <view class="stat">
            <text class="stat-number">{{ dashboard.stats.likeCount }}</text>
            <text class="stat-label">点赞数</text>
          </view>
          <view class="stat">
            <text class="stat-number">{{ dashboard.stats.commentCount }}</text>
            <text class="stat-label">评论数</text>
          </view>
          <view class="stat">
            <text class="stat-number">{{ dashboard.stats.favoriteCount }}</text>
            <text class="stat-label">收藏数</text>
          </view>
          <view class="stat">
            <text class="stat-number">{{ dashboard.stats.tutorialCompletionCount }}</text>
            <text class="stat-label">教程完成</text>
          </view>
        </view>

        <view class="breakdown">
          <view class="section-title">内容构成</view>
          <view class="row">
            <text>杂志</text><text>{{ dashboard.stats.magazineCount }}</text>
          </view>
          <view class="row">
            <text>教程</text><text>{{ dashboard.stats.tutorialCount }}</text>
          </view>
          <view class="row">
            <text>用户分享</text><text>{{ dashboard.stats.shareCount }}</text>
          </view>
          <view class="row">
            <text>话题挑战</text><text>{{ dashboard.stats.challengeCount }}</text>
          </view>
          <view class="row">
            <text>举报</text><text>{{ dashboard.stats.reportCount }}</text>
          </view>
        </view>

        <view class="topics">
          <view class="section-title">热门话题</view>
          <view v-if="!dashboard.hotTopics.length" class="empty">暂无话题数据</view>
          <view v-for="topic in dashboard.hotTopics" :key="topic.topic" class="topic-row">
            <text class="topic-name">{{ topic.topic }}</text>
            <text class="topic-count">{{ topic.count }} 条内容</text>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx 48rpx;
}
.login-panel {
  margin-top: 30rpx;
  padding: 42rpx 34rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
}
.login-emoji {
  font-size: 70rpx;
}
.login-title {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-1);
}
.login-sub {
  font-size: 23rpx;
  color: var(--text-3);
  text-align: center;
}
.password-input {
  width: 100%;
  height: 88rpx;
  margin-top: 14rpx;
  padding: 0 24rpx;
  border-radius: var(--radius);
  background: var(--surface-soft);
  color: var(--text-1);
  font-size: 26rpx;
  box-shadow: var(--shadow-card);
}
.error {
  color: var(--danger);
  font-size: 22rpx;
}
.login-button {
  width: 100%;
  height: 88rpx;
  margin-top: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 28rpx;
  font-weight: 500;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin-top: 18rpx;
}
.toolbar-title {
  font-size: 32rpx;
  font-weight: 700;
  color: var(--text-1);
}
.toolbar-actions {
  display: flex;
  gap: 12rpx;
}
.tool-button {
  height: 62rpx;
  padding: 0 22rpx;
  display: flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-2);
  font-size: 23rpx;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.stats-grid {
  margin-top: 20rpx;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}
.stat {
  min-width: 0;
  padding: 24rpx 14rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.stat-number {
  font-size: 42rpx;
  font-weight: 700;
  color: var(--pink-deep);
}
.stat-label {
  font-size: 22rpx;
  color: var(--text-2);
  text-align: center;
}
.breakdown,
.topics {
  margin-top: 24rpx;
  padding: 24rpx;
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.section-title {
  margin-bottom: 16rpx;
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-1);
}
.row,
.topic-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  padding: 14rpx 0;
  border-bottom: 1px solid var(--line);
  color: var(--text-2);
  font-size: 24rpx;
}
.row:last-child,
.topic-row:last-child {
  border-bottom: none;
}
.topic-name {
  min-width: 0;
  color: var(--text-1);
  font-weight: 700;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.topic-count {
  flex-shrink: 0;
  color: var(--purple-deep);
}
.empty {
  padding: 20rpx 0;
  color: var(--text-3);
  font-size: 23rpx;
}
</style>
