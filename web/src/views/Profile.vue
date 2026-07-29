<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import BottomNav from '@/components/BottomNav.vue'
import TileImage from '@/components/TileImage.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import { useCartStore } from '@/stores/cart'
import { useProfileStore } from '@/stores/profile'

const router = useRouter()
const wardrobe = useWardrobeStore()
const cart = useCartStore()
const profile = useProfileStore()

/** 轻提示（页面内小气泡） */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(text: string) {
  toast.value = text
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1600)
}

const stats = [
  { key: 'fav', label: '收藏', value: () => wardrobe.favIds.length },
  { key: 'garment', label: '衣橱件数', value: () => wardrobe.garments.length },
  { key: 'cart', label: '购物车', value: () => cart.count },
]

function goAvatar() {
  router.push(profile.isComplete ? '/create' : '/test')
}

interface MenuItem {
  key: string
  emoji: string
  label: string
  route?: string
}

const menus: MenuItem[] = [
  { key: 'orders', emoji: '📦', label: '我的订单' },
  { key: 'outfits', emoji: '👗', label: '我的搭配' },
  { key: 'diary', emoji: '📔', label: '穿搭日记' },
  { key: 'magazine', emoji: '📖', label: '时尚杂志', route: '/magazine' },
  { key: 'community', emoji: '💬', label: '时尚社群', route: '/community' },
  { key: 'scene', emoji: '🌦️', label: '情景模拟', route: '/scene' },
  { key: 'setting', emoji: '⚙️', label: '设置' },
]

function onMenu(m: MenuItem) {
  if (m.route) router.push(m.route)
  else showToast(`「${m.label}」功能敬请期待～`)
}
</script>

<template>
  <div class="page">
    <div class="body scroll-y hide-scrollbar">
      <!-- 顶部用户卡 -->
      <section class="user-card">
        <div class="uc-row">
          <span class="uc-avatar">🧑‍🎨</span>
          <div class="uc-text">
            <span class="uc-name">时尚探索家</span>
            <span class="uc-sign">用穿搭记录每一天的好心情 ✨</span>
          </div>
          <button class="uc-edit" @click="showToast('资料编辑功能开发中～')">编辑资料</button>
        </div>
      </section>

      <!-- 数据行 -->
      <section class="stats">
        <div v-for="s in stats" :key="s.key" class="stat">
          <span class="stat-num">{{ s.value() }}</span>
          <span class="stat-label">{{ s.label }}</span>
        </div>
      </section>

      <!-- 我的虚拟形象 -->
      <section>
        <SectionTitle title="我的虚拟形象" />
        <div class="avatar-card">
          <TileImage
            from="#ffd6e8"
            to="#c9b8ff"
            emoji="🧍‍♀️"
            ratio="1 / 1"
            rounded="var(--radius)"
            class="avatar-thumb"
          />
          <div class="ac-text">
            <span class="ac-title">{{ profile.isComplete ? '专属形象已生成' : '还没有专属形象' }}</span>
            <span class="ac-sub">{{ profile.summary || '先做个身形测试，生成你的虚拟形象吧' }}</span>
            <button class="btn btn-primary ac-btn" @click="goAvatar">
              {{ profile.isComplete ? '进入个性化创建' : '去创建形象' }}
            </button>
          </div>
        </div>
      </section>

      <!-- 菜单列表 -->
      <section>
        <SectionTitle title="更多功能" />
        <div class="menu-card">
          <button
            v-for="m in menus"
            :key="m.key"
            class="menu-item"
            @click="onMenu(m)"
          >
            <span class="mi-emoji">{{ m.emoji }}</span>
            <span class="mi-label">{{ m.label }}</span>
            <span class="mi-arrow">›</span>
          </button>
        </div>
      </section>
    </div>

    <!-- 轻提示 -->
    <transition name="fade">
      <div v-if="toast" class="toast">{{ toast }}</div>
    </transition>

    <BottomNav active="me" />
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
  gap: 16px;
}

/* 用户卡 */
.user-card {
  background: var(--brand-gradient);
  border-radius: var(--radius-lg);
  padding: 18px 16px;
  box-shadow: var(--shadow-float);
}
.uc-row {
  display: flex;
  align-items: center;
  gap: 14px;
}
.uc-avatar {
  width: 60px;
  height: 60px;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  display: grid;
  place-items: center;
  font-size: 34px;
}
.uc-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.uc-name {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-on-brand);
}
.uc-sign {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}
.uc-edit {
  flex-shrink: 0;
  align-self: flex-start;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-on-brand);
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.25);
}

/* 数据行 */
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.stat {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 14px 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  box-shadow: var(--shadow-card);
}
.stat-num {
  font-size: 22px;
  font-weight: 800;
  color: var(--pink-deep);
}
.stat-label {
  font-size: 12px;
  color: var(--text-2);
}

/* 虚拟形象卡 */
.avatar-card {
  display: flex;
  gap: 14px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-card);
  margin-top: 10px;
}
.avatar-thumb {
  width: 88px;
  flex-shrink: 0;
}
.ac-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.ac-title {
  font-size: 15px;
  font-weight: 800;
  color: var(--text-1);
}
.ac-sub {
  flex: 1;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
}
.ac-btn {
  height: 40px;
  align-self: stretch;
}

/* 菜单列表 */
.menu-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 4px 14px;
  box-shadow: var(--shadow-card);
  margin-top: 10px;
}
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 2px;
  border-bottom: 1px solid var(--line);
  transition: opacity 0.15s ease;
}
.menu-item:last-child {
  border-bottom: none;
}
.menu-item:active {
  opacity: 0.6;
}
.mi-emoji {
  font-size: 19px;
}
.mi-label {
  flex: 1;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
}
.mi-arrow {
  font-size: 20px;
  color: var(--text-3);
}

/* 轻提示 */
.toast {
  position: absolute;
  left: 50%;
  bottom: calc(var(--safe-bottom, 0px) + 84px);
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-size: 13px;
  padding: 9px 16px;
  border-radius: var(--radius-pill);
  white-space: nowrap;
  z-index: 20;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
