<script setup lang="ts">
import { onMounted, ref } from 'vue'
import BottomNav from '@/components/BottomNav/BottomNav.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import SectionTitle from '@/components/SectionTitle/SectionTitle.vue'
import ProductCard from '@/components/ProductCard/ProductCard.vue'
import { AI_FEATURES, OUTFIT_RECOS, WEATHER, LOGO, MODEL_IMAGES } from '@/data/mock'
import { fetchMallProducts, type MallProduct } from '@/api/mall'
import { isAuthError } from '@/api/http'
import { useProfileStore } from '@/stores/profile'
import { useWishlistStore } from '@/stores/wishlist'

const profile = useProfileStore()
const wishlist = useWishlistStore()

// 「为你精选」取真实商城目录（scene_catalog），不再是 mock 商品，
// 点进去看到的价格和淘口令与商城页一致（规格 §4.4）
const picks = ref<MallProduct[]>([])

onMounted(async () => {
  try {
    const data = await fetchMallProducts()
    picks.value = data.items.slice(0, 4)
  } catch (error) {
    // 未登录时请求层已跳登录页，首页安静留白即可
    if (!isAuthError(error)) picks.value = []
  }
})

function createAvatar() {
  uni.navigateTo({ url: '/pages/body-create/index' })
}

function goFeature(route: string) {
  uni.navigateTo({ url: route })
}

function goScene() {
  uni.navigateTo({ url: '/pages/scene/index' })
}

function goMall() {
  uni.switchTab({ url: '/pages/mall/mall' })
}
</script>

<template>
  <view class="page">
    <view class="body scroll-y hide-scrollbar">
      <!-- 顶部品牌区 + 天气 -->
      <view class="hero">
        <view class="brand-wrap">
          <TileImage
            :src="LOGO"
            from="#8fe3d8"
            to="#4fc7bb"
            emoji="👗"
            ratio="1 / 1"
            rounded="14px"
            fit="contain"
            class="logo"
          />
          <view>
            <view class="hi">Hi～欢迎回来 👋</view>
            <view class="brand">AI 服装 · 私人穿搭官</view>
          </view>
        </view>
        <view class="weather">
          <text class="w-ico">{{ WEATHER.icon }}</text>
          <text class="w-temp">{{ WEATHER.temp }}°</text>
        </view>
      </view>

      <!-- 我的虚拟形象 -->
      <view class="avatar-card">
        <TileImage
          :src="MODEL_IMAGES.front"
          from="#ffd6e8"
          to="#c9b8ff"
          emoji="🧍‍♀️"
          ratio="1 / 1"
          rounded="var(--radius)"
          class="avatar-thumb"
        />
        <view class="ac-text">
          <text class="ac-title">我的虚拟形象</text>
          <text class="ac-sub">{{ profile.summary || '还没创建，先做个身形测试吧' }}</text>
          <view class="btn btn-primary ac-btn" @tap="createAvatar">
            {{ profile.isComplete ? '进入个性化创建' : '开始个性化创建' }}
          </view>
        </view>
      </view>

      <!-- AI 功能入口 -->
      <view>
        <SectionTitle title="AI 工作流" />
        <view class="features">
          <view
            v-for="f in AI_FEATURES"
            :key="f.key"
            class="feature"
            @tap="goFeature(f.route)"
          >
            <text class="f-ico" :style="{ background: `linear-gradient(140deg, ${f.from}, ${f.to})` }">
              {{ f.emoji }}
            </text>
            <text class="f-label">{{ f.label }}</text>
            <text class="f-desc">{{ f.desc }}</text>
          </view>
        </view>
      </view>

      <!-- 今日 AI 搭配推荐（横滑） -->
      <view>
        <SectionTitle title="今日搭配推荐" more="情景模拟" @more="goScene" />
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
                rounded="12px"
              />
            </view>
            <view class="reco-title">{{ o.title }}</view>
          </view>
        </view>
      </view>

      <!-- 为你精选（商城） -->
      <view>
        <SectionTitle title="为你精选" more="去商城" @more="goMall" />
        <view class="picks">
          <ProductCard
            v-for="p in picks"
            :key="p.id"
            :title="p.name"
            :price="p.price"
            :emoji="p.emoji"
            :from="p.from"
            :to="p.to"
            :src="p.imageUrl"
            :fav="wishlist.has(p.id)"
            @fav="wishlist.toggle(p.id)"
            @click="goMall"
          />
        </view>
      </view>
    </view>

    <BottomNav active="home" />
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
  padding: calc(env(safe-area-inset-top, 12px) + 24rpx) 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 36rpx;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.brand-wrap {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.logo {
  width: 80rpx;
  flex-shrink: 0;
}
.hi {
  margin: 0;
  font-size: 26rpx;
  color: var(--text-2);
}
.brand {
  margin: 12rpx 0 0;
  font-size: 44rpx;
  font-weight: 800;
  color: var(--text-1);
}
.weather {
  display: flex;
  align-items: center;
  gap: 8rpx;
  background: rgba(255, 255, 255, 0.7);
  padding: 12rpx 24rpx;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}
.w-ico {
  font-size: 36rpx;
}
.w-temp {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-1);
}

.avatar-card {
  display: flex;
  gap: 28rpx;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 28rpx;
  box-shadow: var(--shadow-card);
}
.avatar-thumb {
  width: 192rpx;
  flex-shrink: 0;
}
.ac-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.ac-title {
  font-size: 32rpx;
  font-weight: 800;
}
.ac-sub {
  flex: 1;
  font-size: 26rpx;
  color: var(--text-2);
  line-height: 1.5;
}
.ac-btn {
  height: 84rpx;
  align-self: stretch;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
  margin-top: 24rpx;
}
.feature {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 28rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.feature:active {
  transform: scale(0.95);
}
.f-ico {
  width: 92rpx;
  height: 92rpx;
  border-radius: 28rpx;
  display: grid;
  place-items: center;
  font-size: 48rpx;
}
.f-label {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
}
.f-desc {
  font-size: 20rpx;
  color: var(--text-3);
  text-align: center;
  line-height: 1.3;
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

.picks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-top: 24rpx;
}
</style>
