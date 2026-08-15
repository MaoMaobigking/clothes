<script setup lang="ts">
import { onMounted, ref } from 'vue'
// easycom 自动解析 TileImage / SectionTitle / BottomNav，也可显式导入
import TileImage from '@/components/TileImage/TileImage.vue'
import SectionTitle from '@/components/SectionTitle/SectionTitle.vue'
import BottomNav from '@/components/BottomNav/BottomNav.vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import { useCartStore } from '@/stores/cart'
import { useProfileStore } from '@/stores/profile'
import { useAuthStore } from '@/stores/auth'
import { fetchAchievements, type AchievementSummary } from '@/api/community'

const wardrobe = useWardrobeStore()
const cart = useCartStore()
const profile = useProfileStore()
const auth = useAuthStore()
const achievements = ref<AchievementSummary>({
  points: 0,
  badges: [],
  completed: [],
})

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
  uni.navigateTo({ url: '/pages/body-create/index' })
}

function goAchievements() {
  uni.navigateTo({ url: '/pages/achievements/index' })
}

interface MenuItem {
  key: string
  emoji: string
  label: string
  route?: string
  /** 右侧小字，用来提前说明「点进去还要过一道」 */
  hint?: string
}

const menus: MenuItem[] = [
  { key: 'orders', emoji: '📦', label: '我的订单' },
  { key: 'outfits', emoji: '👗', label: '我的搭配', route: '/pages/outfits/index' },
  { key: 'diary', emoji: '📔', label: '穿搭日记' },
  { key: 'magazine', emoji: '📖', label: '时尚杂志', route: '/pages/community/index?tab=magazine' },
  { key: 'community', emoji: '💬', label: '时尚社群', route: '/pages/community/index?tab=share' },
  { key: 'favorites', emoji: '⭐', label: '我的收藏', route: '/pages/my-favorites/index' },
  { key: 'achievements', emoji: '🏅', label: '学习成就', route: '/pages/achievements/index' },
  // 看板本身有密码闸（pages/admin/index.vue），这里只提示，不重复弹一次输入框
  { key: 'admin', emoji: '📊', label: '管理员看板', route: '/pages/admin/index', hint: '需密码' },
  { key: 'scene', emoji: '🌦️', label: '情景模拟', route: '/pages/scene/index' },
  { key: 'custom', emoji: '🧵', label: '差异化定制', route: '/pages/custom/index' },
  { key: 'setting', emoji: '⚙️', label: '设置' },
  { key: 'logout', emoji: '🚪', label: '退出登录' },
]

function onMenu(m: MenuItem) {
  if (m.key === 'logout') {
    confirmLogout()
    return
  }
  if (m.route) {
    uni.navigateTo({ url: m.route })
  } else {
    showToast(`「${m.label}」功能敬请期待～`)
  }
}

/** 退出登录（规格 §5）。清身份 + 清跟人绑定的本地缓存，然后回登录页。 */
function confirmLogout() {
  uni.showModal({
    title: '退出登录',
    content: '退出后需要重新登录才能查看你的衣橱和搭配。',
    confirmText: '退出',
    success: (res) => {
      if (res.confirm) auth.logout()
    },
  })
}

onMounted(async () => {
  try {
    achievements.value = await fetchAchievements()
  } catch {
    // 个人中心不应因学习数据加载失败而阻塞
  }
})
</script>

<template>
  <view class="page">
    <view class="body scroll-y hide-scrollbar">
      <!-- 顶部用户卡 -->
      <view class="user-card">
        <view class="uc-row">
          <text class="uc-avatar">🧑‍🎨</text>
          <view class="uc-text">
            <text class="uc-name">{{ auth.displayName }}</text>
            <text class="uc-sign">
              <text v-if="auth.session.account">账号 {{ auth.session.account }} · </text>用穿搭记录每一天的好心情 ✨
            </text>
          </view>
          <view class="uc-edit" hover-class="uc-edit-hover" @tap="showToast('资料编辑功能开发中～')">编辑资料</view>
        </view>
      </view>

      <!-- 数据行 -->
      <view class="stats">
        <view v-for="s in stats" :key="s.key" class="stat">
          <text class="stat-num">{{ s.value() }}</text>
          <text class="stat-label">{{ s.label }}</text>
        </view>
      </view>

      <!-- 我的虚拟形象 -->
      <view>
        <SectionTitle title="我的虚拟形象" />
        <view class="avatar-card">
          <TileImage
            from="#ffd6e8"
            to="#c9b8ff"
            emoji="🧍‍♀️"
            ratio="1 / 1"
            rounded="var(--radius)"
            class="avatar-thumb"
          />
          <view class="ac-text">
            <text class="ac-title">{{ profile.isComplete ? '专属形象已生成' : '还没有专属形象' }}</text>
            <text class="ac-sub">{{ profile.summary || '先做个身形测试，生成你的虚拟形象吧' }}</text>
            <view class="btn btn-primary ac-btn" hover-class="btn-hover" @tap="goAvatar">
              {{ profile.isComplete ? '进入个性化创建' : '去创建形象' }}
            </view>
          </view>
        </view>
      </view>

      <!-- 学习数据 -->
      <view>
        <SectionTitle title="学习记录" />
        <view class="learning-card" @tap="goAchievements">
          <view class="learning-points">
            <text class="learning-number">{{ achievements.points }}</text>
            <text class="learning-label">学习积分</text>
          </view>
          <view class="learning-progress">
            <view class="learning-line">
              <view
                class="learning-fill"
                :style="{ width: `${Math.min(100, Math.round(achievements.completed.length / 4 * 100))}%` }"
              />
            </view>
            <text class="learning-meta">
              已完成 {{ achievements.completed.length }} 个教程
              <text v-if="achievements.badges.length"> · {{ achievements.badges.length }} 枚徽章</text>
            </text>
          </view>
        </view>
      </view>

      <!-- 菜单列表 -->
      <view>
        <SectionTitle title="更多功能" />
        <view class="menu-card">
          <view
            v-for="m in menus"
            :key="m.key"
            class="menu-item"
            hover-class="menu-item-hover"
            @tap="onMenu(m)"
          >
            <text class="mi-emoji">{{ m.emoji }}</text>
            <text class="mi-label">{{ m.label }}</text>
            <text v-if="m.hint" class="mi-hint">{{ m.hint }}</text>
            <text class="mi-arrow">›</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 轻提示 -->
    <transition name="fade">
      <view v-if="toast" class="toast">{{ toast }}</view>
    </transition>

    <BottomNav active="me" />
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
  gap: 32rpx;
}

