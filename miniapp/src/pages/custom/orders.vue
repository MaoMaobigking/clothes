<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import { REQUEST_STATUS_LABELS, REQUEST_STATUS_ORDER } from '@/data/custom'
import { fetchCustomRequests, type CustomRequest } from '@/api/custom'
import { isAuthError } from '@/api/http'

const requests = ref<CustomRequest[]>([])
const loading = ref(true)
const error = ref('')

async function loadRequests() {
  loading.value = true
  error.value = ''
  try {
    requests.value = await fetchCustomRequests()
  } catch (err) {
    // 未登录已由请求层跳登录页，这里不再叠一条报错（规格 §5）
    if (!isAuthError(err)) {
      error.value = err instanceof Error ? err.message : String(err)
    }
  } finally {
    loading.value = false
  }
}

function openRequest(id: number) {
  uni.navigateTo({ url: `/pages/custom/order?id=${id}` })
}

function openCategory() {
  uni.navigateTo({ url: '/pages/custom/category?key=body' })
}

/**
 * 五档进度（规格 §11.6）。
 *
 * 以前列表里只有一枚当前状态标签，「定制进度可见」这条要靠点进详情页才成立。
 * 现在每张卡直接画出「已提交 → 设计稿 → 打样 → 生产中 → 发货」，
 * 走到哪一档一眼可见；状态来自后端 request.status，不在前端造。
 */
function statusIndex(status: string) {
  return Math.max(0, REQUEST_STATUS_ORDER.indexOf(status))
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

onShow(loadRequests)
</script>

<template>
  <view class="page">
    <PageHeader title="我的定制申请" to="/pages/custom/index" sub="咨询、量体与设计师沟通" />

    <scroll-view scroll-y class="body hide-scrollbar">
      <text v-if="loading" class="state">正在读取申请…</text>
      <text v-else-if="error" class="state error">{{ error }}</text>

      <view v-else-if="requests.length" class="list">
        <view
          v-for="item in requests"
          :key="item.id"
          class="request"
          hover-class="request-hover"
          @tap="openRequest(item.id)"
        >
          <view class="request-top">
            <view class="request-type">
              <text class="type">{{ item.source === 'measurement' ? '量体预约' : '定制咨询' }}</text>
              <text class="number">#{{ String(item.id).padStart(4, '0') }}</text>
            </view>
            <text class="status">{{ REQUEST_STATUS_LABELS[item.status] || item.status }}</text>
          </view>

          <text class="requirement">{{ item.requirements?.requirements || item.requirements?.notes || '未填写补充说明' }}</text>

          <!-- 五档进度时间轴（§11.6） -->
          <view class="timeline">
            <view
              v-for="(status, index) in REQUEST_STATUS_ORDER"
              :key="status"
              class="tl-step"
              :class="{
                done: index < statusIndex(item.status),
                current: index === statusIndex(item.status),
              }"
            >
              <view class="tl-line" :class="{ first: index === 0 }" />
              <view class="tl-dot">{{ index < statusIndex(item.status) ? '✓' : '' }}</view>
              <text class="tl-label">{{ REQUEST_STATUS_LABELS[status] }}</text>
            </view>
          </view>

          <view class="meta">
            <text>{{ item.designer?.name || '待分配设计师' }}</text>
            <text>{{ formatTime(item.updatedAt) }}</text>
          </view>

          <view class="actions">
            <view class="action-text">查看进度与消息</view>
            <text class="arrow">›</text>
          </view>
        </view>
      </view>

      <view v-else class="empty">
        <text class="empty-emoji">🧵</text>
        <text class="empty-title">还没有定制申请</text>
        <text class="empty-desc">提交咨询或量体预约后，进度会集中显示在这里。</text>
        <button class="btn btn-primary empty-btn" @tap="openCategory">发起定制</button>
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
  padding: 12rpx 32rpx calc(36rpx + env(safe-area-inset-bottom, 0px));
}
.state {
  display: block;
  padding-top: 40rpx;
  text-align: center;
  color: var(--text-3);
  font-size: 25rpx;
}
.state.error {
  color: #d9694f;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.request {
  padding: 28rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}
.request-hover {
  opacity: 0.78;
}
.request-top,
.meta,
.actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.request-type {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}
.type {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-1);
}
.number {
  font-size: 21rpx;
  color: var(--text-3);
}
.status {
  flex-shrink: 0;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 92, 157, 0.1);
  color: var(--pink-deep);
  font-size: 23rpx;
  font-weight: 750;
}
.requirement {
  display: -webkit-box;
  margin-top: 18rpx;
  font-size: 26rpx;
  line-height: 1.55;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
.meta {
  margin-top: 18rpx;
  color: var(--text-3);
  font-size: 22rpx;
}

/* 五档进度时间轴（§11.6） */
.timeline {
  display: flex;
  margin-top: 24rpx;
}
.tl-step {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
}
.tl-line {
  position: absolute;
  top: 15rpx;
  right: 50%;
  left: -50%;
  height: 4rpx;
  background: var(--line);
}
.tl-line.first {
  display: none;
}
.tl-step.done .tl-line,
.tl-step.current .tl-line {
  background: var(--pink-deep);
}
.tl-dot {
  position: relative;
  z-index: 1;
  width: 30rpx;
  height: 30rpx;
  border-radius: 50%;
  background: var(--surface-soft);
  border: 3rpx solid var(--line);
  color: #fff;
  font-size: 18rpx;
  font-weight: 800;
  line-height: 24rpx;
  text-align: center;
}
.tl-step.done .tl-dot {
  background: var(--pink-deep);
  border-color: var(--pink-deep);
}
.tl-step.current .tl-dot {
  background: var(--brand-gradient);
  border-color: transparent;
  box-shadow: 0 0 0 6rpx rgba(255, 92, 157, 0.16);
}
.tl-label {
  font-size: 19rpx;
  color: var(--text-3);
  white-space: nowrap;
}
.tl-step.done .tl-label,
.tl-step.current .tl-label {
  color: var(--text-1);
  font-weight: 700;
}
.actions {
  margin-top: 22rpx;
  padding-top: 20rpx;
  border-top: 2rpx solid var(--line);
}
.action-text {
  color: var(--purple-deep);
  font-size: 24rpx;
  font-weight: 700;
}
.arrow {
  color: var(--text-3);
  font-size: 38rpx;
  line-height: 1;
}

.empty {
  padding: 90rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  text-align: center;
}
.empty-emoji {
  font-size: 76rpx;
}
.empty-title {
  font-size: 31rpx;
  font-weight: 800;
}
.empty-desc {
  font-size: 24rpx;
  line-height: 1.5;
  color: var(--text-2);
}
.empty-btn {
  width: 100%;
  height: 82rpx;
  margin-top: 14rpx;
}
</style>
