<script setup lang="ts">
import { ref } from 'vue'
import BottomNav from '@/components/BottomNav/BottomNav.vue'
import ProductCard from '@/components/ProductCard/ProductCard.vue'
import { CLOSET_CATEGORIES, GARMENTS } from '@/data/mock'
import { useWardrobeStore } from '@/stores/wardrobe'

const wardrobe = useWardrobeStore()

/** 品牌横条：从初始衣物里去重出品牌 */
const brands = Array.from(new Set(GARMENTS.map((g) => g.brand)))

/** 管理模式（显示删除按钮） */
const manage = ref(false)

/** 添加衣物弹层 */
const showAdd = ref(false)
const addCats = CLOSET_CATEGORIES.filter((c) => c.key !== 'all')
const emojiChoices = ['👕', '👚', '🧥', '👖', '👗', '🥻', '👟', '🥿', '👜', '🧢', '💍', '🧣']
const form = ref({ name: '', emoji: '👕', category: 'top' })

function openAdd() {
  form.value = { name: '', emoji: '👕', category: wardrobe.activeCategory === 'all' ? 'top' : wardrobe.activeCategory }
  showAdd.value = true
}

async function submitAdd() {
  if (!form.value.name.trim()) return
  await wardrobe.addItem({ ...form.value, name: form.value.name.trim() })
  showAdd.value = false
}

/** mask 点击关闭：仅点击 mask 自身（非 sheet 区域）才关闭 */
function onMaskTap(e: any) {
  if (e.target === e.currentTarget) {
    showAdd.value = false
  }
}
</script>

<template>
  <view class="page">
    <view class="topbar">
      <view class="title-wrap">
        <view class="title">我的衣橱</view>
        <text class="db" :class="{ on: wardrobe.usingApi }">
          {{ wardrobe.usingApi ? '● 数据库已连' : '○ 本地模式' }}
        </text>
      </view>
      <view class="head-right">
        <text class="count">共 {{ wardrobe.filtered.length }} 件</text>
        <view class="icon-btn" :class="{ active: manage }" hover-class="icon-btn-hover" @tap="manage = !manage">
          {{ manage ? '完成' : '管理' }}
        </view>
        <view class="icon-btn add" hover-class="icon-btn-add-hover" @tap="openAdd">＋</view>
      </view>
    </view>

    <!-- 品牌横条 -->
    <view class="brands hide-scrollbar">
      <text v-for="b in brands" :key="b" class="brand-chip">{{ b }}</text>
    </view>

    <view class="layout">
      <!-- 左侧分类 -->
      <view class="cats hide-scrollbar">
        <view
          v-for="c in CLOSET_CATEGORIES"
          :key="c.key"
          class="cat"
          :class="{ on: wardrobe.activeCategory === c.key }"
          hover-class="cat-hover"
          @tap="wardrobe.setCategory(c.key)"
        >
          <text class="cat-emoji">{{ c.emoji }}</text>
          <text class="cat-label">{{ c.label }}</text>
        </view>
      </view>

      <!-- 右侧衣物网格 -->
      <view class="grid-wrap scroll-y hide-scrollbar">
        <view v-if="wardrobe.filtered.length" class="grid">
          <view v-for="g in wardrobe.filtered" :key="g.id" class="cell">
            <ProductCard
              :title="g.name"
              :emoji="g.emoji"
              :from="g.from"
              :to="g.to"
              :src="g.img"
              :tag="g.brand"
              :fav="wardrobe.isFav(g.id)"
              ratio="3 / 4"
              @fav="wardrobe.toggleFav(g.id)"
            />
            <view v-if="manage" class="del" hover-class="del-hover" @tap="wardrobe.removeItem(g.id)">×</view>
          </view>
        </view>
        <view v-else class="empty">
          <text class="empty-emoji">🗂️</text>
          <view class="empty-text">这个分类还没有衣物，点右上 ＋ 添加</view>
        </view>
      </view>
    </view>

    <BottomNav active="closet" />

    <!-- 添加衣物弹层 -->
    <transition name="sheet">
      <view v-if="showAdd" class="mask" @tap="onMaskTap">
        <view class="sheet">
          <view class="grip" />
          <view class="sheet-title">添加衣物</view>

          <view class="field">
            <text class="lbl">名称</text>
            <input v-model="form.name" class="input" placeholder="例如：米色针织开衫" maxlength="20" />
          </view>

          <view class="field">
            <text class="lbl">图标</text>
            <view class="emojis">
              <view
                v-for="e in emojiChoices"
                :key="e"
                class="emoji-pick"
                :class="{ on: form.emoji === e }"
                hover-class="emoji-pick-hover"
                @tap="form.emoji = e"
              >
                {{ e }}
              </view>
            </view>
          </view>

          <view class="field">
            <text class="lbl">分类</text>
            <view class="cats-pick hide-scrollbar">
              <view
                v-for="c in addCats"
                :key="c.key"
                class="cat-pick"
                :class="{ on: form.category === c.key }"
                hover-class="cat-pick-hover"
                @tap="form.category = c.key"
              >
                {{ c.label }}
              </view>
            </view>
          </view>

          <view
            class="btn btn-primary submit"
            :class="{ 'btn-disabled': !form.name.trim() }"
            @tap="submitAdd"
          >
            添加到衣橱
          </view>
        </view>
      </view>
    </transition>
  </view>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.topbar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 24rpx) 32rpx 16rpx;
}

