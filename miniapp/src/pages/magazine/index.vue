<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import SegTabs from '@/components/SegTabs/SegTabs.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { MAGAZINES } from '@/data/mock'

const tab = ref('mag')
const TABS = [
  { key: 'mag', label: '时尚杂志' },
  { key: 'idea', label: '穿搭思路' },
]

const cover = MAGAZINES[0]
const rest = MAGAZINES.slice(1)

// 轻提示
const tip = ref('')
let tipTimer: ReturnType<typeof setTimeout> | null = null
function showTip(msg: string) {
  tip.value = msg
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => (tip.value = ''), 1600)
}
</script>

<template>
  <view class="page">
    <PageHeader title="时尚杂志" to="/home">
      <template #right>
        <text class="avatar">🙋‍♀️</text>
      </template>
    </PageHeader>

    <view class="seg-row">
      <SegTabs v-model="tab" :tabs="TABS" />
    </view>

    <view class="body scroll-y hide-scrollbar">
      <!-- 时尚杂志 -->
      <template v-if="tab === 'mag'">
        <view class="cover" @tap="showTip('敬请期待')">
          <TileImage
            :src="cover.img"
            :from="cover.from"
            :to="cover.to"
            :emoji="cover.emoji"
            ratio="3 / 4"
            rounded="var(--radius-lg)"
          />
          <view class="cover-mask">
            <text class="cover-tag">{{ cover.tag }}</text>
            <view class="cover-title">{{ cover.title }}</view>
            <view class="cover-sub">{{ cover.subtitle }}</view>
          </view>
        </view>

        <view class="grid">
          <view
            v-for="m in rest"
            :key="m.id"
            class="mag-card"
            @tap="showTip('敬请期待')"
          >
            <view class="mag-cover">
              <TileImage
                :src="m.img"
                :from="m.from"
                :to="m.to"
                :emoji="m.emoji"
                ratio="3 / 4"
                rounded="var(--radius)"
              />
              <text class="mag-tag">{{ m.tag }}</text>
            </view>
            <view class="mag-title">{{ m.title }}</view>
            <view class="mag-sub">{{ m.subtitle }}</view>
          </view>
        </view>
      </template>

      <!-- 穿搭思路 -->
      <template v-else>
        <view class="idea-hint">✨ 精选穿搭干货，点开慢慢读</view>
        <view
          v-for="(m, i) in MAGAZINES"
          :key="m.id"
          class="row"
          @tap="showTip('敬请期待')"
        >
          <view class="row-thumb">
            <TileImage
              :src="m.img"
              :from="m.from"
              :to="m.to"
              :emoji="m.emoji"
              ratio="1 / 1"
              rounded="var(--radius)"
            />
          </view>
          <view class="row-text">
            <text class="row-tag">{{ m.tag }}</text>
            <view class="row-title">{{ m.title }} · {{ m.subtitle }}</view>
            <text class="row-meta">第 {{ i + 1 }} 篇 · 3 分钟读完</text>
          </view>
          <text class="row-arrow">›</text>
        </view>
      </template>
    </view>

    <!-- 轻提示 -->
    <transition name="tip">
      <view v-if="tip" class="toast">{{ tip }}</view>
    </transition>
  </view>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.seg-row {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 4rpx 32rpx 20rpx;
}
.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 36rpx;
  background: var(--brand-gradient);
  box-shadow: var(--shadow-card);
}
.body {
  flex: 1;
  min-height: 0;
  padding: 8rpx 32rpx 40rpx;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
/* 可滚动的 flex 列里，子项不要被压缩（否则 3:4 大封面会塌成一条） */
.body > * {
  flex-shrink: 0;
}

/* 主打封面 */
.cover {
  position: relative;
  display: block;
  width: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-float);
  transition: transform 0.15s ease;
}
.cover:active {
  transform: scale(0.98);
}
.cover-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 80rpx 36rpx 36rpx;
  text-align: left;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
}
.cover-tag {
  display: inline-block;
  padding: 6rpx 20rpx;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  font-size: 22rpx;
  font-weight: 700;
}
.cover-title {
  margin: 20rpx 0 8rpx;
  font-size: 52rpx;
  font-weight: 800;
  letter-spacing: 2rpx;
  color: #fff;
}
.cover-sub {
  margin: 0;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.9);
}

/* 2 列网格 */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 28rpx;
}
.mag-card {
  text-align: left;
  transition: transform 0.15s ease;
}
.mag-card:active {
  transform: scale(0.96);
}
.mag-cover {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.mag-tag {
  position: absolute;
  top: 16rpx;
  left: 16rpx;
  padding: 4rpx 16rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.85);
  color: var(--pink-deep);
  font-size: 20rpx;
  font-weight: 700;
}
.mag-title {
  margin: 16rpx 4rpx 4rpx;
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-1);
}
.mag-sub {
  margin: 0 4rpx;
  font-size: 24rpx;
  color: var(--text-2);
  line-height: 1.4;
}

/* 穿搭思路列表 */
.idea-hint {
  margin: 0;
  font-size: 26rpx;
  color: var(--text-2);
}
.row {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 20rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  text-align: left;
  transition: transform 0.15s ease;
}
.row:active {
  transform: scale(0.98);
}
.row-thumb {
  width: 148rpx;
  flex-shrink: 0;
}
.row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.row-tag {
  align-self: flex-start;
  padding: 4rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  color: var(--purple-deep);
  font-size: 20rpx;
  font-weight: 700;
}
.row-title {
  margin: 0;
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.4;
}
.row-meta {
  font-size: 22rpx;
  color: var(--text-3);
}
.row-arrow {
  font-size: 44rpx;
  color: var(--text-3);
  flex-shrink: 0;
}

/* 轻提示 */
.toast {
  position: fixed;
  left: 50%;
  bottom: 120rpx;
  transform: translateX(-50%);
  padding: 20rpx 44rpx;
  border-radius: var(--radius-pill);
  background: rgba(40, 30, 55, 0.86);
  color: #fff;
  font-size: 28rpx;
  font-weight: 600;
  box-shadow: var(--shadow-float);
  z-index: 50;
}
.tip-enter-active,
.tip-leave-active {
  transition: all 0.25s ease;
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20rpx);
}
</style>
