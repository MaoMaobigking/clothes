<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import SectionTitle from '@/components/SectionTitle/SectionTitle.vue'
import { POSTS, HOT_TOPICS } from '@/data/mock'

// 精选 banner：取前 2 条
const banners = POSTS.slice(0, 2)

// 瀑布感：给每条帖子分配一个高度比例（循环取用）
const RATIOS = ['3 / 4', '1 / 1', '4 / 5', '3 / 5', '5 / 6', '4 / 3']
function ratioOf(index: number): string {
  return RATIOS[index % RATIOS.length]
}

// 本地点赞：记录被点亮的帖子 id（不写回 mock）
const liked = ref<Set<string>>(new Set())
function isLiked(id: string): boolean {
  return liked.value.has(id)
}
function toggleLike(id: string): void {
  const next = new Set(liked.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  liked.value = next
}
function likeCount(id: string, base: number): number {
  return base + (liked.value.has(id) ? 1 : 0)
}
</script>

<template>
  <view class="page">
    <PageHeader title="时尚社群" to="/home">
      <template #right>
        <view class="city">杭州 ▾</view>
      </template>
    </PageHeader>

    <view class="body scroll-y hide-scrollbar">
      <!-- 搜索框（仅样式） -->
      <view class="search">
        <text class="s-ico">🔍</text>
        <text class="s-ph">搜索穿搭灵感、话题、达人</text>
      </view>

      <!-- 热门推荐 banner -->
      <view>
        <SectionTitle title="热门推荐" />
        <view class="banners">
          <view v-for="b in banners" :key="b.id" class="banner">
            <view class="b-text">
              <text class="b-topic">#{{ b.topic }}</text>
              <view class="b-title">{{ b.text }}</view>
              <text class="b-author">{{ b.avatar }} {{ b.author }}</text>
            </view>
            <TileImage
              :src="b.img"
              :from="b.from"
              :to="b.to"
              :emoji="b.emoji"
              ratio="1 / 1"
              rounded="var(--radius)"
              class="b-img"
            />
          </view>
        </view>
      </view>

      <!-- 热门话题 chips（横滑） -->
      <view>
        <SectionTitle title="热门话题" />
        <view class="topics hide-scrollbar">
          <text v-for="t in HOT_TOPICS" :key="t" class="chip">{{ t }}</text>
        </view>
      </view>

      <!-- 信息流：瀑布流 2 列 -->
      <view>
        <SectionTitle title="穿搭广场" />
        <view class="feed">
          <view v-for="(p, i) in POSTS" :key="p.id" class="post">
            <TileImage
              :src="p.img"
              :from="p.from"
              :to="p.to"
              :emoji="p.emoji"
              :ratio="ratioOf(i)"
              rounded="var(--radius)"
            />
            <view class="p-text">{{ p.text }}</view>
            <view class="p-foot">
              <view class="p-author">
                <text class="p-avatar">{{ p.avatar }}</text>
                <text class="p-name">{{ p.author }}</text>
              </view>
              <view class="p-stats">
                <view
                  class="p-like"
                  :class="{ on: isLiked(p.id) }"
                  @tap="toggleLike(p.id)"
                >
                  {{ isLiked(p.id) ? '❤️' : '🤍' }} {{ likeCount(p.id, p.likes) }}
                </view>
                <text class="p-cmt">💬 {{ p.comments }}</text>
              </view>
            </view>
          </view>
        </view>
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
  padding: 24rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.city {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--pink-deep);
  background: rgba(255, 255, 255, 0.75);
  border-radius: var(--radius-pill);
  padding: 12rpx 24rpx;
  box-shadow: var(--shadow-card);
  white-space: nowrap;
}

/* 搜索框 */
.search {
  display: flex;
  align-items: center;
  gap: 16rpx;
  background: var(--surface);
  border-radius: var(--radius-pill);
  padding: 22rpx 32rpx;
  box-shadow: var(--shadow-card);
}
.s-ico {
  font-size: 30rpx;
}
.s-ph {
  font-size: 28rpx;
  color: var(--text-3);
}

/* 热门话题 chips */
.topics {
  display: flex;
  gap: 20rpx;
  overflow-x: auto;
  margin-top: 20rpx;
  padding-bottom: 4rpx;
}
.chip {
  flex: 0 0 auto;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--purple-deep);
  background: var(--surface-soft);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 14rpx 28rpx;
  white-space: nowrap;
}

/* 精选 banner */
.banners {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  margin-top: 20rpx;
}
.banner {
  display: flex;
  align-items: stretch;
  gap: 24rpx;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 24rpx;
  box-shadow: var(--shadow-card);
}
.b-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.b-topic {
  font-size: 24rpx;
  font-weight: 700;
  color: var(--pink-deep);
}
.b-title {
  margin: 0;
  flex: 1;
  font-size: 30rpx;
  font-weight: 700;
  line-height: 1.5;
  color: var(--text-1);
}
.b-author {
  font-size: 24rpx;
  color: var(--text-2);
}
.b-img {
  width: 184rpx;
  flex-shrink: 0;
}

/* 瀑布流信息流 */
.feed {
  column-count: 2;
  column-gap: 24rpx;
  margin-top: 20rpx;
}
.post {
  break-inside: avoid;
  display: inline-block;
  width: 100%;
  margin-bottom: 24rpx;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16rpx;
  box-shadow: var(--shadow-card);
}
.p-text {
  margin: 16rpx 4rpx 0;
  font-size: 26rpx;
  line-height: 1.5;
  color: var(--text-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.p-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin: 16rpx 4rpx 4rpx;
}
.p-author {
  display: flex;
  align-items: center;
  gap: 10rpx;
  min-width: 0;
}
.p-avatar {
  font-size: 30rpx;
}
.p-name {
  font-size: 22rpx;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.p-stats {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
}
.p-like {
  font-size: 22rpx;
  color: var(--text-2);
  transition: transform 0.12s ease;
}
.p-like.on {
  color: var(--pink-deep);
}
.p-like:active {
  transform: scale(1.2);
}
.p-cmt {
  font-size: 22rpx;
  color: var(--text-3);
}
</style>
