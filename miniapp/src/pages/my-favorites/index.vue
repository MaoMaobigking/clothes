<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import {
  fetchCommunityBookmarks,
  type CommunityContent,
} from '@/api/community'
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
          rounded="12px"
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
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.body {
  flex: 1;
  min-height: 0;
  padding: 12rpx 32rpx 44rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
.state {
  flex: 1;
  padding: 80rpx 24rpx;
  text-align: center;
  color: var(--text-2);
  font-size: 26rpx;
}
.state.error {
  color: #d45a78;
}
.item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 18rpx;
  border-radius: 12px;
  background: var(--surface);
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
  line-height: 1.4;
  font-weight: 800;
  color: var(--text-1);
}
.subtitle {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.4;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
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
