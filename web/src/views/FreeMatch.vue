<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import TileImage from '@/components/TileImage.vue'
import ProductCard from '@/components/ProductCard.vue'
import SegTabs from '@/components/SegTabs.vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import { MODEL_IMAGES, type Garment } from '@/data/mock'

const router = useRouter()
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
</script>

<template>
  <div class="page">
    <PageHeader title="自由搭配" to="/home">
      <template #right>
        <div class="head-actions">
          <button class="head-ico" aria-label="收藏" @click="showToast('已收藏本套造型 ★')">★</button>
          <button class="head-ico" aria-label="保存" @click="showToast('穿搭已保存 💾')">💾</button>
        </div>
      </template>
    </PageHeader>

    <div class="body scroll-y hide-scrollbar">
      <!-- 上半区：形象 + 工具 -->
      <section class="stage-area">
        <!-- 左侧竖排可替换缩略 -->
        <div class="thumbs hide-scrollbar">
          <button
            v-for="g in quickThumbs"
            :key="g.id"
            class="thumb"
            :aria-label="`换上${g.name}`"
            @click="wear(g)"
          >
            <TileImage :src="g.img" :from="g.from" :to="g.to" :emoji="g.emoji" ratio="1 / 1" rounded="12px" />
          </button>
        </div>

        <!-- 中央：已穿搭全身模特图 -->
        <div class="model">
          <TileImage
            :src="MODEL_IMAGES.outfit"
            from="#c9d8ff"
            to="#9ab0ff"
            emoji="🧍‍♀️"
            ratio="3 / 4"
            label="我的虚拟形象"
          />
        </div>

        <!-- 右侧竖排工具 -->
        <div class="tools hide-scrollbar">
          <button
            v-for="t in tools"
            :key="t.key"
            class="tool"
            :aria-label="t.label"
            @click="onTool(t.label)"
          >
            <span class="tool-ico">{{ t.emoji }}</span>
            <span class="tool-label">{{ t.label }}</span>
          </button>
        </div>

        <!-- 右下：个性化创建入口 -->
        <button class="create-entry" @click="router.push('/create')">✨ 个性化创建</button>
      </section>

      <!-- 已选单品 chips -->
      <div class="selected">
        <div v-if="selected.length" class="sel-row hide-scrollbar">
          <button v-for="s in selected" :key="s.id" class="sel-chip" @click="takeOff(s.id)">
            <span class="sel-emoji">{{ s.emoji }}</span>
            <span class="sel-name">{{ s.name }}</span>
            <span class="sel-x">×</span>
          </button>
        </div>
        <p v-else class="sel-empty">还没穿上单品，去下面挑一件试试吧 👇</p>
      </div>

      <!-- 下半区：底部面板 -->
      <section class="panel">
        <SegTabs v-model="bigTab" :tabs="bigTabs" />

        <div class="chips hide-scrollbar">
          <button
            v-for="c in chips"
            :key="c.key"
            class="chip"
            :class="{ on: activeChip === c.key }"
            @click="activeChip = c.key"
          >
            {{ c.label }}
          </button>
        </div>

        <div class="grid-wrap scroll-y hide-scrollbar">
          <div v-if="displayList.length" class="grid">
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
              @click="wear(g)"
              @fav="wardrobe.toggleFav(g.id)"
            />
          </div>
          <div v-else class="empty">
            <span class="empty-emoji">🧺</span>
            <p>这里还没有可搭配的衣物</p>
          </div>
        </div>
      </section>
    </div>

    <!-- 轻提示 -->
    <transition name="toast">
      <div v-if="toastMsg" class="toast">{{ toastMsg }}</div>
    </transition>
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
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ---------- 顶栏右侧图标 ---------- */
.head-actions {
  display: flex;
  gap: 8px;
}
.head-ico {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 15px;
  color: var(--pink-deep);
  background: rgba(255, 255, 255, 0.8);
  box-shadow: var(--shadow-card);
}

/* ---------- 上半区舞台 ---------- */
.stage-area {
  position: relative;
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  background: var(--surface-soft);
  border-radius: var(--radius-lg);
  padding: 12px 10px;
  box-shadow: var(--shadow-card);
}

/* 左侧竖排缩略 */
.thumbs {
  flex-shrink: 0;
  width: 52px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow-y: auto;
}
.thumb {
  width: 52px;
  border-radius: 12px;
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
  width: 56px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 340px;
  overflow-y: auto;
}
.tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 56px;
  padding: 6px 2px;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.82);
  box-shadow: var(--shadow-card);
  transition: transform 0.15s ease;
}
.tool:active {
  transform: scale(0.92);
}
.tool-ico {
  font-size: 20px;
}
.tool-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-2);
}

.create-entry {
  position: absolute;
  right: 12px;
  bottom: 12px;
  z-index: 3;
  padding: 7px 12px;
  border-radius: var(--radius-pill);
  font-size: 12px;
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
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.sel-chip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 10px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  box-shadow: var(--shadow-card);
  font-size: 12px;
  color: var(--text-1);
}
.sel-emoji {
  font-size: 15px;
}
.sel-name {
  font-weight: 600;
}
.sel-x {
  font-size: 14px;
  color: var(--pink-deep);
  font-weight: 800;
}
.sel-empty {
  margin: 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
}

/* ---------- 下半区面板 ---------- */
.panel {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: var(--surface-soft);
  border-radius: var(--radius-lg);
  padding: 12px 12px 4px;
  box-shadow: var(--shadow-card);
}

.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.chip {
  flex-shrink: 0;
  padding: 6px 14px;
  border-radius: var(--radius-pill);
  font-size: 13px;
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
  overflow-y: auto;
  padding-bottom: 12px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.empty {
  padding-top: 40px;
  text-align: center;
  color: var(--text-3);
}
.empty-emoji {
  font-size: 40px;
}

/* ---------- 轻提示 ---------- */
.toast {
  position: fixed;
  left: 50%;
  bottom: 84px;
  transform: translateX(-50%);
  z-index: 50;
  max-width: 78%;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  background: rgba(40, 30, 55, 0.86);
  color: #fff;
  font-size: 13px;
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
  transform: translate(-50%, 8px);
}
</style>
