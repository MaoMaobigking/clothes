<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import SegTabs from '@/components/SegTabs/SegTabs.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import SceneWeather from './SceneWeather.vue'
import { SCENES, OUTFIT_RECOS, SCENE_MODES, WEATHER } from '@/data/mock'
import { fetchSceneOutfits, type SceneOutfit } from '@/api/ai'
import { useProfileStore } from '@/stores/profile'

const profileStore = useProfileStore()

const tab = ref('try') // 'try' | 'ai'

/* ---- 轻提示 ---- */
const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toast.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toast.value = ''), 1800)
}

/* ---- 本地兜底：OUTFIT_RECOS 轮换 ---- */
const recoIndex = ref(0)
const currentReco = computed(() => OUTFIT_RECOS[recoIndex.value])

/* ---- AI 推荐 ---- */
const aiOutfits = ref<SceneOutfit[] | null>(null)
const aiIdx = ref(0)
const aiLoading = ref(false)
const aiError = ref('')

async function generateAi() {
  aiLoading.value = true
  aiError.value = ''
  try {
    const outfits = await fetchSceneOutfits({
      scene: currentScene.value.label,
      weather: { city: WEATHER.city, temp: WEATHER.temp, condition: WEATHER.condition },
      profile: { styles: profileStore.styleLabels },
    })
    if (outfits.length) {
      aiOutfits.value = outfits
      aiIdx.value = 0
    } else {
      aiError.value = 'AI 没返回结果'
    }
  } catch (e) {
    aiError.value = e instanceof Error ? e.message : String(e)
  } finally {
    aiLoading.value = false
  }
}

const usingAi = computed(() => Boolean(aiOutfits.value?.length))

/** 统一给模板用的形状（AI 的没有图，本地的有 img/渐变） */
interface ShownPiece {
  name: string
  emoji: string
  img?: string
  from?: string
  to?: string
}
const shownReco = computed<{ title: string; reason: string; pieces: ShownPiece[] }>(() => {
  if (aiOutfits.value?.length) {
    const o = aiOutfits.value[aiIdx.value % aiOutfits.value.length]
    return { title: o.title, reason: o.reason, pieces: o.pieces.map((p) => ({ name: p.name, emoji: p.emoji })) }
  }
  const r = currentReco.value
  return {
    title: r.title,
    reason: '',
    pieces: r.pieces.map((p) => ({ name: p.name, emoji: p.emoji, img: p.img, from: p.from, to: p.to })),
  }
})

function onRefresh() {
  if (usingAi.value && aiIdx.value < aiOutfits.value!.length - 1) {
    aiIdx.value++ // 先在已生成的几套里翻
  } else {
    generateAi() // 翻完 / 还没生成 → 重新让 AI 生成
  }
}

function buyAll() {
  showToast('已加入购物车，去结算吧 🛍️')
}
function matchAll() {
  uni.navigateTo({ url: '/pages/free-match/index' })
}

