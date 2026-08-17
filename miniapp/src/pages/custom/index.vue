<script setup lang="ts">
import { iconForEmoji } from '@/utils/icons'
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { CUSTOM_CATEGORIES, CUSTOM_STEPS, REQUEST_STATUS_LABELS } from '@/data/custom'
import {
  fetchCustomRequests,
  fetchCustomSummary,
  upgradeCustomMembership,
  type CustomRequest,
  type CustomSummary,
} from '@/api/custom'
import { isAuthError } from '@/api/http'

const summary = ref<CustomSummary | null>(null)
const requests = ref<CustomRequest[]>([])
const loading = ref(true)
const upgrading = ref(false)
const error = ref('')
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

function showToast(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1800)
}

async function loadData() {
  loading.value = true
  error.value = ''
  try {
    const [summaryData, requestData] = await Promise.all([
      fetchCustomSummary(),
      fetchCustomRequests(),
    ])
    summary.value = summaryData
    requests.value = requestData.slice(0, 5)
  } catch (err) {
    // 未登录已由请求层跳登录页，这里不再叠一条报错（规格 §5）
    if (!isAuthError(err)) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  } finally {
    loading.value = false
  }
}

async function upgrade() {
  if (upgrading.value) return
  upgrading.value = true
  try {
    const next = await upgradeCustomMembership()
    summary.value = next
    showToast('已切换为演示 VIP 身份')
  } catch (err) {
    showToast(err instanceof Error ? err.message : '升级失败')
  } finally {
    upgrading.value = false
  }
}

function openCategory(key: string) {
  uni.navigateTo({ url: `/pages/custom/category?key=${key}` })
}

function openOrders() {
  uni.navigateTo({ url: '/pages/custom/orders' })
}

function openRequest(id: number) {
  uni.navigateTo({ url: `/pages/custom/order?id=${id}` })
}

onShow(loadData)
</script>

<template>
  <view class="page">
    <PageHeader title="差异化定制服务" to="/pages/home/home" sub="四类人群 · 量体 · 设计师 IM" />

    <scroll-view scroll-y class="body hide-scrollbar">
      <view class="intro">
        <view class="intro-copy">
          <text class="eyebrow">CUSTOM ATELIER</text>
          <text class="title">把“合身”做得更具体</text>
          <text class="desc">按身材、场合和真实需求进入定制，提交后可追踪进度并与设计师持续沟通。</text>
        </view>
        <view class="intro-image">
          <image src="/static/images/model/front.png" mode="aspectFit" />
        </view>
      </view>

      <view>
        <view class="section-title">选择服务人群</view>
        <view class="category-grid">
          <view
            v-for="category in CUSTOM_CATEGORIES"
            :key="category.key"
            class="category"
            hover-class="category-hover"
            @tap="openCategory(category.key)"
          >
            <view class="category-image-wrap">
              <TileImage
                :src="category.image"
                from="#ffe6f2"
                to="#e7dcff"
                fill
                rounded="0"
              />
              <UiIcon class="category-emoji" :name="iconForEmoji(category.emoji) ?? 'scissors'" :size="44" tone="soft" />
            </view>
            <view class="category-meta">
              <text class="category-label">{{ category.shortLabel }}</text>
              <text class="category-desc">{{ category.label }}</text>
            </view>
          </view>
        </view>
      </view>

      <view class="process-card">
        <view class="section-title">定制流程</view>
        <view class="steps">
          <view v-for="(step, index) in CUSTOM_STEPS" :key="step" class="step">
            <text class="step-index">{{ index + 1 }}</text>
            <text class="step-label">{{ step }}</text>
          </view>
        </view>
      </view>

      <view class="vip-card">
        <view class="vip-top">
          <view>
            <text class="vip-title">高端定制与 VIP</text>
            <text class="vip-desc">手工刺绣、限量联名与设计师款预约</text>
          </view>
          <text class="vip-badge">{{ summary?.membershipLevel === 'vip' ? 'VIP' : '标准会员' }}</text>
        </view>
        <button
          v-if="summary?.membershipLevel !== 'vip'"
          class="btn btn-primary vip-btn"
          :disabled="upgrading"
          @tap="upgrade"
        >
          {{ upgrading ? '切换中…' : '演示升级 VIP' }}
        </button>
        <text v-else class="vip-ready">当前演示身份已开通 VIP 专属预约</text>
      </view>

      <view>
        <view class="section-title requests-head">
          <text>我的定制申请</text>
          <text class="requests-more" @tap="openOrders">查看全部 ›</text>
        </view>

        <text v-if="loading" class="empty">正在读取申请…</text>
        <text v-else-if="error" class="empty error">{{ error }}</text>
        <view v-else-if="requests.length" class="request-list">
          <view
            v-for="item in requests"
            :key="item.id"
            class="request-item"
            hover-class="request-hover"
            @tap="openRequest(item.id)"
          >
            <view class="request-main">
              <text class="request-title">{{ item.requirements?.requirements || '定制申请' }}</text>
              <text class="request-meta">
                {{ item.source === 'measurement' ? '量体预约' : '定制咨询' }} ·
                {{ item.designer?.name || '待分配设计师' }}
              </text>
            </view>
            <view class="request-side">
              <text class="status">{{ REQUEST_STATUS_LABELS[item.status] || item.status }}</text>
              <text class="arrow">›</text>
            </view>
          </view>
        </view>
        <view v-else class="empty-card" @tap="openCategory('body')">
          <text class="empty-title">还没有定制申请</text>
          <text class="empty-desc">从一个服务人群开始，或直接发起咨询</text>
          <button class="btn btn-primary empty-btn">立即咨询</button>
        </view>
      </view>
    </scroll-view>

    <view v-if="toast" class="toast">{{ toast }}</view>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx calc(40rpx + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 34rpx;
}

