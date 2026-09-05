<script setup lang="ts">
import { AI_FEATURES } from '@/constants/ui'
import { OUTFIT_RECOS } from '@/mocks/demo'

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
        <text class="sub">从形象到穿搭，一站式智能生成</text>
      </view>

      <!-- 主推 banner -->
      <view class="banner" @tap="navigateTo('/pages/body-create/index')">
        <UiIcon class="banner-emoji" name="me" :size="80" tone="white" :stroke-width="1.3" />
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
          <view v-for="f in AI_FEATURES" :key="f.key" class="feature" @tap="navigateTo(f.route)">
            <text class="f-ico" :style="{ background: `linear-gradient(140deg, ${f.from}, ${f.to})` }">
              <UiIcon :name="f.icon" :size="44" tone="dark" />
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
.body {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
  padding: calc(env(safe-area-inset-top, 24rpx) + 24rpx) 32rpx 32rpx;
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.title {
  margin: 0;
  font-size: 48rpx;
  font-weight: 500;
  color: var(--text-1);
}

.sub {
  margin: 0;
  font-size: 26rpx;
  color: var(--text-2);
}

.banner {
  display: flex;
  gap: 24rpx;
  align-items: center;
  padding: 32rpx;
  color: var(--text-on-brand);
  text-align: left;
  background: var(--brand-gradient);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
  transition: transform 0.15s ease;
}

.banner:active {
  transform: scale(0.98);
}

.banner-emoji {
  flex-shrink: 0;
  font-size: 80rpx;
}

.banner-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8rpx;
}

.banner-title {
  font-size: 34rpx;
  font-weight: 500;
}

.banner-desc {
  font-size: 24rpx;
  opacity: 0.9;
}

.banner-go {
  flex-shrink: 0;
  padding: 12rpx 24rpx;
  font-size: 26rpx;
  font-weight: 700;
  background: rgb(255 255 255 / 25%);
  border-radius: var(--radius-pill);
}

.features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-top: 24rpx;
}

.feature {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  align-items: flex-start;
  padding: 32rpx 28rpx;
  text-align: left;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}

.feature:active {
  transform: scale(0.96);
}

.f-ico {
  display: grid;
  place-items: center;
  width: 104rpx;
  height: 104rpx;
  font-size: 56rpx;
  border-radius: var(--radius-lg);
}

.f-label {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-1);
}

.f-desc {
  font-size: 22rpx;
  line-height: 1.4;
  color: var(--text-3);
}

.recos {
  display: flex;
  gap: 24rpx;
  padding-bottom: 8rpx;
  margin-top: 24rpx;
  overflow-x: auto;
}

.reco {
  flex: 0 0 400rpx;
  padding: 24rpx;
  background: var(--surface);
  border-radius: var(--radius);
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