/* ---- 虚拟试穿：场景单选 ---- */
const selectedScene = ref(SCENES[0].key)
const currentScene = computed(
  () => SCENES.find((s) => s.key === selectedScene.value) ?? SCENES[0],
)
const favScenes = ref<Set<string>>(new Set())
function toggleFav(key: string) {
  const next = new Set(favScenes.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  favScenes.value = next
}
function saveLook() {
  showToast(`已保存「${currentScene.value.label}」造型到穿搭日记 📔`)
}

/* ---- 底部模式单选（默认中间高亮） ---- */
const selectedMode = ref(SCENE_MODES[1].key)
const currentModeDesc = computed(
  () => SCENE_MODES.find((m) => m.key === selectedMode.value)?.desc ?? '',
)

/* 切到 AI 推荐 tab 时自动生成一次 */
watch(tab, (t) => {
  if (t === 'ai' && !aiOutfits.value && !aiLoading.value) generateAi()
})
</script>

<template>
  <view class="page">
    <PageHeader title="情景模拟" to="/pages/home/home">
      <template #right>
        <button class="diary-btn" @tap="showToast('穿搭日记开发中 📔')">📔 穿搭日记</button>
      </template>
    </PageHeader>

    <view class="body scroll-y hide-scrollbar">
      <SegTabs
        v-model="tab"
        :tabs="[
          { key: 'try', label: '虚拟试穿' },
          { key: 'ai', label: 'AI推荐' },
        ]"
      />

      <SceneWeather />

      <!-- 虚拟试穿 -->
      <template v-if="tab === 'try'">
        <view>
          <view class="sec-title">穿搭适用场景选择</view>
          <view class="scene-chips">
            <button
              v-for="s in SCENES"
              :key="s.key"
              class="scene-chip"
              :class="{ on: selectedScene === s.key }"
              @tap="selectedScene = s.key"
            >
              <text class="sc-emoji">{{ s.emoji }}</text>
              <text class="sc-label">{{ s.label }}</text>
            </button>
          </view>
        </view>

        <view>
          <view class="sec-title">场景造型预览</view>
          <view class="preview-grid">
            <view
              v-for="s in SCENES"
              :key="s.key"
              class="preview-item"
              :class="{ on: selectedScene === s.key }"
              @tap="selectedScene = s.key"
            >
              <TileImage :src="s.img" from="#ffd6e8" to="#c9b8ff" :emoji="s.emoji" ratio="3 / 4" :label="s.label" />
              <view class="pv-acts" @tap.stop>
                <button class="pv-icon" :class="{ liked: favScenes.has(s.key) }" @tap="toggleFav(s.key)">
                  {{ favScenes.has(s.key) ? '❤️' : '🤍' }}
                </button>
                <button class="pv-icon" @tap="saveLook">⭐</button>
              </view>
            </view>
          </view>
          <button class="btn btn-primary save-btn" @tap="saveLook">保存这套造型</button>
        </view>
      </template>

      <!-- AI 推荐 -->
      <template v-else>
        <view>
          <view class="reco-head">
            <view class="sec-title">AI 搭配方式推荐</view>
            <button class="refresh" :class="{ spin: aiLoading }" aria-label="换一套" @tap="onRefresh">🔄</button>
          </view>

          <!-- 状态 -->
          <text v-if="aiLoading" class="status load">🤖 AI 正在按天气 + 你的风格生成搭配…</text>
          <text v-else-if="usingAi" class="status ok">✨ 由 AI 实时生成（点 🔄 换一套）</text>
          <text v-else-if="aiError" class="status err">⚠️ {{ aiError }}（先看本地示意，点 🔄 重试）</text>

          <text class="reco-sub">{{ shownReco.title }}</text>
          <text v-if="shownReco.reason" class="reco-reason">{{ shownReco.reason }}</text>

          <view class="reco-grid">
            <view v-for="(p, i) in shownReco.pieces" :key="i" class="reco-item">
              <TileImage :src="p.img" :from="p.from" :to="p.to" :emoji="p.emoji" ratio="1 / 1" rounded="14px" />
              <text class="reco-name">{{ p.name }}</text>
            </view>
          </view>
        </view>

        <view class="cta">
          <button class="btn cta-ghost" @tap="buyAll">🛍️ 一键购买</button>
          <button class="btn btn-primary cta-primary" @tap="matchAll">🧥 一键搭配</button>
        </view>
      </template>

      <!-- 底部：穿搭搭配方式选择 -->
      <view class="modes">
        <view class="sec-title modes-title">穿搭搭配方式选择</view>
        <text class="mode-desc">{{ currentModeDesc }}</text>
        <view class="mode-chips">
          <button
            v-for="m in SCENE_MODES"
            :key="m.key"
            class="mode-chip"
            :class="{ on: selectedMode === m.key }"
            @tap="selectedMode = m.key"
          >
            <text class="mc-emoji">{{ m.emoji }}</text>
            <text class="mc-label">{{ m.label }}</text>
          </button>
        </view>
      </view>
    </view>

    <view v-if="toast" class="toast">{{ toast }}</view>
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
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.diary-btn {
  font-size: 12px;
  font-weight: 700;
  color: var(--purple-deep);
  background: rgba(255, 255, 255, 0.7);
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
  white-space: nowrap;
}

.sec-title {
  margin: 0 0 10px;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-1);
}

.scene-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.scene-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 8px 14px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  box-shadow: var(--shadow-card);
  transition: all 0.15s ease;
}
.scene-chip.on {
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  box-shadow: 0 6px 14px rgba(177, 140, 255, 0.4);
}
.sc-emoji {
  font-size: 15px;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.preview-item {
  position: relative;
  border-radius: var(--radius);
  transition: transform 0.15s ease;
}
.preview-item.on {
  transform: translateY(-2px);
  box-shadow: 0 8px 18px rgba(177, 140, 255, 0.35);
  outline: 2px solid var(--purple);
  border-radius: var(--radius);
}
.pv-acts {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.pv-icon {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: var(--shadow-card);
}
.pv-icon.liked {
  background: #fff;
}
.save-btn {
  height: 46px;
  width: 100%;
  margin-top: 14px;
}

.reco-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.refresh {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 18px;
  background: var(--surface);
  box-shadow: var(--shadow-card);
  transition: transform 0.2s ease;
}
.refresh.spin {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.status {
  margin: 8px 2px 4px;
  font-size: 12px;
  font-weight: 600;
}
.status.load {
  color: var(--purple-deep);
}
.status.ok {
  color: var(--pink-deep);
}
.status.err {
  color: #d9694f;
}
.reco-sub {
  margin: 6px 2px 4px;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
}
.reco-reason {
  margin: 0 2px 12px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.5;
}
.reco-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.reco-item {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.reco-name {
  font-size: 11px;
  color: var(--text-2);
  text-align: center;
}

.cta {
  display: flex;
  gap: 12px;
}
.cta-ghost,
.cta-primary {
  flex: 1;
  height: 50px;
  border-radius: var(--radius-pill);
  font-size: 15px;
  font-weight: 700;
}
.cta-ghost {
  background: var(--surface);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
}

.modes {
  margin-top: 4px;
  background: var(--surface-soft);
  border-radius: var(--radius-lg);
  padding: 14px;
  box-shadow: var(--shadow-card);
}
.modes-title {
  margin: 0 0 8px;
}
.mode-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-2);
  text-align: center;
  line-height: 1.5;
}
.mode-chips {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.mode-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 4px;
  border-radius: var(--radius);
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  transition: all 0.15s ease;
}
.mode-chip.on {
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  box-shadow: 0 6px 14px rgba(177, 140, 255, 0.4);
}
.mc-emoji {
  font-size: 20px;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 80px;
  transform: translateX(-50%);
  background: rgba(40, 30, 55, 0.9);
  color: #fff;
  font-size: 13px;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-float);
  z-index: 50;
  white-space: nowrap;
}
</style>