.intro {
  display: flex;
  align-items: stretch;
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: linear-gradient(150deg, rgba(255, 231, 243, 0.96), rgba(238, 228, 255, 0.96));
  box-shadow: var(--shadow-card);
}
.intro-copy {
  flex: 1;
  padding: 34rpx 18rpx 34rpx 30rpx;
  display: flex;
  flex-direction: column;
}
.eyebrow {
  color: var(--pink-deep);
  font-size: 20rpx;
  font-weight: 800;
}
.title {
  margin-top: 16rpx;
  font-size: 40rpx;
  line-height: 1.18;
  font-weight: 900;
  color: var(--text-1);
}
.desc {
  margin-top: 18rpx;
  font-size: 24rpx;
  line-height: 1.55;
  color: var(--text-2);
}
.intro-image {
  width: 36%;
  height: 270rpx;
  flex-shrink: 0;
  align-self: center;
  border-radius: 28rpx;
  overflow: hidden;
  background: linear-gradient(150deg, #ffe1ef, #ded2ff);
}
.intro-image image {
  width: 100%;
  height: 100%;
}

.section-title {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--text-1);
  margin-bottom: 22rpx;
}
.category-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 22rpx;
}
.category {
  background: var(--surface);
  border-radius: 30rpx;
  padding: 14rpx;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.category-image-wrap {
  position: relative;
  width: 100%;
  height: 210rpx;
  border-radius: 24rpx;
  overflow: hidden;
  background: linear-gradient(150deg, #ffe6f2, #e6dcff);
}
.category-image-wrap image {
  width: 100%;
  height: 100%;
}
.category-emoji {
  position: absolute;
  right: 14rpx;
  bottom: 10rpx;
  font-size: 42rpx;
}
.category-hover,
.request-hover {
  opacity: 0.78;
}
.category-meta {
  padding: 16rpx 8rpx 8rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.category-label {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-1);
}
.category-desc {
  font-size: 22rpx;
  color: var(--text-3);
  line-height: 1.35;
}

.process-card,
.vip-card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 30rpx;
  box-shadow: var(--shadow-card);
}
.steps {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.step {
  display: flex;
  align-items: center;
  gap: 12rpx;
  padding: 12rpx 18rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  border: 2rpx solid var(--line);
}
.step-index {
  width: 44rpx;
  height: 44rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
}
.step-label {
  font-size: 23rpx;
  font-weight: 650;
  color: var(--text-1);
}

.vip-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
}
.vip-title {
  display: block;
  font-size: 30rpx;
  font-weight: 800;
}
.vip-desc {
  display: block;
  margin-top: 10rpx;
  font-size: 23rpx;
  color: var(--text-2);
}
.vip-badge {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  color: var(--purple-deep);
  background: rgba(177, 140, 255, 0.15);
  font-size: 22rpx;
  font-weight: 800;
}
.vip-btn {
  height: 82rpx;
  margin-top: 22rpx;
}
.vip-ready {
  display: block;
  margin-top: 20rpx;
  color: var(--mint-deep);
  font-size: 24rpx;
  font-weight: 700;
}

.requests-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.requests-more {
  font-size: 24rpx;
  color: var(--text-3);
}
.request-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.request-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 26rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}
.request-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.request-title {
  font-size: 27rpx;
  font-weight: 750;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.request-meta {
  font-size: 22rpx;
  color: var(--text-3);
}
.request-side {
  display: flex;
  align-items: center;
  gap: 12rpx;
  flex-shrink: 0;
}
.status {
  font-size: 23rpx;
  font-weight: 700;
  color: var(--pink-deep);
}
.arrow {
  color: var(--text-3);
  font-size: 38rpx;
}
.empty,
.error {
  display: block;
  color: var(--text-3);
  font-size: 25rpx;
  text-align: center;
}
.error {
  color: var(--warning);
}
.empty-card {
  background: var(--surface-soft);
  border: 2rpx dashed var(--line);
  border-radius: var(--radius);
  padding: 42rpx 30rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14rpx;
}
.empty-title {
  font-size: 29rpx;
  font-weight: 800;
}
.empty-desc {
  font-size: 23rpx;
  color: var(--text-3);
}
.empty-btn {
  width: 100%;
  height: 80rpx;
  margin-top: 10rpx;
}

</style>
