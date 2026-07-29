<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import AvatarViewer from '@/components/AvatarViewer/AvatarViewer.vue'
import RadarChart from '@/components/RadarChart/RadarChart.vue'
import { useProfileStore } from '@/stores/profile'
import { PREFERENCE_QUESTIONS } from '@/data/questions'
import { fetchStyleReport, type StyleReport } from '@/api/ai'

const store = useProfileStore()

const report = ref<StyleReport | null>(null)
const loading = ref(false)
const error = ref('')

/** 组装发给 AI 的可读画像 */
function buildPayload() {
  const prefs: Record<string, string> = {}
  for (const q of PREFERENCE_QUESTIONS) {
    const optId = store.profile.preferences[q.id]
    if (optId) prefs[q.title] = q.options.find((o) => o.id === optId)?.label ?? optId
  }
  return {
    styles: store.styleLabels,
    skin: store.skinLabel,
    face: store.faceLabel,
    bmi: store.bmi,
    body: { ...store.profile.body },
    preferences: prefs,
  }
}

async function generate() {
  loading.value = true
  error.value = ''
  try {
    report.value = await fetchStyleReport(buildPayload())
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(generate)

// AI 有数据就用 AI 的，否则回退到本地示意
const radar = computed(() =>
  report.value?.radar?.length ? report.value.radar : store.radar,
)
const summary = computed(
  () => report.value?.summary || store.summary || '完成测试即可生成你的专属画像',
)

function save() {
  uni.switchTab({ url: '/pages/home/home' })
}
function retest() {
  store.reset()
  uni.navigateTo({ url: '/pages/test/index' })
}
function goBack() {
  uni.navigateBack()
}
</script>

<template>
  <view class="page">
    <view class="top">
      <button class="back" aria-label="返回" @tap="goBack">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
      <view class="title">我的专属风格报告</view>
      <button class="retest" @tap="retest">重测</button>
    </view>

    <scroll-view scroll-y class="body">
      <!-- AI 状态条 -->
      <view v-if="loading" class="ai-banner loading">
        <text class="spin">🤖</text> <text>AI 正在生成你的专属风格报告…</text>
      </view>
      <view v-else-if="error" class="ai-banner err">
        <text>⚠️ AI 没连上：{{ error }}</text>
        <button class="mini" @tap="generate">重试</button>
      </view>
      <view v-else-if="report" class="ai-banner ok">
        <text>✨ 以下由 AI 实时生成</text>
        <button class="mini" @tap="generate">换一份</button>
      </view>

      <!-- 虚拟形象 -->
      <view class="card avatar-card">
        <AvatarViewer />
        <view class="summary">{{ summary }}</view>
      </view>

      <!-- 画像雷达图 -->
      <view class="card">
        <view class="sec-title">🧭 我的画像雷达</view>
        <RadarChart :dimensions="radar" />
      </view>

      <!-- 推荐配色 -->
      <view v-if="report?.palette?.length" class="card">
        <view class="sec-title">🎨 推荐配色</view>
        <view class="palette">
          <text v-for="c in report.palette" :key="c" class="sw" :style="{ background: c }" :title="c" />
        </view>
      </view>

      <!-- AI 穿搭推荐 -->
      <view v-if="report?.recommendations?.length" class="card">
        <view class="sec-title">👗 AI 穿搭推荐</view>
        <view class="recos">
          <view v-for="(r, i) in report.recommendations" :key="i" class="reco">
            <view class="reco-head">
              <text class="reco-title">{{ r.title }}</text>
              <text class="reco-scene">{{ r.scene }}</text>
            </view>
            <view class="reco-pieces">
              <text v-for="(p, j) in r.pieces" :key="j" class="piece">{{ p }}</text>
            </view>
            <view class="reco-reason">{{ r.reason }}</view>
          </view>
        </view>
      </view>

      <!-- 造型建议 -->
      <view v-if="report?.tips?.length" class="card">
        <view class="sec-title">💡 造型建议</view>
        <view class="tips">
          <view v-for="(t, i) in report.tips" :key="i" class="tip-item">{{ t }}</view>
        </view>
      </view>

      <!-- 关键标签 -->
      <view class="card">
        <view class="sec-title">🏷️ 关键标签</view>
        <view class="traits">
          <view class="trait">
            <text class="k">肤色</text><text class="v">{{ store.skinLabel || '—' }}</text>
          </view>
          <view class="trait">
            <text class="k">脸型</text><text class="v">{{ store.faceLabel || '—' }}</text>
          </view>
          <view class="trait">
            <text class="k">BMI</text><text class="v">{{ store.bmi }}</text>
          </view>
        </view>
        <view class="style-tags">
          <text v-for="s in store.styleLabels" :key="s" class="style-tag">{{ s }}</text>
          <text v-if="!store.styleLabels.length" class="style-tag empty">未选择风格</text>
        </view>
      </view>
    </scroll-view>

    <view class="foot">
      <button class="btn btn-primary save" @tap="save">保存并进入首页</button>
    </view>
  </view>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.top {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: calc(env(safe-area-inset-top, 24rpx) + 20rpx) 32rpx 20rpx;
  flex-shrink: 0;
}
.back {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
}
.title {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 34rpx;
  font-weight: 700;
}
.retest {
  font-size: 26rpx;
  font-weight: 600;
  color: var(--purple-deep);
  background: rgba(255, 255, 255, 0.7);
  padding: 14rpx 24rpx;
  border-radius: 9999rpx;
}

.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

/* AI 状态条 */
.ai-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 20rpx 28rpx;
  border-radius: var(--radius);
  font-size: 26rpx;
  font-weight: 600;
}
.ai-banner.loading {
  background: rgba(177, 140, 255, 0.14);
  color: var(--purple-deep);
}
.ai-banner.ok {
  background: rgba(255, 126, 179, 0.12);
  color: var(--pink-deep);
}
.ai-banner.err {
  background: #fff3f0;
  color: #d9694f;
}
.spin {
  display: inline-block;
  animation: spin 1.2s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.mini {
  flex-shrink: 0;
  font-size: 24rpx;
  font-weight: 700;
  color: inherit;
  background: rgba(255, 255, 255, 0.6);
  padding: 8rpx 20rpx;
  border-radius: 9999rpx;
}

.card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 36rpx;
  box-shadow: var(--shadow-card);
}
.avatar-card {
  padding-top: 16rpx;
}
.summary {
  margin: 8rpx 0 0;
  text-align: center;
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-1);
}

