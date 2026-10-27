<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { apiGetTryon, apiListTryon, type AiTask } from '@/api/tryon'
import { isAuthError } from '@/utils/request'

const expanded = ref(false)
const loading = ref(false)
const tasks = ref<AiTask[]>([])
const error = ref('')
const notice = ref('')
const opening = ref('')
const previewUrl = ref('')
const previewTask = ref('')
let generation = 0
onUnmounted(() => {
  generation++
})

const labels: Record<string, string> = {
  PENDING: '排队中',
  RUNNING: '生成中',
  SUCCEEDED: '已完成',
  FAILED: '生成失败',
  CANCELED: '已取消',
  UNKNOWN: '状态未知',
}
function dateLabel(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return '试衣记录'
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}
async function load() {
  const current = ++generation
  loading.value = true
  error.value = ''
  notice.value = ''
  previewUrl.value = ''
  opening.value = ''
  tasks.value = []
  try {
    const items = await apiListTryon(20)
    if (current === generation) tasks.value = items
  } catch (err) {
    if (current === generation && !isAuthError(err)) error.value = (err as Error)?.message || '记录加载失败'
  } finally {
    if (current === generation) loading.value = false
  }
}
function toggle() {
  expanded.value = !expanded.value
  if (expanded.value) void load()
  else {
    generation++
    tasks.value = []
    previewUrl.value = ''
    opening.value = ''
    loading.value = false
  }
}
async function openTask(task: AiTask) {
  if (opening.value) return
  const current = generation
  opening.value = task.taskId
  previewUrl.value = ''
  notice.value = ''
  try {
    const latest = await apiGetTryon(task.taskId)
    if (current !== generation) return
    tasks.value = tasks.value.map((item) => (item.taskId === task.taskId ? { ...item, ...latest } : item))
    if (latest.status === 'SUCCEEDED' && latest.imageUrl) {
      previewTask.value = task.taskId
      previewUrl.value = latest.imageUrl
    } else if (['PENDING', 'RUNNING'].includes(latest.status)) notice.value = '还在生成，稍后点击查看进度'
    else notice.value = latest.errorMessage || '这条记录没有可查看的图片'
  } catch (err) {
    if (current === generation && !isAuthError(err)) notice.value = (err as Error)?.message || '图片读取失败，请重试'
  } finally {
    if (current === generation) opening.value = ''
  }
}
function preview() {
  if (previewUrl.value) uni.previewImage({ urls: [previewUrl.value], current: previewUrl.value })
}
</script>

<template>
  <view class="tryon-history">
    <button class="history-toggle" @tap="toggle">
      <text>试衣记录</text>
      <text class="history-hint">{{ expanded ? '收起' : '查看之前的结果' }}</text>
    </button>
    <view v-if="expanded" class="history-content">
      <view class="history-toolbar">
        <text>最近 20 条</text>
        <button :disabled="loading" @tap="load">刷新</button>
      </view>
      <text v-if="loading" class="history-message">正在加载记录…</text>
      <view v-else-if="error" class="history-message">
        <text>{{ error }}</text>
        <button @tap="load">重试</button>
      </view>
      <text v-else-if="!tasks.length" class="history-message">还没有试衣记录</text>
      <view v-for="task in tasks" :key="task.taskId">
        <view class="history-item">
          <view class="history-description">
            <text>{{ dateLabel(task.createdAt) }}</text>
            <text class="history-hint">{{ labels[task.status] || '状态未知' }}</text>
          </view>
          <button
            v-if="['SUCCEEDED', 'PENDING', 'RUNNING'].includes(task.status)"
            :disabled="!!opening"
            @tap="openTask(task)"
          >
            {{ opening === task.taskId ? '读取中…' : task.status === 'SUCCEEDED' ? '查看图片' : '查看进度' }}
          </button>
          <text v-else class="history-hint">{{ task.errorMessage || '未生成图片' }}</text>
        </view>
        <image
          v-if="previewUrl && previewTask === task.taskId"
          class="history-preview"
          :src="previewUrl"
          mode="widthFix"
          @tap="preview"
          @error="notice = '图片显示失败，请重新读取'"
        />
        <text v-if="previewUrl && previewTask === task.taskId" class="history-hint">点击图片可放大查看</text>
      </view>
      <text v-if="notice" class="history-message">{{ notice }}</text>
    </view>
  </view>
</template>

<style scoped>
.tryon-history {
  margin-bottom: 24rpx;
  background: var(--surface);
  border: var(--hairline);
  border-radius: var(--radius-lg);
}

.history-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  background: transparent;
}

.history-toggle::after,
.history-content button::after {
  border: 0;
}

.history-content {
  padding: 0 24rpx 24rpx;
}

.history-toolbar,
.history-item {
  display: flex;
  gap: 16rpx;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 0;
  font-size: 26rpx;
}

.history-item {
  border-top: var(--hairline);
}

.history-description {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8rpx;
}

.history-hint {
  font-size: 22rpx;
  color: var(--text-secondary, #777);
}

.history-content button {
  padding: 8rpx 18rpx;
  margin: 0;
  font-size: 24rpx;
  line-height: 1.5;
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-radius: var(--radius-pill);
}

.history-message {
  display: block;
  padding: 20rpx 0;
  font-size: 26rpx;
}

.history-message button {
  margin-top: 16rpx;
}

.history-preview {
  display: block;
  width: 100%;
  margin: 20rpx 0 12rpx;
  border-radius: 16rpx;
}
</style>
