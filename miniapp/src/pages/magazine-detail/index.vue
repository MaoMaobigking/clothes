<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import {
  bookmarkCommunityContent,
  fetchCommunityContent,
  type CommunityContent,
} from '@/api/community'
import { isAuthError } from '@/api/http'

const contentId = ref('')
const content = ref<CommunityContent | null>(null)
const loading = ref(true)
const errorText = ref('')
const zoomed = ref(false)
const noteModal = ref(false)
const draftNote = ref('')
const offlineSaved = ref(false)
const progress = ref(0)

onLoad((options) => {
  contentId.value = String(options?.id || '')
})

onMounted(async () => {
  if (!contentId.value) {
    errorText.value = '缺少杂志 ID'
    loading.value = false
    return
  }
  await loadContent()
})

async function loadContent() {
  loading.value = true
  errorText.value = ''
  try {
    content.value = await fetchCommunityContent(contentId.value)
    draftNote.value = content.value.note
    offlineSaved.value = Boolean(
      uni.getStorageSync(`ai-fashion-offline-${contentId.value}`),
    )
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复报错（规格 §5）
    if (!isAuthError(error)) {
      errorText.value = error instanceof Error ? error.message : '杂志加载失败'
    }
  } finally {
    loading.value = false
  }
}

function handleScroll(event: any) {
  const scrollTop = Number(event.detail?.scrollTop || 0)
  const scrollHeight = Number(event.detail?.scrollHeight || 0)
  const clientHeight = Number(event.detail?.clientHeight || 0)
  if (!scrollHeight || scrollHeight <= clientHeight) return
  progress.value = Math.round((scrollTop / (scrollHeight - clientHeight)) * 100)
  uni.setStorageSync(`ai-fashion-progress-${contentId.value}`, progress.value)
}

async function saveBookmark() {
  if (!content.value) return
  try {
    const result = await bookmarkCommunityContent(content.value.id, draftNote.value)
    content.value.bookmarked = true
    content.value.note = result.note
    noteModal.value = false
    uni.showToast({ title: '已加入书签', icon: 'success' })
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      uni.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none',
      })
    }
  }
}

function openNotes() {
  draftNote.value = content.value?.note || ''
  noteModal.value = true
}

function downloadOffline() {
  if (!content.value) return
  uni.setStorageSync(
    `ai-fashion-offline-${content.value.id}`,
    JSON.stringify({
      content: content.value,
      savedAt: new Date().toISOString(),
    }),
  )
  offlineSaved.value = true
  uni.showToast({ title: '已离线保存', icon: 'success' })
}

function restoreProgress() {
  const saved = Number(uni.getStorageSync(`ai-fashion-progress-${contentId.value}`) || 0)
  progress.value = Number.isFinite(saved) ? saved : 0
}
</script>

