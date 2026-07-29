<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import ProductCard from '@/components/ProductCard.vue'
import { MALL_CATEGORIES, MALL_PRODUCTS, type MallProduct } from '@/data/mock'
import { useCartStore } from '@/stores/cart'
import MallDetailSheet from './mall/MallDetailSheet.vue'

const router = useRouter()
const cart = useCartStore()

const activeCat = ref(MALL_CATEGORIES[0].key)
const detail = ref<MallProduct | null>(null)

const catLabel = computed(
  () => MALL_CATEGORIES.find((c) => c.key === activeCat.value)?.label ?? '商城',
)

const filtered = computed(() =>
  MALL_PRODUCTS.filter((p) => p.category === activeCat.value),
)

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | null = null
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1600)
}

function buyAll() {
  const items = filtered.value
  items.forEach((p) => cart.add(p.id))
  showToast(`已把 ${items.length} 件${catLabel.value}加入购物车 🛒`)
}

function addFromSheet() {
  if (!detail.value) return
  cart.add(detail.value.id)
  showToast('已加入购物车 🛒')
  detail.value = null
}
</script>

<template>
  <div class="page">
    <!-- 顶部：分类名标题 + 购物车 -->
    <header class="topbar">
      <div class="row1">
        <h1 class="title">{{ catLabel }}</h1>
        <button class="cart" aria-label="购物车" @click="showToast('购物车功能开发中～')">
          🛒
          <span v-if="cart.count" class="badge">{{ cart.count }}</span>
        </button>
      </div>
      <div class="search">
        <span class="s-ico">🔍</span>
        <span class="s-ph">搜首饰、包袋、好物…</span>
      </div>
    </header>

    <!-- 分类横向 tab -->
    <nav class="cats hide-scrollbar">
      <button
        v-for="c in MALL_CATEGORIES"
        :key="c.key"
        class="cat"
        :class="{ on: activeCat === c.key }"
        @click="activeCat = c.key"
      >
        {{ c.label }}
      </button>
    </nav>

    <!-- 商品网格 -->
    <main class="body scroll-y hide-scrollbar">
      <!-- 系列 banner -->
      <section class="banner">
        <div class="banner-txt">
          <p class="b-cn">现货系列</p>
          <p class="b-en">Bar clip series</p>
        </div>
        <span class="banner-emoji">💎</span>
      </section>

      <div v-if="filtered.length" class="grid">
        <ProductCard
          v-for="p in filtered"
          :key="p.id"
          :title="p.name"
          :price="p.price"
          :emoji="p.emoji"
          :from="p.from"
          :to="p.to"
          :tag="p.tag"
          :src="p.img"
          :fav="cart.has(p.id)"
          @fav="cart.toggle(p.id)"
          @click="detail = p"
        />
      </div>
      <div v-else class="empty">
        <span class="empty-emoji">🛍️</span>
        <p>这个分类暂时没有好物</p>
      </div>
    </main>

    <!-- 吸底操作条（在 BottomNav 之上） -->
    <div class="actionbar">
      <button class="btn btn-ghost pill" @click="buyAll">🛒 一键购买</button>
      <button class="btn btn-primary pill" @click="router.push('/free-match')">
        ✨ 一键搭配
      </button>
    </div>

    <BottomNav active="mall" />

    <!-- 轻提示 -->
    <transition name="toast">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>

    <!-- 商品详情底部弹层 -->
    <MallDetailSheet
      :product="detail"
      :fav="detail ? cart.has(detail.id) : false"
      @close="detail = null"
      @fav="detail && cart.toggle(detail.id)"
      @add="addFromSheet"
    />
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
}

.topbar {
  flex-shrink: 0;
  padding: calc(env(safe-area-inset-top, 12px) + 12px) 16px 8px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-1);
}
.cart {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--surface);
  display: grid;
  place-items: center;
  font-size: 20px;
  box-shadow: var(--shadow-card);
}
.badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--pink-deep);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: grid;
  place-items: center;
  box-shadow: 0 0 0 2px var(--surface);
}
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  box-shadow: var(--shadow-card);
}
.s-ico {
  font-size: 15px;
}
.s-ph {
  font-size: 14px;
  color: var(--text-3);
}

.cats {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 6px 16px 10px;
}
.cat {
  flex-shrink: 0;
  padding: 7px 16px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  transition: all 0.15s ease;
}
.cat.on {
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  box-shadow: var(--shadow-card);
}

.body {
  flex: 1;
  min-height: 0;
  padding: 2px 16px 12px;
}

.banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-radius: var(--radius);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-card);
}
.banner-txt {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.b-cn {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-on-brand);
}
.b-en {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: rgba(255, 255, 255, 0.85);
}
.banner-emoji {
  font-size: 30px;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.18));
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.empty {
  padding-top: 70px;
  text-align: center;
  color: var(--text-3);
}
.empty-emoji {
  font-size: 44px;
}

.actionbar {
  flex-shrink: 0;
  display: flex;
  gap: 12px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.72);
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--line);
}
.pill {
  flex: 1;
  height: 46px;
  border-radius: var(--radius-pill);
  font-size: 15px;
}

.toast {
  position: absolute;
  left: 50%;
  bottom: 120px;
  transform: translateX(-50%);
  z-index: 40;
  max-width: 80%;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  background: rgba(40, 24, 48, 0.85);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-float);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
