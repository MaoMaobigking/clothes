<script setup lang="ts">
import { computed, ref } from 'vue'
import { fetchAdminDashboard, type AdminDashboard } from '@/api/community'
import { isAuthError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const password = ref('')
const logging = ref(false)
const errorText = ref('')
const dashboard = ref<AdminDashboard | null>(null)

/*
 * ── 三个图表指标 ──
 * 数据全部来自现有表的实时聚合（见 server/repositories/communityRepo.mjs 的 getAdminMetrics），
 * 没有统计表、没有埋点、没有定时任务，所以「刷新」按钮拿到的就是当下的库里状态。
 *
 * canvas 画的是像素，取不到 CSS 变量，色值必须和 tokens.css 手工对齐 ——
 * 和 RadarChart 里那组常量同样的理由。
 */
const BRAND = '#ff5c9d'
const BRAND_SOFT = 'rgba(255, 92, 157, 0.18)'
const PURPLE = '#8b6ee8'
const AXIS = '#c0c4cc'
const LABEL = '#606266'
/** 互动构成四种 type 的中文名和配色，顺序和后端返回的顺序一致 */
const MIX_META: Record<string, { name: string; color: string }> = {
  like: { name: '点赞', color: BRAND },
  favorite: { name: '收藏', color: PURPLE },
  complete: { name: '教程完成', color: '#5ac8b0' },
  report: { name: '举报', color: '#f0a35e' },
}

/** 柱状图右上角那个总数。放 computed 而不是模板里写 reduce，模板表达式只放取值 */
const activeTotal = computed(() => (dashboard.value?.metrics?.activeDaily || []).reduce((sum, d) => sum + d.count, 0))

const activeOption = computed(() => {
  const daily = dashboard.value?.metrics?.activeDaily || []
  if (!daily.length) return null
  return {
    animation: false,
    grid: { left: 34, right: 12, top: 16, bottom: 24 },
    xAxis: {
      type: 'category' as const,
      data: daily.map((d) => d.label),
      axisLine: { lineStyle: { color: AXIS } },
      axisTick: { show: false },
      axisLabel: { color: LABEL, fontSize: 10 },
    },
    yAxis: {
      type: 'value' as const,
      // 全 0 的时候 ECharts 会把轴画成 0~1 的小数刻度，minInterval 逼它按整数走
      minInterval: 1,
      axisLine: { show: false },
      axisLabel: { color: LABEL, fontSize: 10 },
      splitLine: { lineStyle: { color: 'rgba(0,0,0,0.06)' } },
    },
    series: [
      {
        type: 'bar' as const,
        data: daily.map((d) => d.count),
        barMaxWidth: 22,
        itemStyle: { color: BRAND, borderRadius: [6, 6, 0, 0] },
        label: { show: true, position: 'top' as const, color: LABEL, fontSize: 10 },
      },
    ],
  }
})

const mixOption = computed(() => {
  const mix = (dashboard.value?.metrics?.interactionMix || []).filter((item) => item.count > 0)
  if (!mix.length) return null
  return {
    animation: false,
    series: [
      {
        type: 'pie' as const,
        radius: ['42%', '68%'],
        center: ['50%', '52%'],
        // tooltip 在小程序端弹不出来（见 MetricChart 的注释），数值直接画在引导线上
        label: {
          color: LABEL,
          fontSize: 10,
          formatter: '{b} {c}',
        },
        labelLine: { length: 8, length2: 8 },
        data: mix.map((item) => ({
          name: MIX_META[item.type]?.name || item.type,
          value: item.count,
          itemStyle: { color: MIX_META[item.type]?.color || AXIS },
        })),
      },
    ],
  }
})

const vipOption = computed(() => {
  const membership = dashboard.value?.metrics?.membership
  if (!membership) return null
  return {
    animation: false,
    series: [
      {
        type: 'gauge' as const,
        min: 0,
        max: 100,
        startAngle: 210,
        endAngle: -30,
        radius: '92%',
        center: ['50%', '58%'],
        progress: { show: true, width: 14, itemStyle: { color: BRAND } },
        axisLine: { lineStyle: { width: 14, color: [[1, BRAND_SOFT]] } },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        detail: {
          offsetCenter: [0, '10%'],
          fontSize: 22,
          fontWeight: 'bold' as const,
          color: BRAND,
          formatter: '{value}%',
        },
        data: [{ value: membership.vipRate }],
      },
    ],
  }
})

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
          <input v-model="password" class="password-input" password maxlength="64" placeholder="请输入管理员密码" />
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

        <!--
          三张图的口径都写在图下面的小字里。看板最容易出的事故不是数算错，
          是「活跃」「渗透率」这类词各人理解不同 —— 所以定义跟着数一起显示。
        -->
        <view class="chart-card">
          <view class="chart-head">
            <text class="section-title">近 {{ dashboard.metrics.activeDays }} 日活跃用户</text>
            <text class="chart-badge">{{ activeTotal }} 人次</text>
          </view>
          <MetricChart :option="activeOption" :height="380" />
          <text class="chart-note">
            口径：当天在社区产生过互动（点赞 / 收藏 / 完成教程 / 评论）的去重用户数。
            库里没有访问日志表，所以这不是「打开过小程序」意义上的 DAU。
          </text>
        </view>

        <view class="chart-card">
          <view class="chart-head">
            <text class="section-title">互动构成</text>
            <text class="chart-badge">{{ dashboard.stats.likeCount + dashboard.stats.favoriteCount }} 次正向</text>
          </view>
          <MetricChart :option="mixOption" :height="380" />
          <text class="chart-note">口径：community_interactions 按 type 分组计数。数量为 0 的类型不画进环里。</text>
        </view>

        <view class="chart-card">
          <view class="chart-head">
            <text class="section-title">会员渗透率</text>
            <text class="chart-badge">
              {{ dashboard.metrics.membership.vipCount }} / {{ dashboard.metrics.membership.userTotal }}
            </text>
          </view>
          <MetricChart :option="vipOption" :height="330" />
          <text class="chart-note">口径：users 表里 membership_level ≠ standard 的用户占全部用户的比例。</text>
        </view>

        <view class="breakdown">
          <view class="section-title">内容构成</view>
          <view class="row">
            <text>杂志</text>
            <text>{{ dashboard.stats.magazineCount }}</text>
          </view>
          <view class="row">
            <text>教程</text>
            <text>{{ dashboard.stats.tutorialCount }}</text>
          </view>
          <view class="row">
            <text>用户分享</text>
            <text>{{ dashboard.stats.shareCount }}</text>
          </view>
          <view class="row">
            <text>话题挑战</text>
            <text>{{ dashboard.stats.challengeCount }}</text>
          </view>
          <view class="row">
            <text>举报</text>
            <text>{{ dashboard.stats.reportCount }}</text>
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
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  align-items: center;
  padding: 42rpx 34rpx;
  margin-top: 30rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
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
  padding: 0 24rpx;
  margin-top: 14rpx;
  font-size: 26rpx;
  color: var(--text-1);
  background: var(--surface-soft);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.error {
  font-size: 22rpx;
  color: var(--danger);
}

.login-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 88rpx;
  margin-top: 12rpx;
  font-size: 28rpx;
  font-weight: 500;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
}

