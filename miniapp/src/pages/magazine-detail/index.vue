<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { bookmarkCommunityContent, fetchCommunityContent, type CommunityContent } from '@/api/community'
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
  // 恢复上次读到的位置。这行原先漏了：滚动时进度一直在写 storage（见 onScroll），
  // 但 restoreProgress 从未被调用，等于只写不读，重进文章永远显示 0%。
  restoreProgress()
})

async function loadContent() {
  loading.value = true
  errorText.value = ''
  try {
    content.value = await fetchCommunityContent(contentId.value)
    draftNote.value = content.value.note
    offlineSaved.value = Boolean(uni.getStorageSync(`ai-fashion-offline-${contentId.value}`))
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

    <scroll-view v-else class="body" scroll-y @scroll="handleScroll">
      <view class="cover-wrap" @tap="zoomed = true">
        <image class="cover" :src="content.coverUrl" mode="aspectFill" />
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
        <view v-for="(section, index) in content.body.sections" :key="`${section.heading}-${index}`" class="section">
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
        <textarea v-model="draftNote" class="note-input" maxlength="2000" placeholder="写下这期杂志给你的灵感..." />
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
  font-size: 26rpx;
  color: var(--text-2);
  text-align: center;
}

.state.error {
  color: var(--danger);
}

.cover-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
}

.cover {
  width: 100%;
  height: 100%;
}

.cover-mask {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 90rpx 30rpx 30rpx;
  color: #fff;
  background: linear-gradient(to top, rgb(0 0 0 / 68%), rgb(0 0 0 / 0%));
}

.month {
  font-size: 22rpx;
  font-weight: 700;
  color: rgb(255 255 255 / 82%);
}

.cover-title {
  margin-top: 12rpx;
  font-size: 50rpx;
  font-weight: 700;
  line-height: 1.2;
}

.cover-subtitle {
  margin-top: 10rpx;
  font-size: 26rpx;
  color: rgb(255 255 255 / 90%);
}

.zoom-hint {
  position: absolute;
  top: 20rpx;
  right: 20rpx;
  padding: 8rpx 18rpx;
  font-size: 20rpx;
  color: #fff;
  background: rgb(0 0 0 / 45%);
  border-radius: var(--radius-pill);
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
  font-weight: 700;
  line-height: 1.7;
  color: var(--text-1);
}

.section {
  margin-top: 32rpx;
}

.heading {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--purple-deep);
}

.paragraph {
  margin-top: 12rpx;
  font-size: 27rpx;
  line-height: 1.75;
  color: var(--text-2);
}

.quote {
  padding: 28rpx;
  margin-top: 36rpx;
  font-size: 28rpx;
  font-weight: 700;
  line-height: 1.65;
  color: var(--text-1);
  background: rgb(255 255 255 / 72%);
  border-left: 8rpx solid var(--pink);
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
  overflow: hidden;
  background: #e8e2ef;
  border-radius: var(--radius-pill);
}

.progress-fill {
  height: 100%;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
}

.actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.action {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 82rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.action.done {
  color: #fff;
  background: var(--mint);
}

.zoom-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgb(15 10 22 / 92%);
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
  background: rgb(31 25 45 / 42%);
}

.note-sheet {
  width: 100%;
  padding: 36rpx 32rpx calc(36rpx + env(safe-area-inset-bottom, 0px));
  background: var(--surface);
  border-radius: var(--radius-lg) 28rpx 0 0;
}

.note-input {
  width: 100%;
  height: 260rpx;
  padding: 22rpx;
  margin-top: 24rpx;
  font-size: 26rpx;
  line-height: 1.5;
  color: var(--text-1);
  background: var(--surface-soft);
  border-radius: var(--radius);
}

.sheet-actions {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin-top: 24rpx;
}

.ghost-button,
.primary-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 82rpx;
  font-size: 26rpx;
  font-weight: 700;
  border-radius: var(--radius-pill);
}

.ghost-button {
  color: var(--text-2);
  background: var(--surface-soft);
}

.primary-button {
  color: #fff;
  background: var(--brand-gradient);
}
</style>
