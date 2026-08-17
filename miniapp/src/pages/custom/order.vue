<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import {
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_ORDER,
} from '@/data/custom'
import {
  advanceCustomRequest,
  fetchCustomRequestDetail,
  resolveMediaUrl,
  sendDesignerMessage,
  type CustomMessage,
  type CustomRequestDetail,
} from '@/api/custom'
import { isAuthError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const requestId = ref(0)
const detail = ref<CustomRequestDetail | null>(null)
const loading = ref(true)
const sending = ref(false)
const advancing = ref(false)
const input = ref('')
const scrollTop = ref(0)
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined

const request = computed(() => detail.value?.request)
const measurement = computed(() => detail.value?.measurement)
const messages = computed(() => detail.value?.messages || [])
const statusIndex = computed(() =>
  Math.max(0, REQUEST_STATUS_ORDER.indexOf(request.value?.status || 'submitted')),
)
const canAdvance = computed(
  () => statusIndex.value < REQUEST_STATUS_ORDER.length - 1,
)
/**
 * 「演示推进」只给四个预置演示账号（规格 §16：不做真实履约）。
 *
 * 真实用户看到一个能自己把订单推到「已发货」的按钮，等于在演示这个功能
 * 有履约能力 —— 它没有。普通账号这里只显示进度由设计师更新的说明。
 */
const isDemoAccount = computed(() => Boolean(auth.session.demoKind))
const referenceImages = computed(() => request.value?.referenceImages || [])
const designerAvatar = computed(() =>
  request.value?.designer?.avatarUrl ? resolveMediaUrl(request.value.designer.avatarUrl) : '',
)
const measurementPhotos = computed(() => {
  if (!measurement.value) return []
  return [
    { label: '正面', url: measurement.value.frontImage },
    { label: '侧面', url: measurement.value.sideImage },
    { label: '背面', url: measurement.value.backImage },
  ].filter((item) => Boolean(item.url))
})

function showToast(message: string) {
  toast.value = message
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1900)
}

async function loadDetail() {
  if (!requestId.value) return
  loading.value = true
  try {
    detail.value = await fetchCustomRequestDetail(requestId.value)
    scrollToBottom()
  } catch (err) {
    if (!isAuthError(err)) {
      showToast(err instanceof Error ? err.message : '读取申请失败')
    }
  } finally {
    loading.value = false
  }
}

onLoad((options) => {
  const id = Number(options?.id)
  if (!Number.isInteger(id) || id <= 0) {
    showToast('定制申请不存在')
    return
  }
  requestId.value = id
  loadDetail()
})

function scrollToBottom() {
  nextTick(() => {
    scrollTop.value = scrollTop.value === 0 ? 1 : 0
    nextTick(() => {
      scrollTop.value = 99999
    })
  })
}

async function sendMessage() {
  const content = input.value.trim()
  if (!content || sending.value || !requestId.value) return
  sending.value = true
  try {
    const nextMessages = await sendDesignerMessage(requestId.value, content)
    if (detail.value) detail.value.messages = nextMessages
    input.value = ''
    scrollToBottom()
  } catch (err) {
    showToast(err instanceof Error ? err.message : '消息发送失败')
  } finally {
    sending.value = false
  }
}

async function advance() {
  if (!requestId.value || !canAdvance.value || advancing.value || !isDemoAccount.value) return
  advancing.value = true
  try {
    const nextRequest = await advanceCustomRequest(requestId.value)
    if (detail.value) detail.value.request = nextRequest
    showToast(`进度已更新：${REQUEST_STATUS_LABELS[nextRequest.status]}`)
  } catch (err) {
    showToast(err instanceof Error ? err.message : '进度更新失败')
  } finally {
    advancing.value = false
  }
}

