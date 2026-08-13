<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import { createCommunityShare } from '@/api/community'

const caption = ref('')
const description = ref('')
const topicsText = ref('')
const imageDataUrl = ref('')
const imageError = ref('')
const submitting = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function choosePhoto() {
  imageError.value = ''
  // #ifdef H5
  fileInput.value?.click()
  // #endif
  // #ifndef H5
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const filePath = res.tempFilePaths?.[0]
      if (!filePath) return
      if (filePath.startsWith('data:')) {
        imageDataUrl.value = filePath
        return
      }
      uni.getFileSystemManager().readFile({
        filePath,
        encoding: 'base64',
        success: (readRes) => {
          const base64 = String(readRes.data || '')
          const extension = filePath.split('.').pop()?.toLowerCase() || 'jpeg'
          const mime = extension === 'png' ? 'png' : extension === 'webp' ? 'webp' : 'jpeg'
          imageDataUrl.value = `data:image/${mime};base64,${base64}`
        },
        fail: () => {
          imageError.value = '读取照片失败，请重新选择'
        },
      })
    },
  })
  // #endif
}

function onH5File(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    imageError.value = '仅支持 JPEG、PNG 或 WebP'
    return
  }
  if (file.size > 8 * 1024 * 1024) {
    imageError.value = '图片不能超过 8MB'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    imageDataUrl.value = String(reader.result || '')
  }
  reader.readAsDataURL(file)
}

function normalizeTopics(): string[] {
  return [
    ...new Set(
      topicsText.value
        .split(/[,，\s]+/)
        .map((topic) => topic.trim())
        .filter(Boolean)
        .map((topic) => (topic.startsWith('#') ? topic : `#${topic}`)),
    ),
  ].slice(0, 5)
}

async function submit() {
  if (!caption.value.trim()) {
    uni.showToast({ title: '请填写分享文案', icon: 'none' })
    return
  }
  if (!imageDataUrl.value) {
    imageError.value = '请上传真实穿搭照片'
    return
  }
  submitting.value = true
  try {
    const share = await createCommunityShare({
      title: caption.value.trim(),
      description: description.value.trim(),
      imageDataUrl: imageDataUrl.value,
      topics: normalizeTopics(),
    })
    uni.redirectTo({
      url: `/pages/share-detail/index?id=${encodeURIComponent(share.id)}`,
    })
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : '发布失败',
      icon: 'none',
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <view class="page">
    <PageHeader title="发布穿搭" to="/pages/community/index?tab=share" />

    <view class="body scroll-y hide-scrollbar">
      <view class="photo-box" @tap="choosePhoto">
        <image
          v-if="imageDataUrl"
          class="photo"
          :src="imageDataUrl"
          mode="aspectFill"
        />
        <view v-else class="photo-placeholder">
          <text class="photo-emoji">📷</text>
          <text class="photo-text">拍照或从相册选择</text>
          <text class="photo-sub">仅支持真实照片，最大 8MB</text>
        </view>
      </view>
      <text v-if="imageError" class="error">{{ imageError }}</text>

      <!-- #ifdef H5 -->
      <input
        ref="fileInput"
        class="hidden-file"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        @change="onH5File"
      />
      <!-- #endif -->

      <view class="field">
        <view class="label">分享文案</view>
        <textarea
          v-model="caption"
          class="textarea"
          maxlength="160"
          placeholder="这套穿搭的思路、颜色或比例亮点..."
        />
        <view class="counter">{{ caption.length }}/160</view>
      </view>

      <view class="field">
        <view class="label">补充说明</view>
        <textarea
          v-model="description"
          class="textarea short"
          maxlength="255"
          placeholder="可补充使用的旧衣、品牌或场合"
        />
      </view>

      <view class="field">
        <view class="label">话题标签</view>
        <input
          v-model="topicsText"
          class="input"
          maxlength="120"
          placeholder="#通勤穿搭 #旧衣改造，用逗号或空格分隔"
        />
        <view class="hint">最多添加 5 个话题</view>
      </view>

      <view class="submit" :class="{ disabled: submitting }" @tap="submit">
        {{ submitting ? '发布中...' : '发布到穿搭广场' }}
      </view>
    </view>
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
  padding: 12rpx 32rpx 48rpx;
}
.photo-box {
  width: 100%;
  aspect-ratio: 4 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: var(--surface);
  box-shadow: var(--shadow-card);
}
.photo {
  width: 100%;
  height: 100%;
}
.photo-placeholder {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: var(--text-2);
}
.photo-emoji {
  font-size: 76rpx;
}
.photo-text {
  font-size: 28rpx;
  font-weight: 700;
}
.photo-sub {
  font-size: 22rpx;
  color: var(--text-3);
}
.error {
  display: block;
  margin-top: 12rpx;
  color: #d45a78;
  font-size: 22rpx;
}
.hidden-file {
  position: fixed;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}
.field {
  margin-top: 28rpx;
}
.label {
  margin-bottom: 12rpx;
  font-size: 25rpx;
  font-weight: 800;
  color: var(--text-1);
}
.textarea,
.input {
  width: 100%;
  padding: 22rpx;
  border-radius: 12px;
  background: var(--surface);
  color: var(--text-1);
  font-size: 26rpx;
  line-height: 1.5;
  box-shadow: var(--shadow-card);
}
.textarea {
  height: 210rpx;
}
.textarea.short {
  height: 150rpx;
}
.input {
  height: 88rpx;
}
.counter {
  margin-top: 8rpx;
  text-align: right;
  font-size: 20rpx;
  color: var(--text-3);
}
.hint {
  margin-top: 8rpx;
  font-size: 20rpx;
  color: var(--text-3);
}
.submit {
  height: 92rpx;
  margin-top: 34rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 28rpx;
  font-weight: 800;
  box-shadow: var(--shadow-float);
}
.submit.disabled {
  opacity: 0.65;
}
</style>
