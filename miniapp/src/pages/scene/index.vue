<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import OutfitPreview from '@/components/OutfitPreview/OutfitPreview.vue'
import OutfitPoster from '@/components/OutfitPoster/OutfitPoster.vue'
import SceneWeather from './SceneWeather.vue'
import {
  SCENE_FILTERS,
  SCENE_FILTER_GRADIENTS,
  SCENE_FILTER_OVERLAYS,
  SCENE_OPTIONS,
  SCENE_SEASONS,
  currentSeason,
  sceneFilterStyle,
  type SceneFilterKey,
  type SceneKey,
  type SceneMode,
} from '@/data/scene'
import { MODEL_IMAGES } from '@/data/mock'
import { piecesFromSceneItems } from '@/utils/outfitPieces'
import {
  buySceneOutfit,
  fetchScenePlans,
  getSceneOutfit,
  saveSceneOutfit,
  type SavedSceneOutfit,
  type ScenePlan,
  type ScenePlanItem,
  type ScenePlanResult,
  type SceneWeatherInfo,
} from '@/api/scene'
import { isAuthError } from '@/api/http'
import { useProfileStore } from '@/stores/profile'
import { useWardrobeStore } from '@/stores/wardrobe'

const wardrobe = useWardrobeStore()
const profile = useProfileStore()

const selectedScene = ref<SceneKey>('daily')
const season = ref(currentSeason())
const mode = ref<SceneMode>('mixed')
const filterKey = ref<SceneFilterKey>('day')
const compareMode = ref(false)
const planIndex = ref(0)
const loading = ref(false)
const errorMessage = ref('')
const result = ref<ScenePlanResult | null>(null)
const weather = ref<SceneWeatherInfo>({
  city: '杭州',
  temp: 20,
  condition: '多云',
  icon: '⛅',
  source: 'fallback',
})
const sourceOutfitId = ref('')

const toast = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(message: string) {
  toast.value = message
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    toast.value = ''
  }, 1800)
}

const scene = computed(
  () => SCENE_OPTIONS.find((item) => item.key === selectedScene.value) ?? SCENE_OPTIONS[0],
)

const currentPlans = computed<ScenePlan[]>(() => {
  if (!result.value) return []
  const pure = result.value.plans.pure[planIndex.value % result.value.plans.pure.length]
  const mixed = result.value.plans.mixed[planIndex.value % result.value.plans.mixed.length]
  if (compareMode.value) return [pure, mixed].filter(Boolean)
  return [mode.value === 'pure' ? pure : mixed].filter(Boolean)
})

const activePlan = computed<ScenePlan | null>(() => {
  if (!result.value) return null
  const plans = result.value.plans[mode.value]
  return plans[planIndex.value % plans.length] ?? null
})

const newItems = computed(() =>
  (activePlan.value?.items ?? []).filter((item) => item.isNew),
)

const oldItems = computed(() =>
  (activePlan.value?.items ?? []).filter((item) => !item.isNew),
)

const filterStyle = computed(() => sceneFilterStyle(filterKey.value))
const filterOverlay = computed(() => SCENE_FILTER_OVERLAYS[filterKey.value])
const posterGradient = computed(() => SCENE_FILTER_GRADIENTS[filterKey.value])

/**
 * 效果图与海报共用的人台（§10.8：对比两版必须同一个模特和场景背景）。
 * 对比模式下两张卡都读这一个值，只有衣物层不同。
 */
const modelImage = computed(() =>
  profile.profile.gender === 'male' ? MODEL_IMAGES.frontMale : MODEL_IMAGES.front,
)

const stageCaption = computed(
  () =>
    `${scene.value.label} · ${weather.value.city} ${weather.value.condition} ${weather.value.temp}℃`,
)

async function generate() {
  loading.value = true
  errorMessage.value = ''
  try {
    const data = await fetchScenePlans({
      sceneKey: selectedScene.value,
      season: season.value,
      weather: weather.value,
    })
    result.value = data
    planIndex.value = 0
    sourceOutfitId.value = ''
  } catch (error) {
    // 未登录已由请求层跳登录页，页面不用再挂一条报错（规格 §5）
    if (!isAuthError(error)) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    }
  } finally {
    loading.value = false
  }
}

function onWeatherChange(value: SceneWeatherInfo) {
  weather.value = value
}

