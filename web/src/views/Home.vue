<script setup lang="ts">
import { useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import TileImage from '@/components/TileImage.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import ProductCard from '@/components/ProductCard.vue'
import { AI_FEATURES, OUTFIT_RECOS, MALL_PRODUCTS, WEATHER, LOGO, MODEL_IMAGES } from '@/data/mock'
import { useProfileStore } from '@/stores/profile'
import { useCartStore } from '@/stores/cart'

const router = useRouter()
const profile = useProfileStore()
const cart = useCartStore()

const picks = MALL_PRODUCTS.slice(0, 4)

function createAvatar() {
  if (profile.isComplete) router.push('/create')
  else router.push('/test')
}
</script>

<template>
  <div class="page">
    <div class="body scroll-y hide-scrollbar">
      <!-- 顶部品牌区 + 天气 -->
      <header class="hero">
        <div class="brand-wrap">
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
          <div>
            <p class="hi">Hi～欢迎回来 👋</p>
            <h1 class="brand">AI 服装 · 私人穿搭官</h1>
          </div>
        </div>
        <div class="weather">
          <span class="w-ico">{{ WEATHER.icon }}</span>
          <span class="w-temp">{{ WEATHER.temp }}°</span>
        </div>
      </header>

      <!-- 我的虚拟形象 -->
      <section class="avatar-card">
        <TileImage
          :src="MODEL_IMAGES.front"
          from="#ffd6e8"
          to="#c9b8ff"
          emoji="🧍‍♀️"
          ratio="1 / 1"
          rounded="var(--radius)"
          class="avatar-thumb"
        />
        <div class="ac-text">
          <span class="ac-title">我的虚拟形象</span>
          <span class="ac-sub">{{ profile.summary || '还没创建，先做个身形测试吧' }}</span>
          <button class="btn btn-primary ac-btn" @click="createAvatar">
            {{ profile.isComplete ? '进入个性化创建' : '开始个性化创建' }}
          </button>
        </div>
      </section>

      <!-- AI 功能入口 -->
      <section>
        <SectionTitle title="AI 工作流" />
        <div class="features">
          <button
            v-for="f in AI_FEATURES"
            :key="f.key"
            class="feature"
            @click="router.push(f.route)"
          >
            <span class="f-ico" :style="{ background: `linear-gradient(140deg, ${f.from}, ${f.to})` }">
              {{ f.emoji }}
            </span>
            <span class="f-label">{{ f.label }}</span>
            <span class="f-desc">{{ f.desc }}</span>
          </button>
        </div>
      </section>

      <!-- 今日 AI 搭配推荐（横滑） -->
      <section>
        <SectionTitle title="今日搭配推荐" more="情景模拟" @more="router.push('/scene')" />
        <div class="recos hide-scrollbar">
          <div v-for="o in OUTFIT_RECOS" :key="o.id" class="reco">
            <div class="reco-pieces">
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
            </div>
            <p class="reco-title">{{ o.title }}</p>
          </div>
        </div>
      </section>

      <!-- 为你精选（商城） -->
      <section>
        <SectionTitle title="为你精选" more="去商城" @more="router.push('/mall')" />
        <div class="picks">
          <ProductCard
            v-for="p in picks"
            :key="p.id"
            :title="p.name"
            :price="p.price"
            :emoji="p.emoji"
            :from="p.from"
            :to="p.to"
            :src="p.img"
            :fav="cart.has(p.id)"
            @fav="cart.toggle(p.id)"
            @click="router.push('/mall')"
          />
        </div>
      </section>
    </div>

    <BottomNav active="home" />
  </div>
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
  padding: calc(env(safe-area-inset-top, 12px) + 12px) 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
}
.brand-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.logo {
  width: 40px;
  flex-shrink: 0;
}
.hi {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
}
.brand {
  margin: 6px 0 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-1);
}
.weather {
  display: flex;
  align-items: center;
  gap: 4px;
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}
.w-ico {
  font-size: 18px;
}
.w-temp {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}

.avatar-card {
  display: flex;
  gap: 14px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-card);
}
.avatar-thumb {
  width: 96px;
  flex-shrink: 0;
}
.ac-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ac-title {
  font-size: 16px;
  font-weight: 800;
}
.ac-sub {
  flex: 1;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}
.ac-btn {
  height: 42px;
  align-self: stretch;
}

.features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.feature {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 14px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.feature:active {
  transform: scale(0.95);
}
.f-ico {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  font-size: 24px;
}
.f-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}
.f-desc {
  font-size: 10px;
  color: var(--text-3);
  text-align: center;
  line-height: 1.3;
}

.recos {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  margin-top: 12px;
  padding-bottom: 4px;
}
.reco {
  flex: 0 0 200px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 12px;
  box-shadow: var(--shadow-card);
}
.reco-pieces {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.reco-title {
  margin: 10px 2px 2px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}

.picks {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 12px;
}
</style>