function preview(url: string) {
  const resolved = resolveMediaUrl(url)
  uni.previewImage({ current: resolved, urls: [resolved] })
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function messageClass(message: CustomMessage) {
  return message.sender
}
</script>

<template>
  <view class="page">
    <PageHeader title="定制申请详情" to="/pages/custom/orders" sub="进度与设计师 IM" />

    <scroll-view v-if="detail" scroll-y class="body hide-scrollbar">
      <view v-if="request" class="designer-card">
        <!--
          设计师头像取后端 designer.avatarUrl；目录里还没配头像时退回姓氏首字，
          不再拿人台图 front.png 冒充一张设计师照片（§4.3）。
        -->
        <image
          v-if="designerAvatar"
          :src="designerAvatar"
          class="designer-avatar"
          mode="aspectFill"
        />
        <view v-else class="designer-avatar designer-avatar-fallback">
          <text>{{ (request.designer?.name || '设').slice(0, 1) }}</text>
        </view>
        <view class="designer-copy">
          <text class="designer-label">负责设计师</text>
          <text class="designer-name">{{ request.designer?.name || '待分配设计师' }}</text>
          <text class="designer-specialty">{{ request.designer?.specialty || '专属定制服务' }}</text>
        </view>
        <text class="source">{{ request.source === 'measurement' ? '量体预约' : '定制咨询' }}</text>
      </view>

      <view class="card">
        <view class="card-head">
          <text class="card-title">定制进度</text>
          <button
            v-if="isDemoAccount && canAdvance"
            class="advance"
            :disabled="advancing"
            @tap="advance"
          >
            {{ advancing ? '更新中…' : '演示推进' }}
          </button>
          <text v-else-if="!canAdvance" class="finished">已完成演示流程</text>
          <text v-else class="finished">进度由设计师更新</text>
        </view>

        <view class="progress">
          <view
            v-for="(status, index) in REQUEST_STATUS_ORDER"
            :key="status"
            class="progress-step"
            :class="{ done: index <= statusIndex, current: index === statusIndex }"
          >
            <view class="progress-dot">{{ index < statusIndex ? '✓' : index + 1 }}</view>
            <text class="progress-label">{{ REQUEST_STATUS_LABELS[status] }}</text>
          </view>
        </view>

        <view class="requirement">
          <text class="requirement-label">需求记录</text>
          <text class="requirement-text">
            {{ request!.requirements?.requirements || request!.requirements?.notes || '未填写需求说明' }}
          </text>
        </view>
      </view>

      <view v-if="measurement" class="card">
        <view class="card-title">量体数据</view>
        <view class="measure-grid">
          <view v-for="(value, key) in measurement.dimensions" :key="key" class="measure-item">
            <text class="measure-label">
              {{ { height: '身高', weight: '体重', bust: '胸围', waist: '腰围', hips: '臀围', shoulder: '肩宽' }[key] }}
            </text>
            <text class="measure-value">{{ value }}<text class="unit">{{ key === 'weight' ? 'kg' : 'cm' }}</text></text>
          </view>
        </view>
        <text v-if="measurement.notes" class="notes">{{ measurement.notes }}</text>

        <text class="card-subtitle">量体照片</text>
        <view class="photo-grid">
          <view
            v-for="photo in measurementPhotos"
            :key="photo.label"
            class="photo"
            @tap="preview(photo.url)"
          >
            <image :src="resolveMediaUrl(photo.url)" mode="aspectFill" />
            <text class="photo-label">{{ photo.label }}</text>
          </view>
        </view>
      </view>

      <view v-if="referenceImages.length" class="card">
        <view class="card-title">参考图片</view>
        <view class="reference-grid">
          <image
            v-for="(image, index) in referenceImages"
            :key="image + index"
            :src="resolveMediaUrl(image)"
            mode="aspectFill"
            class="reference"
            @tap="preview(image)"
          />
        </view>
      </view>

      <view class="chat-card">
        <view class="card-title">设计师一对一沟通</view>
        <scroll-view scroll-y class="chat" :scroll-top="scrollTop">
          <view
            v-if="!messages.length"
            class="welcome"
          >
            设计师已收到你的申请。可以继续补充面料、颜色、工期或尺码要求。
          </view>
          <view
            v-for="message in messages"
            :key="message.id"
            class="message"
            :class="messageClass(message)"
          >
            <text v-if="message.sender === 'designer'" class="message-role">设计师</text>
            <view class="bubble">{{ message.content }}</view>
            <text class="message-time">{{ formatTime(message.createdAt) }}</text>
          </view>
          <view v-if="sending" class="message designer">
            <text class="message-role">设计师</text>
            <view class="bubble typing">正在回复…</view>
          </view>
        </scroll-view>

        <view class="composer">
          <input
            v-model="input"
            class="message-input"
            placeholder="补充定制要求…"
            :disabled="sending"
            @confirm="sendMessage"
          />
          <button class="send" :class="{ disabled: sending || !input.trim() }" @tap="sendMessage">
            发送
          </button>
        </view>
      </view>
    </scroll-view>

    <view v-else class="loading-wrap">
      <text>{{ loading ? '正在读取申请…' : '申请不存在' }}</text>
    </view>

    <view v-if="toast" class="toast">{{ toast }}</view>
  </view>
</template>

<style scoped>
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx calc(36rpx + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.loading-wrap {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  font-size: 26rpx;
}

.designer-card,
.card,
.chat-card {
  padding: 28rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}
.designer-card {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.designer-avatar {
  width: 132rpx;
  height: 132rpx;
  border-radius: 24rpx;
  flex-shrink: 0;
  background: #f0e6fb;
}
.designer-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(150deg, #ffe6f2, #e7dcff);
  color: var(--purple-deep);
  font-size: 52rpx;
  font-weight: 800;
}
.designer-copy {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7rpx;
}
.designer-label {
  color: var(--text-3);
  font-size: 20rpx;
}
.designer-name {
  font-size: 30rpx;
  font-weight: 800;
}
.designer-specialty {
  font-size: 22rpx;
  color: var(--text-2);
}
.source {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: rgba(169, 220, 214, 0.22);
  color: #388d83;
  font-size: 21rpx;
  font-weight: 750;
}

.card-title,
.card-subtitle {
  display: block;
  font-size: 29rpx;
  font-weight: 800;
  color: var(--text-1);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
}
.advance {
  flex-shrink: 0;
  padding: 10rpx 20rpx;
  border-radius: var(--radius-pill);
  color: var(--purple-deep);
  background: rgba(177, 140, 255, 0.14);
  font-size: 22rpx;
  font-weight: 750;
}
.finished {
  color: var(--mint-deep);
  font-size: 22rpx;
  font-weight: 700;
}

.progress {
  display: flex;
  margin-top: 28rpx;
  margin-bottom: 28rpx;
}
.progress-step {
  flex: 1;
  min-width: 0;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  color: var(--text-3);
}
.progress-step::before {
  content: '';
  position: absolute;
  top: 23rpx;
  right: 50%;
  width: 100%;
  height: 4rpx;
  background: #e7e1f0;
}
.progress-step:first-child::before {
  display: none;
}
.progress-step.done::before,
.progress-step.current::before {
  background: linear-gradient(90deg, var(--pink), var(--purple));
}
.progress-dot {
  position: relative;
  z-index: 1;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e7e1f0;
  color: var(--text-3);
  font-size: 20rpx;
  font-weight: 800;
}
.progress-step.done .progress-dot,
.progress-step.current .progress-dot {
  background: var(--brand-gradient);
  color: #fff;
  box-shadow: 0 8rpx 18rpx rgba(177, 140, 255, 0.35);
}
.progress-label {
  font-size: 20rpx;
  white-space: nowrap;
}
.progress-step.done,
.progress-step.current {
  color: var(--text-1);
}

.requirement {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: var(--surface-soft);
}
.requirement-label {
  color: var(--text-3);
  font-size: 21rpx;
}
.requirement-text {
  font-size: 25rpx;
  line-height: 1.55;
  color: var(--text-1);
}

.measure-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 22rpx;
}
.measure-item {
  padding: 18rpx 10rpx;
  border-radius: 24rpx;
  background: var(--surface-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.measure-label {
  color: var(--text-3);
  font-size: 21rpx;
}
.measure-value {
  color: var(--text-1);
  font-size: 27rpx;
  font-weight: 800;
}
.unit {
  margin-left: 4rpx;
  color: var(--text-3);
  font-size: 19rpx;
  font-weight: 500;
}
.notes {
  display: block;
  margin-top: 16rpx;
  color: var(--text-2);
  font-size: 23rpx;
  line-height: 1.5;
}
.card-subtitle {
  margin-top: 24rpx;
  font-size: 25rpx;
}
.photo-grid,
.reference-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14rpx;
  margin-top: 16rpx;
}
.photo,
.reference {
  position: relative;
  width: 100%;
  height: 230rpx;
  border-radius: 22rpx;
  overflow: hidden;
  background: var(--surface-soft);
}
.photo image {
  width: 100%;
  height: 100%;
}
.photo-label {
  position: absolute;
  left: 8rpx;
  bottom: 8rpx;
  padding: 6rpx 13rpx;
  border-radius: var(--radius-pill);
  background: rgba(47, 47, 58, 0.74);
  color: #fff;
  font-size: 18rpx;
}
.reference {
  height: 210rpx;
}

.chat {
  height: 500rpx;
  margin: 20rpx -8rpx 0;
  padding: 8rpx;
  background: #f8f5fb;
  border-radius: 24rpx;
}
.welcome {
  padding: 24rpx;
  border-radius: 24rpx;
  background: rgba(177, 140, 255, 0.12);
  color: var(--text-2);
  font-size: 23rpx;
  line-height: 1.55;
  text-align: center;
}
.message {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7rpx;
  margin-bottom: 20rpx;
}
.message.user {
  align-items: flex-end;
}
.message-role {
  padding-left: 8rpx;
  color: var(--text-3);
  font-size: 19rpx;
}
.bubble {
  max-width: 82%;
  padding: 18rpx 22rpx;
  border-radius: 28rpx;
  background: #fff;
  color: var(--text-1);
  font-size: 25rpx;
  line-height: 1.5;
  word-break: break-word;
  white-space: pre-wrap;
}
.message.user .bubble {
  background: var(--brand-gradient);
  color: #fff;
}
.typing {
  color: var(--text-3);
}
.message-time {
  padding: 0 8rpx;
  color: var(--text-3);
  font-size: 18rpx;
}
.composer {
  display: flex;
  align-items: center;
  gap: 14rpx;
  margin-top: 18rpx;
}
.message-input {
  flex: 1;
  min-width: 0;
  height: 82rpx;
  padding: 0 26rpx;
  border: 2rpx solid var(--line);
  border-radius: var(--radius-pill);
  background: #fff;
  font-size: 26rpx;
}
.send {
  flex-shrink: 0;
  height: 82rpx;
  padding: 0 30rpx;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 25rpx;
  font-weight: 750;
}
.send.disabled {
  opacity: 0.55;
}

</style>
