<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import ProductCard from '@/components/ProductCard/ProductCard.vue'
import SegTabs from '@/components/SegTabs/SegTabs.vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import { MODEL_IMAGES, type Garment } from '@/data/mock'
import {
  garmentToAccessoryContext,
  setAccessoryPageContext,
} from '@/utils/accessoryContext'

const wardrobe = useWardrobeStore()

/* ---------- 轻提示 ---------- */
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 1500)
}

/* ---------- 右侧工具 ---------- */
const tools: { key: string; label: string; emoji: string }[] = [
  { key: 'save', label: '穿搭保存', emoji: '💾' },
  { key: 'model', label: '更换模型', emoji: '🧍‍♀️' },
  { key: 'outfit', label: '更换搭配', emoji: '🔄' },
  { key: 'shoes', label: '换鞋子', emoji: '👟' },
  { key: 'skirt', label: '换裙子', emoji: '👗' },
  { key: 'pro', label: '进阶穿搭', emoji: '✨' },
]
function onTool(label: string) {
  showToast(`${label} · 敬请期待`)
}

/* ---------- 左侧可替换缩略（取衣橱前 6 件） ---------- */
const quickThumbs = computed<Garment[]>(() => wardrobe.garments.slice(0, 6))

/* ---------- 已选单品（本地管理） ---------- */
const selected = ref<Garment[]>([])
function wear(g: Garment) {
  if (selected.value.some((s) => s.id === g.id)) {
    showToast('这件已经穿上啦～')
    return
  }
  selected.value.push(g)
  showToast(`已穿上「${g.name}」`)
}
function takeOff(id: string) {
  selected.value = selected.value.filter((s) => s.id !== id)
}

/* ---------- 底部面板：大类 + 小分类 chips ---------- */
type Chip = { key: string; label: string; kw?: string[] }

const bigTabs = [
  { key: 'fav', label: '我的收藏' },
  { key: 'try', label: '试穿' },
]

const favChips: Chip[] = [
  { key: 'all', label: '全部' },
  { key: 'single', label: '单衣', kw: ['T', '衫', '衬衫'] },
  { key: 'coat', label: '外套', kw: ['外套', '大衣', '夹克', '风衣'] },
  { key: 'skirt', label: '裙装', kw: ['裙'] },
  { key: 'pants', label: '裤装', kw: ['裤'] },
]
const tryChips: Chip[] = [
  { key: 'all', label: '全部' },
  { key: 'tshirt', label: 'T恤', kw: ['T', '恤'] },
  { key: 'shirt', label: '衬衫', kw: ['衬衫'] },
  { key: 'knit', label: '针织衫', kw: ['针织', '毛线', '毛衣'] },
  { key: 'trench', label: '风衣', kw: ['风衣', '外套', '大衣'] },
]

const bigTab = ref('fav')
const activeChip = ref('all')

// 切换大类时，小分类回到「全部」
watch(bigTab, () => {
  activeChip.value = 'all'
})

const chips = computed(() => (bigTab.value === 'fav' ? favChips : tryChips))
const baseList = computed(() =>
  bigTab.value === 'fav' ? wardrobe.favoriteGarments : wardrobe.garments,
)

const displayList = computed(() => {
  const chip = chips.value.find((c) => c.key === activeChip.value)
  if (!chip || !chip.kw) return baseList.value
  const kw = chip.kw
  const matched = baseList.value.filter((g) =>
    kw.some((k) => g.name.includes(k) || (g.tags?.some((t) => t.includes(k)) ?? false)),
  )
  // 宽松过滤：匹配不到就展示全部
  return matched.length ? matched : baseList.value
})

function goCreate() {
  uni.navigateTo({ url: '/pages/create/index' })
}