.toolbar {
  display: flex;
  gap: 18rpx;
  align-items: center;
  justify-content: space-between;
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
  display: flex;
  align-items: center;
  height: 62rpx;
  padding: 0 22rpx;
  font-size: 23rpx;
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-top: 20rpx;
}

.stat {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  align-items: center;
  min-width: 0;
  padding: 24rpx 14rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
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
  padding: 24rpx;
  margin-top: 24rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.chart-card {
  padding: 24rpx 20rpx 20rpx;
  margin-top: 24rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.chart-head {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8rpx;
}

.chart-head .section-title {
  margin-bottom: 0;
}

.chart-badge {
  flex-shrink: 0;
  padding: 4rpx 18rpx;
  font-size: 21rpx;
  font-weight: 700;
  color: var(--purple-deep);
  background: var(--surface-soft);
  border-radius: var(--radius-pill);
}

.chart-note {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  line-height: 1.55;
  color: var(--text-3);
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
  gap: 20rpx;
  align-items: center;
  justify-content: space-between;
  padding: 14rpx 0;
  font-size: 24rpx;
  color: var(--text-2);
  border-bottom: 1px solid var(--line);
}

.row:last-child,
.topic-row:last-child {
  border-bottom: none;
}

.topic-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.topic-count {
  flex-shrink: 0;
  color: var(--purple-deep);
}

.empty {
  padding: 20rpx 0;
  font-size: 23rpx;
  color: var(--text-3);
}
</style>