.sec-title {
  margin: 0 0 20rpx;
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-1);
}

/* 配色 */
.palette {
  display: flex;
  gap: 20rpx;
}
.sw {
  flex: 1;
  height: 80rpx;
  border-radius: 20rpx;
  box-shadow: inset 0 0 0 2rpx rgba(0, 0, 0, 0.06);
}

/* 推荐 */
.recos {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.reco {
  background: #f8f5ff;
  border-radius: var(--radius);
  padding: 24rpx 28rpx;
}
.reco-head {
  display: flex;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 16rpx;
}
.reco-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-1);
}
.reco-scene {
  font-size: 22rpx;
  font-weight: 700;
  color: #fff;
  background: var(--brand-gradient);
  padding: 4rpx 16rpx;
  border-radius: 9999rpx;
}
.reco-pieces {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.piece {
  font-size: 24rpx;
  color: var(--purple-deep);
  background: #fff;
  border: 1px solid var(--line);
  padding: 8rpx 20rpx;
  border-radius: 9999rpx;
}
.reco-reason {
  margin: 0;
  font-size: 24rpx;
  color: var(--text-2);
  line-height: 1.5;
}

/* 建议 */
.tips {
  margin: 0;
  padding-left: 36rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.tip-item {
  font-size: 26rpx;
  color: var(--text-1);
  line-height: 1.5;
}

.traits {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  margin-bottom: 28rpx;
}
.trait {
  background: #f6f2fd;
  border-radius: var(--radius);
  padding: 24rpx;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.trait .k {
  font-size: 24rpx;
  color: var(--text-3);
}
.trait .v {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--purple-deep);
}

.style-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.style-tag {
  padding: 14rpx 28rpx;
  border-radius: 9999rpx;
  background: rgba(255, 126, 179, 0.12);
  color: var(--pink-deep);
  font-size: 26rpx;
  font-weight: 600;
}
.style-tag.empty {
  background: #f0edf6;
  color: var(--text-3);
}

.foot {
  flex-shrink: 0;
  padding: 24rpx 32rpx calc(28rpx + env(safe-area-inset-bottom, 0rpx));
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 40%);
}
.save {
  width: 100%;
}
</style>