function cyclePlan() {
  if (!result.value) return
  const length = result.value.plans[mode.value].length
  planIndex.value = (planIndex.value + 1) % Math.max(1, length)
}

function copyText(text: string, successMessage: string) {
  uni.setClipboardData({
    data: text,
    success: () => showToast(successMessage),
    fail: () => showToast('复制失败，请手动复制'),
  })
}

function copyTaokouling(item: ScenePlanItem) {
  if (!item.taokouling) {
    showToast('该单品暂未配置淘口令')
    return
  }
  copyText(item.taokouling, `已复制「${item.name}」淘口令`)
}

async function saveTemplate() {
  if (!activePlan.value || !result.value) return
  loading.value = true
  try {
    const outfit = await saveSceneOutfit({
      sceneKey: selectedScene.value,
      title: `${scene.value.label} · ${season.value}`,
      season: season.value,
      mode: activePlan.value.mode,
      filterKey: filterKey.value,
      weather: weather.value,
      composition: activePlan.value.items,
    })
    sourceOutfitId.value = String(outfit.id)
    showToast('已保存到我的搭配')
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存失败')
  } finally {
    loading.value = false
  }
}

const shareText = computed(() => {
  if (!activePlan.value) return `${scene.value.label}场景穿搭`
  return [
    `${scene.value.label} · ${season.value}`,
    `基于 ${weather.value.city} ${weather.value.condition} ${weather.value.temp}℃`,
    activePlan.value.items.map((item) => item.name).join(' / '),
    `搭配理由：${activePlan.value.reason}`,
  ].join('\n')
})

function shareScene() {
  copyText(shareText.value, '分享文案已复制')
}

const purchaseSummary = ref<{
  added: {
    itemId: string
    name: string
    price: number
    taokouling: string
  }[]
  ignored: string[]
} | null>(null)

async function buyAll() {
  if (!activePlan.value) return
  if (!newItems.value.length) {
    showToast('纯旧衣方案没有需要购买的新品')
    return
  }
  loading.value = true
  try {
    const summary = await buySceneOutfit(
      newItems.value.map((item) => item.id),
      activePlan.value.id,
    )
    purchaseSummary.value = summary
  } catch (error) {
    showToast(error instanceof Error ? error.message : '加入购物车失败')
  } finally {
    loading.value = false
  }
}

function goOutfits() {
  uni.navigateTo({ url: '/pages/outfits/index' })
}

async function hydrateSavedOutfit(outfit: SavedSceneOutfit) {
  selectedScene.value = outfit.sceneKey
  season.value = (SCENE_SEASONS as readonly string[]).includes(outfit.season)
    ? (outfit.season as typeof SCENE_SEASONS[number])
    : currentSeason()
  mode.value = outfit.mode
  filterKey.value = outfit.filterKey
  weather.value = {
    city: outfit.weather?.city || '杭州',
    temp: Number(outfit.weather?.temp) || 20,
    condition: outfit.weather?.condition || '多云',
    icon: outfit.weather?.icon || '⛅',
    source: outfit.weather?.source || 'fallback',
  }
  sourceOutfitId.value = String(outfit.id)
  await generate()
  const targetMode = result.value?.plans[outfit.mode] ?? []
  const targetIndex = targetMode.findIndex((plan) =>
    plan.items.every((item, index) => outfit.composition[index]?.id === item.id),
  )
  if (targetIndex >= 0) {
    planIndex.value = targetIndex
  }
}

onLoad(async (options) => {
  // 人台按性别取，画像没加载就永远是女款（§10.8 两版共用同一个模特）
  profile.loadPersisted()
  await wardrobe.load()
  const savedId = Number(options?.outfitId)
  if (Number.isInteger(savedId) && savedId > 0) {
    try {
      const outfit = await getSceneOutfit(savedId)
      await hydrateSavedOutfit(outfit)
      return
    } catch (error) {
      if (!isAuthError(error)) {
        errorMessage.value = error instanceof Error ? error.message : '模板读取失败'
      }
    }
  }
  await generate()
})

onShareAppMessage(() => ({
  title: shareText.value,
  path: `/pages/scene/index?outfitId=${sourceOutfitId.value || ''}`,
}))

const posterVisible = ref(false)
const posterRef = ref<InstanceType<typeof OutfitPoster> | null>(null)

const posterSubtitle = computed(
  () =>
    `${weather.value.city} ${weather.value.condition} ${weather.value.temp}℃ · ${season.value}`,
)

