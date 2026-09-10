<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useProfileStore } from '@/stores/profile'
import { PREFERENCE_QUESTIONS } from '@/constants/questions'
import { fetchStyleReport, type StyleReport } from '@/api/ai'
import {
  fetchCurrentProfile,
  fetchStyleReports,
  fetchStyleReportById,
  saveCurrentProfile,
  toProfilePayload,
  type StyleReportListItem,
} from '@/api/profile'
import { buildLocalStyleReport } from '@/utils/localReport'
import { MODEL_IMAGES } from '@/constants/ui'
import { back, go, redirect } from '@/utils/nav'

const store = useProfileStore()

const report = ref<StyleReport | null>(null)
const loading = ref(false)
const error = ref('')
const source = ref<'ai' | 'rule'>('ai')
const history = ref<StyleReportListItem[]>([])
const historyLoading = ref(false)

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
  source.value = 'ai'
  try {
    if (store.isComplete) {
      await saveCurrentProfile(store.profile)
    }
    report.value = await fetchStyleReport(buildPayload(), toProfilePayload(store.profile))
    source.value = report.value.source || 'ai'
    await refreshHistory()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    report.value = buildLocalStyleReport({
      styles: store.profile.styles,
      skinTone: store.profile.skinTone,
      faceShape: store.profile.faceShape,
      body: { ...store.profile.body },
      preferences: { ...store.profile.preferences },
      gender: store.profile.gender,
      hairstyle: store.profile.hairstyle,
    })
    source.value = 'rule'
    error.value = ''
  } finally {
    loading.value = false
  }
}

async function refreshHistory() {
  historyLoading.value = true
  try {
    history.value = await fetchStyleReports()
  } catch {
    history.value = []
  } finally {
    historyLoading.value = false
  }
}

async function loadReport(id: number) {
  historyLoading.value = true
  try {
    const record = await fetchStyleReportById(id)
    const result = typeof record.result === 'string' ? JSON.parse(record.result) : record.result
    report.value = result || null
    source.value = report.value?.source === 'rule' ? 'rule' : 'ai'
    error.value = ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    historyLoading.value = false
  }
}

onMounted(async () => {
  store.loadPersisted()
  if (!store.isComplete) {
    redirect('test')
    return
  }

  const pending = uni.getStorageSync('ai-fashion-pending-report')
  uni.removeStorageSync('ai-fashion-pending-report')
  try {
    const remote = await fetchCurrentProfile()
    if (remote) store.applyRemoteProfile(remote)
  } catch {
    /* 后端不可用时继续使用本地画像 */
  }

  if (pending) {
    await generate()
    return
  }

  await refreshHistory()
  if (history.value[0]) {
    await loadReport(history.value[0].id)
  } else if (store.isComplete) {
    await generate()
  }
})

// AI 有数据就用 AI 的，否则回退到本地示意
const radar = computed(() => store.radar)
const summary = computed(() => report.value?.summary || store.summary || '完成测试即可生成你的专属画像')
const modelSrc = computed(() => (store.profile.gender === 'male' ? MODEL_IMAGES.frontMale : MODEL_IMAGES.front))
const modelBackSrc = computed(() => (store.profile.gender === 'male' ? MODEL_IMAGES.backMale : MODEL_IMAGES.back))
const viewerLabel = computed(() => (store.profile.gender === 'male' ? '男性虚拟形象' : '女性虚拟形象'))

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function save() {
  store.persist()
  go('home')
}
function retest() {
  store.reset()
  store.persist()
  go('test')
}
function goBack() {
  back()
}
</script>

