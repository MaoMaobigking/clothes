<script setup lang="ts">
import { ref } from 'vue'
import BottomNav from '@/components/BottomNav.vue'
import ProductCard from '@/components/ProductCard.vue'
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
</script>

<template>
  <div class="page">
    <header class="topbar">
      <div class="title-wrap">
        <h1 class="title">我的衣橱</h1>
        <span class="db" :class="{ on: wardrobe.usingApi }">
          {{ wardrobe.usingApi ? '● 数据库已连' : '○ 本地模式' }}
        </span>
      </div>
      <div class="head-right">
        <span class="count">共 {{ wardrobe.filtered.length }} 件</span>
        <button class="icon-btn" :class="{ active: manage }" title="管理" @click="manage = !manage">
          {{ manage ? '完成' : '管理' }}
        </button>
        <button class="icon-btn add" title="添加衣物" @click="openAdd">＋</button>
      </div>
    </header>

    <!-- 品牌横条 -->
    <div class="brands hide-scrollbar">
      <span v-for="b in brands" :key="b" class="brand-chip">{{ b }}</span>
    </div>

    <div class="layout">
      <!-- 左侧分类 -->
      <aside class="cats hide-scrollbar">
        <button
          v-for="c in CLOSET_CATEGORIES"
          :key="c.key"
          class="cat"
          :class="{ on: wardrobe.activeCategory === c.key }"
          @click="wardrobe.setCategory(c.key)"
        >
          <span class="cat-emoji">{{ c.emoji }}</span>
          <span class="cat-label">{{ c.label }}</span>
        </button>
      </aside>

      <!-- 右侧衣物网格 -->
      <main class="grid-wrap scroll-y hide-scrollbar">
        <div v-if="wardrobe.filtered.length" class="grid">
          <div v-for="g in wardrobe.filtered" :key="g.id" class="cell">
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
            <button v-if="manage" class="del" title="删除" @click="wardrobe.removeItem(g.id)">×</button>
          </div>
        </div>
        <div v-else class="empty">
          <span class="empty-emoji">🗂️</span>
          <p>这个分类还没有衣物，点右上 ＋ 添加</p>
        </div>
      </main>
    </div>

    <BottomNav active="closet" />

    <!-- 添加衣物弹层 -->
    <transition name="sheet">
      <div v-if="showAdd" class="mask" @click.self="showAdd = false">
        <div class="sheet">
          <div class="grip" />
          <h3 class="sheet-title">添加衣物</h3>

          <label class="field">
            <span class="lbl">名称</span>
            <input v-model="form.name" class="input" placeholder="例如：米色针织开衫" maxlength="20" />
          </label>

          <div class="field">
            <span class="lbl">图标</span>
            <div class="emojis">
              <button
                v-for="e in emojiChoices"
                :key="e"
                class="emoji-pick"
                :class="{ on: form.emoji === e }"
                @click="form.emoji = e"
              >
                {{ e }}
              </button>
            </div>
          </div>

          <div class="field">
            <span class="lbl">分类</span>
            <div class="cats-pick hide-scrollbar">
              <button
                v-for="c in addCats"
                :key="c.key"
                class="cat-pick"
                :class="{ on: form.category === c.key }"
                @click="form.category = c.key"
              >
                {{ c.label }}
              </button>
            </div>
          </div>

          <button class="btn btn-primary submit" :disabled="!form.name.trim()" @click="submitAdd">
            添加到衣橱
          </button>
        </div>
      </div>
    </transition>
  </div>
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
  gap: 8px;
  padding: calc(env(safe-area-inset-top, 12px) + 12px) 16px 8px;
}
.title-wrap {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: var(--text-1);
}
.db {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
}
.db.on {
  color: #37b98a;
}
.head-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.count {
  font-size: 12px;
  color: var(--text-3);
}
.icon-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 700;
}
.icon-btn.active {
  color: var(--pink-deep);
}
.icon-btn.add {
  width: 32px;
  padding: 0;
  font-size: 20px;
  color: #fff;
  background: var(--brand-gradient);
}

.brands {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 4px 16px 10px;
  overflow-x: auto;
}
.brand-chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  border: 1px solid var(--line);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-2);
  white-space: nowrap;
}

.layout {
  flex: 1;
  min-height: 0;
  display: flex;
}
.cats {
  flex: 0 0 76px;
  overflow-y: auto;
  padding: 6px 0 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 12px 4px;
  color: var(--text-2);
  border-radius: 0 14px 14px 0;
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
  width: 4px;
  height: 22px;
  border-radius: 0 4px 4px 0;
  background: var(--brand-gradient);
}
.cat-emoji {
  font-size: 20px;
}
.cat-label {
  font-size: 12px;
  font-weight: 600;
}

.grid-wrap {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 4px 16px 16px 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.cell {
  position: relative;
}
.del {
  position: absolute;
  top: -6px;
  left: -6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ff5c6a;
  color: #fff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 10px rgba(255, 92, 106, 0.5);
  z-index: 3;
}

.empty {
  padding-top: 80px;
  text-align: center;
  color: var(--text-3);
}
.empty-emoji {
  font-size: 44px;
}

/* 添加弹层 */
.mask {
  position: absolute;
  inset: 0;
  z-index: 40;
  background: rgba(40, 24, 48, 0.35);
  display: flex;
  align-items: flex-end;
}
.sheet {
  width: 100%;
  background: var(--surface);
  border-radius: 24px 24px 0 0;
  padding: 10px 18px calc(20px + var(--safe-bottom));
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.grip {
  width: 40px;
  height: 4px;
  border-radius: 999px;
  background: var(--line);
  margin: 2px auto 2px;
}
.sheet-title {
  margin: 0;
  font-size: 18px;
  font-weight: 800;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.lbl {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
}
.input {
  height: 44px;
  border-radius: var(--radius);
  border: 1px solid var(--line);
  background: #faf8ff;
  padding: 0 14px;
  font-size: 15px;
  color: var(--text-1);
  outline: none;
}
.input:focus {
  border-color: var(--pink);
}
.emojis {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.emoji-pick {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #f4f0fb;
  font-size: 20px;
  border: 2px solid transparent;
}
.emoji-pick.on {
  border-color: var(--pink);
  background: #fff;
}
.cats-pick {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.cat-pick {
  flex-shrink: 0;
  padding: 8px 14px;
  border-radius: 999px;
  background: #f4f0fb;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.cat-pick.on {
  background: var(--brand-gradient);
  color: #fff;
}
.submit {
  width: 100%;
  margin-top: 4px;
}

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