const posterPieces = computed(() => piecesFromSceneItems(activePlan.value?.items ?? []))

/**
 * 海报导出（规格 §10.10）。
 *
 * 以前这里是一段自己写的 canvas：渐变底 + 人台 + 文字清单，没有真实衣物，
 * 而且 H5 端 saveImageToPhotosAlbum 必然失败。现在复用功能二的 OutfitPoster，
 * 把场景底图与当前滤镜一并传进去 —— 海报里有真实搭配、场景背景和滤镜，
 * H5 走浏览器下载，小程序走相册。
 */
function exportPoster() {
  if (!activePlan.value) {
    showToast('先生成一套方案再导出海报')
    return
  }
  posterVisible.value = true
}

function savePoster() {
  posterRef.value?.savePoster()
}
</script>

<template>
  <view class="page">
    <PageHeader title="场景模拟" to="/pages/home/home">
      <template #right>
        <button class="header-action" @tap="goOutfits">我的搭配</button>
      </template>
    </PageHeader>

    <scroll-view class="body" scroll-y>
      <SceneWeather v-model="weather" @change="onWeatherChange" />

      <view class="control-card">
        <view class="section-head">
          <text class="section-title">选择场景</text>
          <text class="section-sub">{{ scene.keywords.join(' · ') }}</text>
        </view>
        <view class="scene-grid">
          <button
            v-for="item in SCENE_OPTIONS"
            :key="item.key"
            class="scene-option"
            :class="{ on: selectedScene === item.key }"
            @tap="selectedScene = item.key"
          >
            <text class="scene-emoji">{{ item.emoji }}</text>
            <text class="scene-label">{{ item.label }}</text>
          </button>
        </view>

        <view class="control-row">
          <text class="control-label">季节</text>
          <view class="season-chips">
            <button
              v-for="item in SCENE_SEASONS"
              :key="item"
              class="mini-chip"
              :class="{ on: season === item }"
              @tap="season = item"
            >
              {{ item }}
            </button>
          </view>
        </view>

        <view class="control-row">
          <text class="control-label">模式</text>
          <view class="mode-switch">
            <button
              class="mode-button"
              :class="{ on: mode === 'pure' }"
              @tap="mode = 'pure'"
            >
              仅旧衣
            </button>
            <button
              class="mode-button"
              :class="{ on: mode === 'mixed' }"
              @tap="mode = 'mixed'"
            >
              新旧混搭
            </button>
          </view>
        </view>

        <button class="btn btn-primary generate-btn" :class="{ busy: loading }" @tap="generate">
          {{ loading ? '正在生成…' : '生成场景穿搭' }}
        </button>
        <text v-if="errorMessage" class="error-message">{{ errorMessage }}</text>
      </view>

      <view v-if="result" class="result-area">
        <view class="active-banner">
          <text class="active-title">
            已为你激活 {{ result.activatedGarmentCount }} 件旧衣
          </text>
          <text class="active-sub">
            生成 3 套纯旧衣与 3 套新旧混搭方案
          </text>
        </view>

        <view class="filter-row">
          <button
            v-for="item in SCENE_FILTERS"
            :key="item.key"
            class="filter-chip"
            :class="{ on: filterKey === item.key }"
            @tap="filterKey = item.key"
          >
            {{ item.label }}
          </button>
          <button
            class="filter-chip compare"
            :class="{ on: compareMode }"
            @tap="compareMode = !compareMode"
          >
            对比旧衣
          </button>
        </view>

        <view class="plan-actions">
          <button class="plan-action" @tap="cyclePlan">换一套</button>
          <text class="plan-count">{{ planIndex + 1 }} / {{ result.plans[mode].length }}</text>
        </view>

        <view class="plan-grid" :class="{ compare: compareMode }">
          <view v-for="plan in currentPlans" :key="plan.id" class="plan-card">
            <!--
              效果图用真实衣物照片叠在统一人台上（§10.7 §10.8）。
              对比模式下两张卡的 model / background 是同一个值，只有 pieces 不同。
            -->
            <OutfitPreview
              :pieces="piecesFromSceneItems(plan.items)"
              :background="scene.img"
              :background-emoji="scene.emoji"
              :filter-style="filterStyle"
              :model="modelImage"
              :caption="stageCaption"
              :height="compareMode ? '360rpx' : '520rpx'"
            />

            <view class="plan-head">
              <view class="plan-title-wrap">
                <text class="plan-title">{{ plan.title }}</text>
                <text class="plan-tag">{{ plan.mode === 'pure' ? '纯旧衣' : '新旧混搭' }}</text>
              </view>
              <text class="plan-reason">{{ plan.reason }}</text>
            </view>

            <view class="item-grid">
              <view v-for="item in plan.items" :key="item.id" class="item">
                <TileImage
                  :src="item.imageUrl"
                  :from="item.from"
                  :to="item.to"
                  :emoji="item.emoji"
                  ratio="1 / 1"
                  rounded="12px"
                />
                <text class="item-name">{{ item.name }}</text>
                <text class="item-tag">{{ item.isNew ? '新增单品' : '衣橱旧衣' }}</text>
                <text v-if="item.isNew" class="item-price">¥{{ item.price.toFixed(2) }}</text>
              </view>
            </view>

            <view v-if="plan.mode === 'mixed'" class="new-panel">
              <text class="new-title">新品购买</text>
              <view
                v-for="item in plan.items.filter((piece) => piece.isNew)"
                :key="item.id"
                class="new-row"
              >
                <text class="new-name">{{ item.name }}</text>
                <button
                  v-if="item.taokouling"
                  class="copy-button"
                  @tap="copyTaokouling(item)"
                >
                  复制淘口令
                </button>
              </view>
            </view>
          </view>
        </view>

        <view class="difference-note">
          <text class="difference-title">旧衣与新衣差异</text>
          <text class="difference-text">
            旧衣：{{ oldItems.map((item) => item.name).join('、') || '本套方案没有独立旧衣单列' }}
          </text>
          <text class="difference-text">
            新增：{{ newItems.map((item) => item.name).join('、') || '无新增单品' }}
          </text>
        </view>

        <view class="action-grid">
          <button class="action-button" @tap="saveTemplate">保存模板</button>
          <button class="action-button" @tap="shareScene">分享</button>
          <button class="action-button" @tap="exportPoster">保存海报</button>
          <button class="action-button primary" @tap="buyAll">一键购买</button>
        </view>
      </view>
    </scroll-view>

    <view v-if="purchaseSummary" class="modal-mask" @tap="purchaseSummary = null">
      <view class="modal-sheet" @tap.stop>
        <text class="modal-title">已加入购物车</text>
        <view
          v-for="item in purchaseSummary.added"
          :key="item.itemId"
          class="purchase-row"
        >
          <view class="purchase-info">
            <text class="purchase-name">{{ item.name }}</text>
            <text class="purchase-price">¥{{ item.price.toFixed(2) }}</text>
          </view>
          <button class="copy-button" @tap="copyText(item.taokouling, '淘口令已复制')">
            复制淘口令
          </button>
        </view>
        <button class="btn btn-primary modal-close" @tap="purchaseSummary = null">完成</button>
      </view>
    </view>

    <view v-if="posterVisible" class="modal-mask" @tap="posterVisible = false">
      <view class="poster-sheet" @tap.stop>
        <text class="modal-title">场景海报</text>
        <OutfitPoster
          ref="posterRef"
          :title="`${scene.label} · ${season}`"
          :subtitle="posterSubtitle"
          :pieces="posterPieces"
          :background="scene.img"
          :gradient="posterGradient"
          :overlay="filterOverlay"
          :file-name="`${scene.label}-${season}`"
        />
        <text class="poster-message">海报含当前真实搭配、场景背景与滤镜</text>
        <view class="poster-actions">
          <button class="action-button" @tap="shareScene">复制文案</button>
          <button class="action-button primary" @tap="savePoster">保存图片</button>
        </view>
        <button class="btn btn-ghost modal-close" @tap="posterVisible = false">关闭</button>
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
  padding: 12px 16px 22px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.header-action {
  padding: 6px 12px;
  border-radius: var(--radius-pill);
  background: var(--surface);
  color: var(--purple-deep);
  font-size: 12px;
  font-weight: 700;
  box-shadow: var(--shadow-card);
  white-space: nowrap;
}