function goAccessory() {
  const outfit = selected.value.length ? selected.value : wardrobe.garments.slice(0, 5)
  if (!outfit.length) {
    showToast('先选择一件服装')
    return
  }
  setAccessoryPageContext({
    source: 'outfit',
    title: selected.value.length ? '当前自由搭配' : '衣橱推荐服装',
    outfit: outfit.map(garmentToAccessoryContext),
  })
  uni.navigateTo({ url: '/pages/accessory/index' })
}
</script>

<template>
  <view class="page">
    <PageHeader title="自由搭配" to="/pages/home/home">
      <template #right>
        <view class="head-actions">
          <button class="head-ico" aria-label="配配饰" @tap="goAccessory">💎</button>
          <button class="head-ico" aria-label="收藏" @tap="showToast('已收藏本套造型 ★')">★</button>
          <button class="head-ico" aria-label="保存" @tap="showToast('穿搭已保存 💾')">💾</button>
        </view>
      </template>
    </PageHeader>

    <scroll-view scroll-y class="body">
      <!-- 上半区：形象 + 工具 -->
      <view class="stage-area">
        <!-- 左侧竖排可替换缩略 -->
        <scroll-view scroll-y class="thumbs">
          <button
            v-for="g in quickThumbs"
            :key="g.id"
            class="thumb"
            :aria-label="`换上${g.name}`"
            @tap="wear(g)"
          >
            <TileImage :src="g.img" :from="g.from" :to="g.to" :emoji="g.emoji" ratio="1 / 1" rounded="24rpx" />
          </button>
        </scroll-view>

        <!-- 中央：已穿搭全身模特图 -->
        <view class="model">
          <TileImage
            :src="MODEL_IMAGES.outfit"
            from="#c9d8ff"
            to="#9ab0ff"
            emoji="🧍‍♀️"
            ratio="3 / 4"
            label="我的虚拟形象"
          />
        </view>

        <!-- 右侧竖排工具 -->
        <scroll-view scroll-y class="tools">
          <button
            v-for="t in tools"
            :key="t.key"
            class="tool"
            :aria-label="t.label"
            @tap="onTool(t.label)"
          >
            <text class="tool-ico">{{ t.emoji }}</text>
            <text class="tool-label">{{ t.label }}</text>
          </button>
        </scroll-view>

        <!-- 右下：个性化创建入口 -->
        <button class="create-entry" @tap="goCreate">✨ 个性化创建</button>
      </view>

      <!-- 已选单品 chips -->
      <view class="selected">
        <view v-if="selected.length" class="sel-row">
          <button v-for="s in selected" :key="s.id" class="sel-chip" @tap="takeOff(s.id)">
            <text class="sel-emoji">{{ s.emoji }}</text>
            <text class="sel-name">{{ s.name }}</text>
            <text class="sel-x">×</text>
          </button>
        </view>
        <view v-else class="sel-empty">还没穿上单品，去下面挑一件试试吧 👇</view>
      </view>

      <!-- 下半区：底部面板 -->
      <view class="panel">
        <SegTabs v-model="bigTab" :tabs="bigTabs" />

        <scroll-view scroll-x class="chips">
          <button
            v-for="c in chips"
            :key="c.key"
            class="chip"
            :class="{ on: activeChip === c.key }"
            @tap="activeChip = c.key"
          >
            {{ c.label }}
          </button>
        </scroll-view>

        <scroll-view scroll-y class="grid-wrap">
          <view v-if="displayList.length" class="grid">
            <ProductCard
              v-for="g in displayList"
              :key="g.id"
              :title="g.name"
              :src="g.img"
              :emoji="g.emoji"
              :from="g.from"
              :to="g.to"
              :tag="g.season"
              :fav="wardrobe.isFav(g.id)"
              ratio="3 / 4"
              @tap="wear(g)"
              @fav="wardrobe.toggleFav(g.id)"
            />
          </view>
          <view v-else class="empty">
            <text class="empty-emoji">🧺</text>
            <view>这里还没有可搭配的衣物</view>
          </view>
        </scroll-view>
      </view>
    </scroll-view>

    <!-- 轻提示 -->
    <transition name="toast">
      <view v-if="toastMsg" class="toast">{{ toastMsg }}</view>
    </transition>
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
  padding: 24rpx 32rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

