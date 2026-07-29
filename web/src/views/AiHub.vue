<script setup lang="ts">
import { useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import TileImage from '@/components/TileImage.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import { AI_FEATURES, OUTFIT_RECOS } from '@/data/mock'

const router = useRouter()
</script>

<template>
  <div class="page">
    <div class="body scroll-y hide-scrollbar">
      <!-- 顶部大标题 -->
      <header class="hero">
        <h1 class="title">AI 工作流</h1>
        <p class="sub">从形象到穿搭，一站式智能生成 ✨</p>
      </header>

      <!-- 主推 banner -->
      <button class="banner" @click="router.push('/create')">
        <span class="banner-emoji">🧍‍♀️</span>
        <div class="banner-text">
          <span class="banner-title">打造你的专属虚拟形象</span>
          <span class="banner-desc">上传信息，AI 生成会动的你</span>
        </div>
        <span class="banner-go">开始 →</span>
      </button>

      <!-- 功能入口大卡网格 -->
      <section>
        <SectionTitle title="全部功能" />
        <div class="features">
          <button
            v-for="f in AI_FEATURES"
            :key="f.key"
            class="feature"
            @click="router.push(f.route)"
          >
            <span
              class="f-ico"
              :style="{ background: `linear-gradient(140deg, ${f.from}, ${f.to})` }"
            >
              {{ f.emoji }}
            </span>
            <span class="f-label">{{ f.label }}</span>
            <span class="f-desc">{{ f.desc }}</span>
          </button>
        </div>
      </section>

      <!-- 最近灵感（横滑） -->
      <section>
        <SectionTitle title="最近灵感" more="情景模拟" @more="router.push('/scene')" />
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
    </div>

    <BottomNav active="ai" />
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
  flex-direction: column;
  gap: 4px;
}
.title {
  margin: 0;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-1);
}
.sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
}

.banner {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
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
  font-size: 40px;
  flex-shrink: 0;
}
.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.banner-title {
  font-size: 17px;
  font-weight: 800;
}
.banner-desc {
  font-size: 12px;
  opacity: 0.9;
}
.banner-go {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.25);
  padding: 6px 12px;
  border-radius: var(--radius-pill);
}

.features {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 12px;
}
.feature {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px 14px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  box-shadow: var(--shadow-card);
  text-align: left;
  transition: transform 0.15s ease;
}
.feature:active {
  transform: scale(0.96);
}
.f-ico {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display: grid;
  place-items: center;
  font-size: 28px;
}
.f-label {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
}
.f-desc {
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.4;
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
</style>
