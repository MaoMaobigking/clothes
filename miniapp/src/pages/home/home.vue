<script setup lang="ts">
import { onMounted, computed, ref } from 'vue'
import { AI_FEATURES, OUTFIT_RECOS, WEATHER, LOGO, MODEL_IMAGES } from '@/data/mock'
import { iconForEmoji } from '@/utils/icons'
import { fetchMallProducts, type MallProduct } from '@/api/mall'
import { isAuthError } from '@/utils/request'
import { useProfileStore } from '@/stores/profile'
import { useWishlistStore } from '@/stores/wishlist'

const profile = useProfileStore()
const wishlist = useWishlistStore()

/** 天气数据里存的还是 emoji，查表换成线性图标 */
const weatherIcon = computed(() => iconForEmoji(WEATHER.icon) ?? 'w-cloud')

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
            rounded="28rpx"
            fit="contain"
            class="logo"
          />
          <view>
            <view class="hi">Hi～欢迎回来</view>
            <view class="brand">AI 服装 · 私人穿搭官</view>
          </view>
        </view>
        <view class="weather">
          <UiIcon :name="weatherIcon" :size="36" tone="soft" />
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
          <view v-for="f in AI_FEATURES" :key="f.key" class="feature" @tap="goFeature(f.route)">
            <view class="f-ico">
              <UiIcon :name="f.icon" :size="44" tone="soft" />
            </view>
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
                rounded="24rpx"
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
.body {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
  padding: calc(env(safe-area-inset-top, 12px) + 24rpx) 32rpx 32rpx;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}

.brand-wrap {
  display: flex;
  gap: 20rpx;
  align-items: center;
}

.logo {
  flex-shrink: 0;
  width: 80rpx;
}

.hi {
  margin: 0;
  font-size: 26rpx;
  color: var(--text-2);
}

.brand {
  margin: 12rpx 0 0;
  font-size: 44rpx;
  font-weight: 500;
  color: var(--text-1);
}

/*
 * 首页顶部的微气象胶囊。
 *
 * ⚠️ 原来是 `rgba(255,255,255,0.7)` 写死的半透明白 —— 那是渐变页面底时代的遗留：
 * 半透明是为了透出底下的粉紫渐变。第二轮把页面底换成纯色 #f3f4f6 之后，
 * 半透明白叠在纯灰上只剩一点点脏，既不是玻璃也不是白底。
 *
 * 这批按「顶部微气象走毛玻璃」把它接到 --glass-* 上：同一套半透明白 + 光晕 + 高光边，
 * 和情景页那张天气卡是同一个视觉语言。不用 .card-glass 类是因为那个类带 --radius-lg
 * 的卡片圆角，这里要胶囊。
 */
.weather {
  display: flex;
  gap: 8rpx;
  align-items: center;
  padding: 12rpx 24rpx;
  background-color: var(--glass-bg);
  background-image: var(--glass-tint);
  border: 0.5px solid var(--glass-line);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-glass), var(--glow-inset);
  -webkit-backdrop-filter: var(--glass-blur);
  backdrop-filter: var(--glass-blur);
}

.w-temp {
  font-size: 30rpx;
  font-weight: 700;
  color: var(--text-1);
}

.avatar-card {
  display: flex;
  gap: 28rpx;
  padding: 28rpx;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
}

.avatar-thumb {
  flex-shrink: 0;
  width: 192rpx;
}

.ac-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 12rpx;
}

.ac-title {
  font-size: 32rpx;
  font-weight: 500;
}

.ac-sub {
  flex: 1;
  font-size: 26rpx;
  line-height: 1.5;
  color: var(--text-2);
}

.ac-btn {
  align-self: stretch;
  height: 84rpx;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24rpx;
  margin-top: 24rpx;
}

.feature {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  align-items: center;
  padding: 28rpx 16rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}

.feature:active {
  transform: scale(0.95);
}

.f-ico {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56rpx;
  height: 56rpx;

  /*
   * 不给图标垫色块。设计稿的语言是「照片是主角，图标只做辅助」，
   * 图标一旦套上有色方块就变成模块的主视觉，整页就是一堆彩色贴纸。
   */
}

.f-label {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
}

.f-desc {
  font-size: 20rpx;
  line-height: 1.3;
  color: var(--text-3);
  text-align: center;
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

.picks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
  margin-top: 24rpx;
}
</style>