<template>
  <view class="page">
    <view class="top">
      <button class="back" aria-label="返回" @tap="goBack">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <view class="title">我的专属风格报告</view>
      <button class="retest" @tap="retest">重测</button>
    </view>

    <scroll-view scroll-y class="body">
      <!-- AI 状态条 -->
      <view v-if="loading" class="ai-banner loading">
        <UiIcon class="spin" name="robot" :size="40" tone="purple" />
        <text>AI 正在生成你的专属风格报告…</text>
      </view>
      <view v-else-if="error" class="ai-banner err">
        <text>AI 没连上：{{ error }}</text>
        <button class="mini" @tap="generate">重试</button>
      </view>
      <view v-else-if="report && source === 'ai'" class="ai-banner ok">
        <text>以下由 AI 实时生成</text>
        <button class="mini" @tap="generate">换一份</button>
      </view>
      <view v-else-if="report && source === 'rule'" class="ai-banner ok">
        <text>基础规则版（AI 未连接）</text>
        <button class="mini" @tap="generate">重试 AI</button>
      </view>

      <view v-if="history.length" class="history">
        <view class="history-title">
          历史报告
          <text v-if="historyLoading" class="history-loading">读取中…</text>
        </view>
        <scroll-view scroll-x class="history-list" :show-scrollbar="false">
          <view v-for="item in history" :key="item.id" class="history-item" @tap="loadReport(item.id)">
            <text class="history-time">{{ formatDate(item.created_at) }}</text>
            <text class="history-go">查看</text>
          </view>
        </scroll-view>
      </view>

      <!-- 虚拟形象 -->
      <view class="card avatar-card">
        <AvatarViewer
          :src="modelSrc"
          :frames="{ front: modelSrc, back: modelBackSrc }"
          :label="viewerLabel"
          :shape="store.avatarShape"
        />
        <view class="summary">{{ summary }}</view>
      </view>

      <!-- 画像雷达图 -->
      <view class="card">
        <view class="sec-title">我的画像雷达</view>
        <RadarChart :dimensions="radar" />
        <view v-if="store.incompleteDimensions.length" class="incomplete-list">
          <view v-for="dim in store.incompleteDimensions" :key="dim.name" class="incomplete-item">
            <text class="dot">•</text>
            <text>{{ dim.name }}：该维度未完善</text>
          </view>
        </view>
      </view>

      <!-- 推荐配色 -->
      <view v-if="report?.palette?.length" class="card">
        <view class="sec-title">推荐配色</view>
        <view class="palette">
          <text v-for="c in report.palette" :key="c" class="sw" :style="{ background: c }" :title="c" />
        </view>
      </view>

      <!-- AI 穿搭推荐 -->
      <view v-if="report?.recommendations?.length" class="card">
        <view class="sec-title">AI 穿搭推荐</view>
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
        <view class="sec-title">造型建议</view>
        <view class="tips">
          <view v-for="(t, i) in report.tips" :key="i" class="tip-item">{{ t }}</view>
        </view>
      </view>

      <!-- 关键标签 -->
      <view class="card">
        <view class="sec-title">关键标签</view>
        <view class="traits">
          <view class="trait">
            <text class="k">肤色</text>
            <text class="v">{{ store.skinLabel || '—' }}</text>
          </view>
          <view class="trait">
            <text class="k">脸型</text>
            <text class="v">{{ store.faceLabel || '—' }}</text>
          </view>
          <view class="trait">
            <text class="k">BMI</text>
            <text class="v">{{ store.bmi }}</text>
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
.top {
  display: flex;
  flex-shrink: 0;
  gap: 20rpx;
  align-items: center;
  padding: calc(env(safe-area-inset-top, 24rpx) + 20rpx) 32rpx 20rpx;
}

.back {
  display: grid;
  place-items: center;
  width: 72rpx;
  height: 72rpx;
  color: var(--text-1);
  background: rgb(255 255 255 / 70%);
  border-radius: 50%;
  box-shadow: var(--shadow-card);
}

.title {
  flex: 1;
  margin: 0;
  font-size: var(--fs-3xl);
  font-weight: 700;
  text-align: center;
}

.retest {
  padding: 14rpx 24rpx;
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--purple-deep);
  background: rgb(255 255 255 / 70%);
  border-radius: var(--radius-pill);
}

.body {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
  padding: 12rpx 32rpx 32rpx;
}