.title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.title {
  margin: 0;
  font-size: 44rpx;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.2;
}

.db {
  font-size: 22rpx;
  font-weight: 700;
  color: var(--text-3);
}

.db.on {
  color: #37b98a;
}

.head-right {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.count {
  font-size: 24rpx;
  color: var(--text-3);
}

.icon-btn {
  height: 64rpx;
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: var(--text-2);
  font-size: 26rpx;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn.active {
  color: var(--pink-deep);
}

.icon-btn.add {
  width: 64rpx;
  padding: 0;
  font-size: 40rpx;
  color: #fff;
  background: var(--brand-gradient);
}

/* hover 态（小程序不支持 :active，用 hover-class 配合） */
.icon-btn-hover {
  opacity: 0.7;
}

.icon-btn-add-hover {
  opacity: 0.8;
  transform: scale(0.95);
}

/* 品牌横条 */
.brands {
  flex-shrink: 0;
  display: flex;
  gap: 16rpx;
  padding: 8rpx 32rpx 20rpx;
  overflow-x: auto;
}

.brand-chip {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  border: 1px solid var(--line);
  font-size: 24rpx;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
  white-space: nowrap;
}

/* 左侧分类 + 右侧网格 */
.layout {
  flex: 1;
  min-height: 0;
  display: flex;
}

.cats {
  flex: 0 0 152rpx;
  overflow-y: auto;
  padding: 12rpx 0 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  padding: 24rpx 8rpx;
  color: var(--text-2);
  border-radius: 0 28rpx 28rpx 0;
  position: relative;
  transition: all 0.15s ease;
}

.cat.on {
  background: var(--surface);
  color: var(--pink-deep);
  box-shadow: var(--shadow-card);
}

.cat.on::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 8rpx;
  height: 44rpx;
  border-radius: 0 8rpx 8rpx 0;
  background: var(--brand-gradient);
}

.cat-hover {
  opacity: 0.7;
}

.cat-emoji {
  font-size: 40rpx;
}

.cat-label {
  font-size: 24rpx;
  font-weight: 600;
}

/* 右侧网格 */
.grid-wrap {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 8rpx 32rpx 32rpx 24rpx;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}

.cell {
  position: relative;
}

.del {
  position: absolute;
  top: -12rpx;
  left: -12rpx;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #ff5c6a;
  color: #fff;
  font-size: 32rpx;
  font-weight: 800;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 20rpx rgba(255, 92, 106, 0.5);
  z-index: 3;
}

.del-hover {
  transform: scale(0.9);
}

/* 空状态 */
.empty {
  padding-top: 160rpx;
  text-align: center;
  color: var(--text-3);
}

.empty-emoji {
  font-size: 88rpx;
}

.empty-text {
  margin-top: 16rpx;
  font-size: 26rpx;
}

/* 添加弹层 */
.mask {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 40;
  background: rgba(40, 24, 48, 0.35);
  display: flex;
  align-items: flex-end;
}

.sheet {
  width: 100%;
  background: var(--surface);
  border-radius: 48rpx 48rpx 0 0;
  padding: 20rpx 36rpx calc(40rpx + env(safe-area-inset-bottom, 0px));
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.grip {
  width: 80rpx;
  height: 8rpx;
  border-radius: 999rpx;
  background: var(--line);
  margin: 4rpx auto 4rpx;
}

.sheet-title {
  margin: 0;
  font-size: 36rpx;
  font-weight: 800;
  line-height: 1.3;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.lbl {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-2);
}

.input {
  height: 88rpx;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: #faf8ff;
  padding: 0 28rpx;
  font-size: 30rpx;
  color: var(--text-1);
}

.emojis {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}

.emoji-pick {
  width: 80rpx;
  height: 80rpx;
  border-radius: 24rpx;
  background: #f4f0fb;
  font-size: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid transparent;
  box-sizing: border-box;
}

.emoji-pick.on {
  border-color: var(--pink);
  background: #fff;
}

.emoji-pick-hover {
  opacity: 0.7;
}

.cats-pick {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding-bottom: 4rpx;
}

.cat-pick {
  flex-shrink: 0;
  padding: 16rpx 28rpx;
  border-radius: 999rpx;
  background: #f4f0fb;
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-2);
}

.cat-pick.on {
  background: var(--brand-gradient);
  color: #fff;
}

.cat-pick-hover {
  opacity: 0.7;
}

.submit {
  width: 100%;
  margin-top: 8rpx;
}

/* transition 动画 */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.2s ease;
}

.sheet-enter-active .sheet,
.sheet-leave-active .sheet {
  transition: transform 0.25s ease;
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

.sheet-enter-from .sheet,
.sheet-leave-to .sheet {
  transform: translateY(100%);
}
</style>
