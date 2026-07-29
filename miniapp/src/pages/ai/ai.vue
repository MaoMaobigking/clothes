<script setup lang="ts">
import BottomNav from '@/components/BottomNav/BottomNav.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import SectionTitle from '@/components/SectionTitle/SectionTitle.vue'
import { AI_FEATURES, OUTFIT_RECOS } from '@/data/mock'

function navigateTo(url: string) {
  uni.navigateTo({ url })
}
</script>

<template>
  <view class="page">
    <view class="body scroll-y hide-scrollbar">
      <!-- 顶部大标题 -->
      <view class="hero">
        <text class="title">AI 工作流</text>
        <text class="sub">从形象到穿搭，一站式智能生成 ✨</text>
      </view>

      <!-- 主推 banner -->
      <view class="banner" @tap="navigateTo('/pages/create/index')">
        <text class="banner-emoji">🧍‍♀️</text>
        <view class="banner-text">
          <text class="banner-title">打造你的专属虚拟形象</text>
          <text class="banner-desc">上传信息，AI 生成会动的你</text>
        </view>
        <text class="banner-go">开始 →</text>
      </view>

      <!-- 功能入口大卡网格 -->
      <view>
        <SectionTitle title="全部功能" />
        <view class="features">
          <view
            v-for="f in AI_FEATURES"
            :key="f.key"
            class="feature"
            @tap="navigateTo(f.route)"
          >
            <text
              class="f-ico"
              :style="{ background: `linear-gradient(140deg, ${f.from}, ${f.to})` }"
            >
              {{ f.emoji }}
            </text>
            <text class="f-label">{{ f.label }}</text>
            <text class="f-desc">{{ f.desc }}</text>
          </view>
        </view>
      </view>

      <!-- 最近灵感（横滑） -->
      <view>
        <SectionTitle title="最近灵感" more="情景模拟" @more="navigateTo('/pages/scene/index')" />
        <view class="recos hide-scrollbar">
          <view v-for="o in OUTFIT_RECOS" :key="o.id" class="reco">
            <view class="reco-pieces">
              <TileImage
                v-for="(p, i) in o.pieces.slice(0, 4)"
                :key="i"
                :src="p.img"
                :from="p.from"
                :to="p.to"
                :emoji="p.emoji"
                ratio="1 / 1"
                rounded="24rpx"
              />
            </view>
            <text class="reco-title">{{ o.title }}</text>
          </view>
        </view>
      </view>
    </view>

    <BottomNav active="ai" />
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
  padding: calc(env(safe-area-inset-top, 24rpx) + 24rpx) 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 36rpx;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.title {
  margin: 0;
  font-size: 48rpx;
  font-weight: 800;
  color: var(--text-1);
}
.sub {
  margin: 0;
  font-size: 26rpx;
  color: var(--text-2);
}

.banner {
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  border-radius: var(--radius-lg);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-float);
  color: var(--text-on-brand);
  text-align: left;
  transition: transform 0.15s ease;
}
.banner:active {
  transform: scale(0.98);
}
.banner-emoji {
  font-size: 80rpx;
  flex-shrink: 0;
}
.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.banner-title {
  font-size: 34rpx;
  font-weight: 800;
}
.banner-desc {
  font-size: 24rpx;
  opacity: 0.9;
}
.banner-go {
  flex-shrink: 0;
  font-size: 26rpx;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.25);
  padding: 12rpx 24rpx;
  border-radius: var(--radius-pill);
}

.features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-top: 24rpx;
}
.feature {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 32rpx 28rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16rpx;
  box-shadow: var(--shadow-card);
  text-align: left;
  transition: transform 0.15s ease;
}
.feature:active {
  transform: scale(0.96);
}
.f-ico {
  width: 104rpx;
  height: 104rpx;
  border-radius: 32rpx;
  display: grid;
  place-items: center;
  font-size: 56rpx;
}
.f-label {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-1);
}
.f-desc {
  font-size: 22rpx;
  color: var(--text-3);
  line-height: 1.4;
}

.recos {
  display: flex;
  gap: 24rpx;
  overflow-x: auto;
  margin-top: 24rpx;
  padding-bottom: 8rpx;
}
.reco {
  flex: 0 0 400rpx;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 24rpx;
  box-shadow: var(--shadow-card);
}
.reco-pieces {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}
.reco-title {
  margin: 20rpx 4rpx 4rpx;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
}
</style>