/* AI 状态条 */
.ai-banner {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 28rpx;
  font-size: var(--fs-md);
  font-weight: 500;
  border-radius: var(--radius);
}

.ai-banner.loading {
  color: var(--purple-deep);
  background: var(--pink-soft);
}

.ai-banner.ok {
  color: var(--pink-deep);
  background: var(--pink-soft);
}

.ai-banner.err {
  color: var(--warning);
  background: #fff3f0;
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
  padding: 8rpx 20rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: inherit;
  background: rgb(255 255 255 / 60%);
  border-radius: var(--radius-pill);
}

.card {
  padding: 36rpx;
  border-radius: var(--radius-lg);
}

.history {
  padding: 20rpx 24rpx;
  background: rgb(255 255 255 / 62%);
  border: 1rpx solid rgb(255 255 255 / 80%);
  border-radius: var(--radius);
}

.history-title {
  display: flex;
  gap: 12rpx;
  align-items: center;
  margin-bottom: 14rpx;
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--text-1);
}

.history-loading {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--text-3);
}

.history-list {
  width: 100%;
  white-space: nowrap;
}

.history-item {
  display: inline-flex;
  gap: 14rpx;
  align-items: center;
  padding: 14rpx 20rpx;
  margin-right: 14rpx;
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.history-time {
  font-size: var(--fs-xs);
  color: var(--text-2);
}

.history-go {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--purple-deep);
}

.incomplete-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  padding-top: 20rpx;
  margin-top: 20rpx;
  border-top: 1rpx solid var(--line);
}

.incomplete-item {
  display: flex;
  gap: 10rpx;
  align-items: center;
  font-size: var(--fs-base);
  color: var(--text-2);
}

.incomplete-item .dot {
  font-weight: 700;
  color: var(--pink-deep);
}

.avatar-card {
  padding-top: 16rpx;
}

.summary {
  margin: 8rpx 0 0;
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
}

.sec-title {
  margin: 0 0 20rpx;
  font-size: var(--fs-xl);
  font-weight: 500;
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
  border-radius: var(--radius);
  box-shadow: inset 0 0 0 2rpx rgb(0 0 0 / 6%);
}

/* 推荐 */
.recos {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

.reco {
  padding: 24rpx 28rpx;
  background: #f8f5ff;
  border-radius: var(--radius);
}

.reco-head {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-bottom: 16rpx;
}

.reco-title {
  font-size: var(--fs-xl);
  font-weight: 500;
  color: var(--text-1);
}

.reco-scene {
  padding: 4rpx 16rpx;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
}

.reco-pieces {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-bottom: 16rpx;
}

.piece {
  padding: 8rpx 20rpx;
  font-size: var(--fs-base);
  color: var(--purple-deep);
  background: #fff;
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.reco-reason {
  margin: 0;
  font-size: var(--fs-base);
  line-height: 1.5;
  color: var(--text-2);
}

/* 建议 */
.tips {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding-left: 36rpx;
  margin: 0;
}

.tip-item {
  font-size: var(--fs-md);
  line-height: 1.5;
  color: var(--text-1);
}

.traits {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
  margin-bottom: 28rpx;
}

.trait {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  padding: 24rpx;
  text-align: center;
  background: #f6f2fd;
  border-radius: var(--radius);
}

.trait .k {
  font-size: var(--fs-base);
  color: var(--text-3);
}

.trait .v {
  font-size: var(--fs-2xl);
  font-weight: 500;
  color: var(--purple-deep);
}

.style-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.style-tag {
  padding: 14rpx 28rpx;
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: var(--radius-pill);
}

.style-tag.empty {
  color: var(--text-3);
  background: var(--surface-tint);
}

.foot {
  flex-shrink: 0;
  padding: 24rpx 32rpx calc(28rpx + env(safe-area-inset-bottom, 0rpx));
  background: linear-gradient(180deg, rgb(255 255 255 / 0%) 0%, rgb(255 255 255 / 55%) 40%);
}

.save {
  width: 100%;
}
</style>