/* ---------- 顶栏右侧图标 ---------- */
.head-actions {
  display: flex;
  gap: 16rpx;
}
.head-ico {
  width: 68rpx;
  height: 68rpx;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 30rpx;
  color: var(--pink-deep);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: var(--shadow-card);
}

/* ---------- 上半区舞台 ---------- */
.stage-area {
  position: relative;
  flex-shrink: 0;
  display: flex;
  gap: 16rpx;
  background: var(--surface-soft);
  border-radius: var(--radius-lg);
  padding: 24rpx 20rpx;
  box-shadow: var(--shadow-card);
}

/* 左侧竖排缩略 */
.thumbs {
  flex-shrink: 0;
  width: 104rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  max-height: 680rpx;
}
.thumb {
  width: 104rpx;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.thumb:active {
  transform: scale(0.92);
}

/* 中央模特 */
.model {
  flex: 1;
  min-width: 0;
  align-self: center;
}

/* 右侧工具 */
.tools {
  flex-shrink: 0;
  width: 112rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  max-height: 680rpx;
}
.tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  width: 112rpx;
  padding: 12rpx 4rpx;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.tool:active {
  transform: scale(0.92);
}
.tool-ico {
  font-size: 40rpx;
}
.tool-label {
  font-size: 20rpx;
  font-weight: 600;
  color: var(--text-2);
}

.create-entry {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  z-index: 3;
  padding: 14rpx 24rpx;
  border-radius: var(--radius-pill);
  font-size: 24rpx;
  font-weight: 700;
  color: var(--text-on-brand);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-float);
}

/* ---------- 已选单品 ---------- */
.selected {
  flex-shrink: 0;
}
.sel-row {
  display: flex;
  gap: 16rpx;
  overflow-x: auto;
  padding-bottom: 4rpx;
}
.sel-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10rpx;
  padding: 12rpx 20rpx;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  font-size: 24rpx;
  color: var(--text-1);
}
.sel-emoji {
  font-size: 30rpx;
}
.sel-name {
  font-weight: 600;
}
.sel-x {
  font-size: 28rpx;
  color: var(--pink-deep);
  font-weight: 800;
}
.sel-empty {
  margin: 0;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-3);
}

/* ---------- 下半区面板 ---------- */
.panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  background: var(--surface-soft);
  border-radius: var(--radius-lg);
  padding: 24rpx 24rpx 8rpx;
  box-shadow: var(--shadow-card);
}

.chips {
  display: flex;
  gap: 16rpx;
  white-space: nowrap;
}
.chip {
  flex-shrink: 0;
  padding: 12rpx 28rpx;
  border-radius: var(--radius-pill);
  font-size: 26rpx;
  font-weight: 600;
  color: var(--text-2);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  transition: all 0.15s ease;
}
.chip.on {
  color: var(--text-on-brand);
  background: var(--brand-gradient);
}

.grid-wrap {
  flex: 1;
  min-height: 0;
  padding-bottom: 24rpx;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20rpx;
}

.empty {
  padding-top: 80rpx;
  text-align: center;
  color: var(--text-3);
}
.empty-emoji {
  font-size: 80rpx;
}

/* ---------- 轻提示 ---------- */
.toast {
  position: fixed;
  left: 50%;
  bottom: 168rpx;
  transform: translateX(-50%);
  z-index: 50;
  max-width: 78%;
  padding: 20rpx 36rpx;
  border-radius: var(--radius-pill);
  background: rgba(40, 30, 55, 0.86);
  color: #fff;
  font-size: 26rpx;
  font-weight: 600;
  box-shadow: var(--shadow-float);
  white-space: nowrap;
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.25s ease, transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 16rpx);
}
</style>
