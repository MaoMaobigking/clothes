<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchCommunityBookmarks, type CommunityContent } from '@/api/community'
import { isAuthError } from '@/api/http'

const items = ref<CommunityContent[]>([])
const loading = ref(true)
const errorText = ref('')

onMounted(async () => {
  try {
    items.value = await fetchCommunityBookmarks()
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复报错（规格 §5）
    if (!isAuthError(error)) {
      errorText.value = error instanceof Error ? error.message : '收藏加载失败'
    }
  } finally {
    loading.value = false
  }
})

function openItem(item: CommunityContent) {
  const route =
    item.type === 'magazine'
      ? '/pages/magazine-detail/index'
      : item.type === 'tutorial'
        ? '/pages/teach-detail/index'
        : '/pages/share-detail/index'
  uni.navigateTo({ url: `${route}?id=${encodeURIComponent(item.id)}` })
}
</script>

<template>
  <view class="page">
    <PageHeader title="我的收藏" to="/pages/me/me" />

    <view v-if="loading" class="state">正在读取收藏...</view>
    <view v-else-if="errorText" class="state error">{{ errorText }}</view>
    <view v-else-if="!items.length" class="state">还没有收藏内容</view>

    <view v-else class="body scroll-y hide-scrollbar">
      <view v-for="item in items" :key="item.id" class="item" @tap="openItem(item)">
        <TileImage
          :src="item.coverUrl"
          :emoji="item.authorAvatar"
          from="#f3e0d6"
          to="#c98fb0"
          ratio="1 / 1"
          rounded="24rpx"
          class="thumb"
        />
        <view class="item-text">
          <text class="type">{{ item.type === 'magazine' ? '杂志' : item.type === 'tutorial' ? '教程' : '分享' }}</text>
          <view class="title">{{ item.title }}</view>
          <view class="subtitle">{{ item.subtitle }}</view>
          <text v-if="item.note" class="note">笔记：{{ item.note }}</text>
        </view>
        <text class="arrow">›</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.body {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 18rpx;
  min-height: 0;
  padding: 12rpx 32rpx 44rpx;
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

.item {
  display: flex;
  gap: 20rpx;
  align-items: center;
  padding: 18rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.thumb {
  flex: 0 0 156rpx;
  width: 156rpx;
}

.item-text {
  flex: 1;
  min-width: 0;
}

.type {
  font-size: 20rpx;
  font-weight: 700;
  color: var(--purple-deep);
}

.title {
  margin-top: 8rpx;
  font-size: 27rpx;
  font-weight: 500;
  line-height: 1.4;
  color: var(--text-1);
}

.subtitle {
  display: -webkit-box;
  margin-top: 6rpx;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: 22rpx;
  line-height: 1.4;
  color: var(--text-2);
  -webkit-box-orient: vertical;
}

.note {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: var(--mint-deep);
}

.arrow {
  flex-shrink: 0;
  font-size: 40rpx;
  color: var(--text-3);
}
</style>
