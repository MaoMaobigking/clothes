<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import {
  addCommunityComment,
  fetchCommunityContent,
  toggleCommunityInteraction,
  type CommunityComment,
  type CommunityContent,
} from '@/api/community'
import { isAuthError } from '@/utils/request'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { back } from '@/utils/nav'

const contentId = ref('')
const content = ref<CommunityContent | null>(null)
const comments = ref<CommunityComment[]>([])
const { loading, errorText, run } = useAsyncTask({ message: '分享加载失败' })
const commentDraft = ref('')
const sending = ref(false)

onLoad((options) => {
  contentId.value = String(options?.id || '')
})

onMounted(async () => {
  if (!contentId.value) {
    loading.value = false
    errorText.value = '缺少分享 ID'
    return
  }
  await loadContent()
})

async function loadContent() {
  const data = await run(() => fetchCommunityContent(contentId.value))
  if (!data) return
  content.value = data
  comments.value = data.comments || []
}

async function toggleAction(action: 'like' | 'favorite' | 'report') {
  if (!content.value) return
  try {
    const result = await toggleCommunityInteraction(content.value.id, action)
    content.value = result.content
    if (action === 'report' && result.active) {
      uni.showToast({ title: '已举报，将不再向你展示', icon: 'none' })
      setTimeout(() => back('community'), 700)
    }
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      uni.showToast({
        title: error instanceof Error ? error.message : '操作失败',
        icon: 'none',
      })
    }
  }
}

async function sendComment() {
  const value = commentDraft.value.trim()
  if (!value || !content.value || sending.value) return
  sending.value = true
  try {
    const comment = await addCommunityComment(content.value.id, value)
    comments.value.push(comment)
    content.value.commentCount += 1
    commentDraft.value = ''
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      uni.showToast({
        title: error instanceof Error ? error.message : '评论失败',
        icon: 'none',
      })
    }
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <view class="page">
    <PageHeader title="穿搭分享" to="/pages/community/index?tab=share" />

    <view v-if="loading" class="state state-fill">正在加载分享...</view>
    <view v-else-if="errorText || !content" class="state state-fill error">{{ errorText }}</view>

    <view v-else class="body scroll-y hide-scrollbar">
      <image class="hero-image" :src="content.coverUrl" mode="aspectFill" />

      <view class="poster">
        <text class="avatar">{{ content.authorAvatar }}</text>
        <view class="poster-text">
          <view class="name">{{ content.authorName }}</view>
          <view class="time">{{ content.createdAt }}</view>
        </view>
      </view>

      <view class="caption">{{ content.title }}</view>
      <view v-if="content.subtitle" class="description">{{ content.subtitle }}</view>
      <view class="topics">
        <text v-for="topic in content.topics" :key="topic" class="topic">{{ topic }}</text>
      </view>

      <view class="actions">
        <view class="action" :class="{ on: content.liked }" @tap="toggleAction('like')">
          <UiIcon
            class="action-icon"
            name="heart"
            :size="34"
            :tone="content.liked ? 'brand' : 'muted'"
            :stroke-width="content.liked ? 2.6 : 1.7"
          />
          <text>{{ content.likeCount }}</text>
        </view>
        <view class="action" @tap="toggleAction('favorite')">
          <UiIcon
            class="action-icon"
            name="star"
            :size="34"
            :tone="content.favorited ? 'brand' : 'muted'"
            :stroke-width="content.favorited ? 2.6 : 1.7"
          />
          <text>{{ content.favoriteCount }}</text>
        </view>
        <view class="action" @tap="toggleAction('report')">
          <UiIcon class="action-icon" name="flag" :size="34" tone="muted" />
          <text>举报</text>
        </view>
      </view>

      <view class="comment-title">评论 {{ comments.length }}</view>
      <view v-if="!comments.length" class="empty-comment">还没有评论，来说说你的想法</view>
      <view v-for="comment in comments" :key="comment.id" class="comment">
        <text class="comment-avatar">{{ comment.authorAvatar }}</text>
        <view class="comment-body">
          <text class="comment-name">{{ comment.authorName }}</text>
          <view class="comment-text">{{ comment.content }}</view>
        </view>
      </view>

      <view class="comment-input">
        <input v-model="commentDraft" class="input" maxlength="500" placeholder="写下你的评论..." />
        <view class="send" @tap="sendComment">发送</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  padding: 12rpx 32rpx 48rpx;
}

.hero-image {
  width: 100%;
  aspect-ratio: 4 / 5;
  background: var(--surface-soft);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
}

.poster {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-top: 24rpx;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72rpx;
  height: 72rpx;
  font-size: 36rpx;
  background: var(--surface);
  border-radius: 50%;
  box-shadow: var(--shadow-card);
}

.poster-text {
  min-width: 0;
}

.name {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--text-1);
}

.time {
  margin-top: 4rpx;
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.caption {
  margin-top: 24rpx;
  font-size: var(--fs-2xl);
  font-weight: 500;
  line-height: 1.5;
  color: var(--text-1);
}

.description {
  margin-top: 12rpx;
  font-size: var(--fs-base);
  line-height: 1.6;
  color: var(--text-2);
}

.topics {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.topic {
  padding: 8rpx 18rpx;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--purple-deep);
  background: var(--pink-soft);
  border-radius: var(--radius-pill);
}

.actions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12rpx;
  margin-top: 28rpx;
}

.action {
  display: flex;
  gap: 10rpx;
  align-items: center;
  justify-content: center;
  height: 80rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.action.on {
  color: var(--pink-deep);
}

.action-icon {
  font-size: var(--fs-lg);
}

.comment-title {
  margin-top: 36rpx;
  font-size: var(--fs-xl);
  font-weight: 500;
  color: var(--text-1);
}

.empty-comment {
  margin-top: 20rpx;
  font-size: var(--fs-base);
  color: var(--text-3);
}

.comment {
  display: flex;
  gap: 16rpx;
  margin-top: 22rpx;
}

.comment-avatar {
  display: flex;
  flex: 0 0 58rpx;
  align-items: center;
  justify-content: center;
  width: 58rpx;
  height: 58rpx;
  font-size: var(--fs-lg);
  background: var(--surface);
  border-radius: 50%;
}

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-name {
  font-size: var(--fs-sm);
  color: var(--text-3);
}

.comment-text {
  margin-top: 8rpx;
  font-size: var(--fs-base);
  line-height: 1.55;
  color: var(--text-1);
}

.comment-input {
  display: flex;
  gap: 14rpx;
  margin-top: 32rpx;
}

.input {
  flex: 1;
  min-width: 0;
  height: 82rpx;
  padding: 0 22rpx;
  font-size: var(--fs-base);
  color: var(--text-1);
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.send {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 82rpx;
  padding: 0 30rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
}
</style>