/* 用户卡 */
.user-card {
  background: var(--brand-gradient);
  border-radius: var(--radius-lg);
  padding: 36rpx 32rpx;
  box-shadow: var(--shadow-float);
}
.uc-row {
  display: flex;
  align-items: center;
  gap: 28rpx;
}
.uc-avatar {
  width: 120rpx;
  height: 120rpx;
  flex-shrink: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 68rpx;
}
.uc-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.uc-name {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--text-on-brand);
}
.uc-sign {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
}
.uc-edit {
  flex-shrink: 0;
  align-self: flex-start;
  font-size: 24rpx;
  font-weight: 600;
  color: var(--text-on-brand);
  padding: 10rpx 24rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.25);
}
.uc-edit-hover {
  opacity: 0.7;
}

/* 数据行 */
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}
.stat {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 28rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: var(--shadow-card);
}
.stat-num {
  font-size: 44rpx;
  font-weight: 800;
  color: var(--pink-deep);
}
.stat-label {
  font-size: 24rpx;
  color: var(--text-2);
}

/* 虚拟形象卡 */
.avatar-card {
  display: flex;
  gap: 28rpx;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 28rpx;
  box-shadow: var(--shadow-card);
  margin-top: 20rpx;
}

/* 学习记录 */
.learning-card {
  display: flex;
  align-items: center;
  gap: 28rpx;
  padding: 28rpx;
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  margin-top: 20rpx;
}
.learning-points {
  flex: 0 0 124rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
}
.learning-number {
  font-size: 48rpx;
  line-height: 1;
  font-weight: 900;
  color: var(--pink-deep);
}
.learning-label {
  font-size: 22rpx;
  color: var(--text-2);
}
.learning-progress {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.learning-line {
  width: 100%;
  height: 14rpx;
  border-radius: var(--radius-pill);
  background: #e8e2ef;
  overflow: hidden;
}
.learning-fill {
  height: 100%;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
}
.learning-meta {
  font-size: 24rpx;
  color: var(--text-2);
}
.avatar-thumb {
  width: 176rpx;
  flex-shrink: 0;
}
.ac-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.ac-title {
  font-size: 30rpx;
  font-weight: 800;
  color: var(--text-1);
}
.ac-sub {
  flex: 1;
  font-size: 24rpx;
  color: var(--text-2);
  line-height: 1.5;
}
.ac-btn {
  height: 80rpx;
  align-self: stretch;
}

/* 菜单列表 */
.menu-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 8rpx 28rpx;
  box-shadow: var(--shadow-card);
  margin-top: 20rpx;
}
.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 24rpx;
  padding: 28rpx 4rpx;
  border-bottom: 1px solid var(--line);
}
.menu-item:last-child {
  border-bottom: none;
}
.menu-item-hover {
  opacity: 0.6;
}
.mi-emoji {
  font-size: 38rpx;
}
.mi-label {
  flex: 1;
  text-align: left;
  font-size: 28rpx;
  font-weight: 600;
  color: var(--text-1);
}
.mi-hint {
  font-size: 22rpx;
  color: var(--text-3);
}
.mi-arrow {
  font-size: 40rpx;
  color: var(--text-3);
}

/* 轻提示 */
.toast {
  position: absolute;
  left: 50%;
  bottom: calc(var(--safe-bottom, 0px) + 168rpx);
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.78);
  color: #fff;
  font-size: 26rpx;
  padding: 18rpx 32rpx;
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