<template>
  <view class="page">
    <PageHeader title="杂志阅读" to="/pages/community/index?tab=magazine" />

    <view v-if="loading" class="state">正在加载杂志...</view>
    <view v-else-if="errorText || !content" class="state error">{{ errorText }}</view>

    <scroll-view
      v-else
      class="body"
      scroll-y
      @scroll="handleScroll"
    >
      <view class="cover-wrap" @tap="zoomed = true">
        <image
          class="cover"
          :src="content.coverUrl"
          mode="aspectFill"
        />
        <view class="cover-mask">
          <text class="month">{{ content.publishedMonth }}</text>
          <view class="cover-title">{{ content.title }}</view>
          <view class="cover-subtitle">{{ content.subtitle }}</view>
        </view>
        <view class="zoom-hint">轻触放大阅读</view>
      </view>

      <view class="article">
        <text class="author">{{ content.authorAvatar }} {{ content.authorName }}</text>
        <view class="intro">{{ content.body.intro }}</view>
        <view
          v-for="(section, index) in content.body.sections"
          :key="`${section.heading}-${index}`"
          class="section"
        >
          <view class="heading">{{ section.heading }}</view>
          <view class="paragraph">{{ section.text }}</view>
        </view>
        <view v-if="content.body.quote" class="quote">{{ content.body.quote }}</view>
      </view>

      <view class="reading-progress">
        <view class="progress-label">已阅读 {{ progress }}%</view>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: `${progress}%` }" />
        </view>
      </view>

      <view class="actions">
        <view class="action" @tap="openNotes">
          {{ content.bookmarked ? '书签与笔记' : '加入书签' }}
        </view>
        <view class="action" :class="{ done: offlineSaved }" @tap="downloadOffline">
          {{ offlineSaved ? '已离线' : '离线保存' }}
        </view>
      </view>
    </scroll-view>

    <view v-if="zoomed" class="zoom-mask" @tap="zoomed = false">
      <image class="zoom-image" :src="content?.coverUrl" mode="aspectFit" />
    </view>

    <view v-if="noteModal" class="note-mask" @tap="noteModal = false">
      <view class="note-sheet" @tap.stop>
        <view class="sheet-title">读书笔记</view>
        <textarea
          v-model="draftNote"
          class="note-input"
          maxlength="2000"
          placeholder="写下这期杂志给你的灵感..."
        />
        <view class="sheet-actions">
          <view class="ghost-button" @tap="noteModal = false">取消</view>
          <view class="primary-button" @tap="saveBookmark">保存书签</view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
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
  color: var(--accent);
}
.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: var(--shadow-float);
}
.cover {
  width: 100%;
  height: 100%;
}
.cover-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 90rpx 30rpx 30rpx;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.68), rgba(0, 0, 0, 0));
  color: #fff;
}
.month {
  font-size: 22rpx;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.82);
}
.cover-title {
  margin-top: 12rpx;
  font-size: 50rpx;
  line-height: 1.2;
  font-weight: 900;
}
.cover-subtitle {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: rgba(255, 255, 255, 0.9);
}
.zoom-hint {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  padding: 8rpx 18rpx;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 20rpx;
}
.article {
  padding: 34rpx 4rpx;
}
.author {
  display: block;
  font-size: 24rpx;
  color: var(--text-2);
}
.intro {
  margin-top: 24rpx;
  font-size: 30rpx;
  line-height: 1.7;
  font-weight: 700;
  color: var(--text-1);
}
.section {
  margin-top: 32rpx;
}
.heading {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--purple-deep);
}
.paragraph {
  margin-top: 12rpx;
  font-size: 27rpx;
  line-height: 1.75;
  color: var(--text-2);
}
.quote {
  margin-top: 36rpx;
  padding: 28rpx;
  border-left: 8rpx solid var(--pink);
  background: rgba(255, 255, 255, 0.72);
  color: var(--text-1);
  font-size: 28rpx;
  line-height: 1.65;
  font-weight: 700;
}
.reading-progress {
  margin: 18rpx 0 30rpx;
}
.progress-label {
  margin-bottom: 10rpx;
  font-size: 22rpx;
  color: var(--text-3);
}
.progress-track {
  height: 10rpx;
  border-radius: var(--radius-pill);
  background: #e8e2ef;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
}
.actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}
.action {
  height: 82rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-1);
  font-size: 26rpx;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.action.done {
  background: var(--mint);
  color: #fff;
}
.zoom-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(15, 10, 22, 0.92);
  display: flex;
  align-items: center;
  justify-content: center;
}
.zoom-image {
  width: 100vw;
  height: 100vh;
}
.note-mask {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  background: rgba(31, 25, 45, 0.42);
}
.note-sheet {
  width: 100%;
  padding: 36rpx 32rpx calc(36rpx + env(safe-area-inset-bottom, 0px));
  border-radius: 28rpx 28rpx 0 0;
  background: var(--surface);
}
.note-input {
  width: 100%;
  height: 260rpx;
  margin-top: 24rpx;
  padding: 22rpx;
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--text-1);
  font-size: 26rpx;
  line-height: 1.5;
}
.sheet-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-top: 24rpx;
}
.ghost-button,
.primary-button {
  height: 82rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: 700;
}
.ghost-button {
  background: var(--surface-soft);
  color: var(--text-2);
}
.primary-button {
  background: var(--brand-gradient);
  color: #fff;
}
</style>