.control-card,
.result-area,
.difference-note {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 10px;
}
.section-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text-1);
}
.section-sub {
  font-size: 12px;
  color: var(--text-2);
}
.scene-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 9px;
}
.scene-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 10px 4px;
  border-radius: var(--radius);
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 700;
  transition: all 0.15s ease;
}
.scene-option.on {
  color: var(--text-on-brand);
  background: var(--brand-gradient);
  box-shadow: 0 5px 14px rgba(177, 140, 255, 0.35);
}
.scene-emoji {
  font-size: 24px;
}
.scene-label {
  line-height: 1.2;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.control-label {
  width: 42px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}
.season-chips,
.mode-switch {
  flex: 1;
  display: flex;
  gap: 8px;
}
.mini-chip,
.mode-button {
  flex: 1;
  min-width: 0;
  height: 36px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
}
.mini-chip.on,
.mode-button.on {
  color: var(--text-on-brand);
  background: var(--brand-gradient);
}
.generate-btn {
  height: 46px;
}
.generate-btn.busy {
  opacity: 0.7;
}
.error-message {
  color: #d9694f;
  font-size: 12px;
  text-align: center;
}

.active-banner {
  background: var(--brand-gradient);
  border-radius: var(--radius);
  padding: 12px;
  color: var(--text-on-brand);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.active-title {
  font-size: 15px;
  font-weight: 800;
}
.active-sub {
  font-size: 12px;
  opacity: 0.9;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.filter-chip {
  height: 34px;
  padding: 0 14px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 700;
}
.filter-chip.on {
  color: var(--text-on-brand);
  background: var(--brand-gradient);
}
.filter-chip.compare.on {
  background: var(--pink-deep);
}

.plan-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.plan-action {
  height: 34px;
  padding: 0 16px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  color: var(--purple-deep);
  font-size: 12px;
  font-weight: 700;
}
.plan-count {
  font-size: 12px;
  color: var(--text-2);
  font-weight: 600;
}

.plan-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}
.plan-grid.compare {
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.plan-card {
  min-width: 0;
  background: var(--surface-soft);
  border-radius: var(--radius);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.plan-head {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.plan-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.plan-title {
  flex: 1;
  font-size: 13px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.35;
}
.plan-tag {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}
.plan-reason {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-2);
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 7px;
}
.item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.item-name {
  font-size: 10px;
  color: var(--text-1);
  line-height: 1.25;
  min-height: 25px;
}
.item-tag {
  align-self: flex-start;
  padding: 2px 5px;
  border-radius: 6px;
  background: rgba(177, 140, 255, 0.14);
  color: var(--purple-deep);
  font-size: 9px;
  font-weight: 700;
}
.item-price {
  font-size: 11px;
  font-weight: 800;
  color: var(--pink-deep);
}

.new-panel {
  display: flex;
  flex-direction: column;
  gap: 7px;
  background: var(--surface);
  border-radius: 9px;
  padding: 9px;
}
.new-title {
  font-size: 12px;
  font-weight: 800;
  color: var(--text-1);
}
.new-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.new-name {
  flex: 1;
  font-size: 11px;
  color: var(--text-2);
}
.copy-button {
  flex-shrink: 0;
  height: 28px;
  padding: 0 9px;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
}

.difference-note {
  gap: 7px;
}
.difference-title {
  font-size: 13px;
  font-weight: 800;
  color: var(--text-1);
}
.difference-text {
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-2);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.action-button {
  min-width: 0;
  height: 40px;
  padding: 0 5px;
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
  font-size: 11px;
  font-weight: 700;
}
.action-button.primary {
  color: #fff;
  background: var(--brand-gradient);
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(40, 24, 48, 0.38);
  display: flex;
  align-items: flex-end;
}
.modal-sheet,
.poster-sheet {
  width: 100%;
  max-height: 88%;
  overflow-y: auto;
  background: var(--surface);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  padding: 18px 16px calc(18px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.modal-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-1);
  text-align: center;
}
.purchase-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.purchase-info {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.purchase-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-1);
}
.purchase-price {
  font-size: 12px;
  color: var(--pink-deep);
  font-weight: 700;
}
.modal-close {
  height: 42px;
}

.poster-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.poster-message {
  font-size: 12px;
  color: var(--text-2);
  text-align: center;
}

.toast {
  position: fixed;
  left: 50%;
  bottom: 72px;
  transform: translateX(-50%);
  z-index: 80;
  max-width: 86%;
  padding: 10px 18px;
  border-radius: var(--radius-pill);
  background: rgba(40, 24, 48, 0.88);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: var(--shadow-float);
}
</style>
