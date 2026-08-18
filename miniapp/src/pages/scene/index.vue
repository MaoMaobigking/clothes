<script setup lang="ts">
import { iconForEmoji } from '@/utils/icons'
import { computed, ref } from 'vue'
import { onLoad, onShareAppMessage } from '@dcloudio/uni-app'
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
/*
 * 只导入**类型**，不导入值。
 *
 * OutfitPoster 在模板里靠 easycom 自动注册（显式 import 组件会触发
 * uni-app 的组件路径 marker 前向引用 bug，全站白屏）。
 * 但下面 posterRef 的 `InstanceType<typeof OutfitPoster>` 需要这个标识符存在，
 * 否则 vue-tsc 报 TS2304 Cannot find name。
 * `import type` 会被编译器完全擦除，产物里不会留 require —— 两边都满足。
 */
import type OutfitPoster from '@/components/OutfitPoster/OutfitPoster.vue'
import { MOMENT_HINT } from '@/utils/share'

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

/*
 * 顶部分段：虚拟试穿 / AI推荐（对齐样图）。
 * 目前两个 tab 共用同一套数据，区别只在「虚拟试穿」把效果图放大、
 * 「AI推荐」以单品网格为主 —— 真正的虚拟试穿是后续功能。
 */
const topTab = ref<'tryon' | 'ai'>('ai')

/*
 * 进阶面板：场景选择 / 季节 / 模式 / 生成 / 滤镜 / 对比 / 模板 / 海报。
 * 样图上这些都没画，按「只做样图上有的，其余先隐」收进右上角「＋」里，
 * **代码一行没删** —— 展开就还是原来那套。
 */
const showAdvanced = ref(false)

const WEEK_LABELS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

const todayLabel = computed(() => {
  const now = new Date()
  return `${now.getMonth() + 1}月${now.getDate()}日 ${WEEK_LABELS[now.getDay()]}`
})

/** 当前天气的线性图标（接口和 MANUAL_WEATHER 里存的还是 emoji，查表换） */
const weatherIconName = computed(() => iconForEmoji(weather.value.icon) ?? 'w-cloud')

const FORECAST_ICONS = ['w-cloud', 'w-sun', 'w-rain', 'w-cloud-sun', 'w-storm'] as const

/*
 * 未来三天预报。
 *
 * ⚠️ **这是本地推导的演示数据，不是真实预报。**
 * 后端 resolveWeather()（server/services/sceneService.mjs）只返回「当前天气」，
 * OpenWeather 的 forecast 接口还没接。等后端补上 forecast 字段后，
 * 把这里换成读 weather.value.forecast 即可，模板不用动。
 *
 * 用「日期 + 城市名长度」做种子而不是 Math.random()：
 * 同一天同一城市每次渲染结果一致，否则列表会在每次重绘时跳数字。
 */
const forecast = computed(() => {
  const base = Number(weather.value.temp) || 20
  const now = new Date()
  return [1, 2, 3].map((offset) => {
    const day = new Date(now.getTime() + offset * 86400000)
    const seed = (day.getDate() + weather.value.city.length + offset * 3) % 5
    return {
      key: `d${offset}`,
      label: WEEK_LABELS[day.getDay()],
      high: base + 4 + seed,
      low: base - 3 + (seed % 3),
      icon: FORECAST_ICONS[seed],
    }
  })
})

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

/*
 * 样图中部那个 2×3 单品网格。
 * 取当前方案的前 6 件 —— 样图就是 6 格，多了排不下、少了留空。
 */
const gridItems = computed(() => (activePlan.value?.items ?? []).slice(0, 6))

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
/*
 * ⚠️ 人台图暂时不渲染 —— 用户要求「把模特删掉，后续再添加」。
 * static/images/model/ 下只有 front.png 和 front-male.png 两张，效果不到位。
 *
 * 按性别选图的逻辑原样保留在下面，只是被 SHOW_MODEL 关掉了：
 * 素材到位后把 SHOW_MODEL 改成 true 就恢复，不用重写。
 * OutfitPreview 收到空 model 会渲染中性占位框（见该组件的 v-if="model && !modelFailed"）。
 */
const SHOW_MODEL = false
const modelImage = computed(() =>
  SHOW_MODEL
    ? profile.profile.gender === 'male'
      ? MODEL_IMAGES.frontMale
      : MODEL_IMAGES.front
    : '',
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
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      showToast(error instanceof Error ? error.message : '保存失败')
    }
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
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      showToast(error instanceof Error ? error.message : '加入购物车失败')
    }
  } finally {
    loading.value = false
  }
}

/*
 * 单品详情（客户需求原文：单品列表可点击跳转详情）。
 *
 * 做成页内弹层而不是跳商城详情页，是因为商城页在 tabBar 里 ——
 * switchTab 不接受 query 参数，要跳过去还得靠 storage 传 id，
 * 反而比在本页展示更绕。plan.items 里已有 name/price/season/tags/淘口令，
 * 详情要显示的字段一个不缺。
 */
const itemDetail = ref<ScenePlanItem | null>(null)

/** 详情里单件加购：复用整套购买那条接口，只传这一个 id */
async function addDetailToCart() {
  const item = itemDetail.value
  if (!item || !item.isNew || !activePlan.value) return
  loading.value = true
  try {
    purchaseSummary.value = await buySceneOutfit([item.id], activePlan.value.id)
    itemDetail.value = null
  } catch (error) {
    if (!isAuthError(error)) {
      showToast(error instanceof Error ? error.message : '加入购物车失败')
    }
  } finally {
    loading.value = false
  }
}

function goClosetFromDetail() {
  itemDetail.value = null
  uni.switchTab({ url: '/pages/closet/closet' })
}

/*
 * 穿搭日记（样图里天气卡右上角那个入口）。
 * 带上今天的日期，进去直接是「记录今天」的面板，不用再点一次日历。
 * 日期在这里拼成 YYYY-MM-DD 字符串 —— 不能用 toISOString()，那个按 UTC 算，
 * 东八区上午 8 点前会退回前一天。
 */
function goDiary() {
  const d = new Date()
  const p = (n: number) => (n < 10 ? `0${n}` : String(n))
  const today = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  uni.navigateTo({ url: `/pages/diary/index?date=${today}` })
}

/** 「个性化定制」→ 差异化定制页 */
function goCustom() {
  uni.navigateTo({ url: '/pages/custom/index' })
}

/** 「一键预约」→ 走定制的量体预约入口 */
function goBooking() {
  uni.navigateTo({ url: '/pages/custom/index' })
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
    <PageHeader title="情景模拟" to="/pages/ai/ai">
      <template #right>
        <!--
          样图右上角是一个「＋」。它展开下面那块进阶面板
          （场景选择 / 季节 / 模式 / 生成 / 滤镜 / 对比 / 模板 / 海报）——
          这些功能样图上没画，但代码都在，收起来而不是删掉。
        -->
        <view class="hdr-btn" :class="{ on: showAdvanced }" @tap="showAdvanced = !showAdvanced">
          <UiIcon :name="showAdvanced ? 'close' : 'plus'" :size="34" :tone="showAdvanced ? 'brand' : 'dark'" />
        </view>
      </template>
    </PageHeader>

    <SegTabs
      v-model="topTab"
      :tabs="[
        { key: 'tryon', label: '虚拟试穿' },
        { key: 'ai', label: 'AI推荐' },
      ]"
      class="top-seg"
    />

    <scroll-view class="body" scroll-y>
      <!--
        天气卡：定位 + 穿搭日记 + 日期 + 当前天气 + 未来三天预报（对齐样图）。
        .card 给结构、.card-glass 覆盖成毛玻璃面（半透明白 + 粉/薄荷光晕）。
        安卓端 backdrop-filter 不生效，退化成带柔光的浅色面 —— 所以这卡里
        不放浅灰小字，最弱的一档是 .wc-date 的 --text-3。
      -->
      <view class="card card-glass weather-card">
        <view class="wc-head">
          <view class="wc-loc">
            <UiIcon name="location" :size="28" tone="brand" />
            <text class="wc-city">{{ weather.city }}</text>
          </view>
          <view class="wc-diary pill-macaron pill-macaron-mint" @tap="goDiary">
            <UiIcon name="calendar" :size="28" tone="macaron-mint" />
            <text>穿搭日记</text>
          </view>
        </view>

        <text class="wc-date">{{ todayLabel }}</text>

        <view class="wc-forecast">
          <!-- 今天：图标 + 实温 + 天气描述，占两倍宽，和后面三天拉开层级 -->
          <view class="fc fc-today">
            <UiIcon :name="weatherIconName" :size="56" tone="dark" />
            <text class="fc-temp-now">{{ weather.temp }}℃</text>
            <text class="fc-cond">{{ weather.condition }}</text>
          </view>
          <view v-for="day in forecast" :key="day.key" class="fc">
            <text class="fc-day">{{ day.label }}</text>
            <UiIcon :name="day.icon" :size="40" tone="muted" />
            <text class="fc-range">{{ day.high }}/{{ day.low }}</text>
          </view>
        </view>
      </view>

      <!--
        进阶面板。默认收起，右上「＋」展开。
        原来这块（含 SceneWeather 的手动改天气）是常驻的，样图上没有。
      -->
      <view v-if="showAdvanced" class="control-card">
        <SceneWeather v-model="weather" @change="onWeatherChange" />

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
            <UiIcon class="scene-emoji" :name="iconForEmoji(item.emoji) ?? 'image'" :size="46" tone="soft" />
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
        <!-- AI 搭配方式推荐（样图正中那块） -->
        <view class="rec-head">
          <view class="rec-left">
            <text class="section-title">AI搭配方式推荐</text>
            <view class="rec-refresh" aria-label="换一套" @tap="cyclePlan">
              <UiIcon name="refresh" :size="30" tone="soft" />
            </view>
          </view>
          <view class="rec-right">
            <text class="rec-link" @tap="buyAll">一键购买</text>
            <text class="rec-sep">·</text>
            <text class="rec-link" @tap="goBooking">一键预约</text>
          </view>
        </view>

        <!--
          2×3 单品网格。样图就是 6 格，gridItems 已经截到 6 件。
          点格子开单品详情弹层 —— 和下面「虚拟试穿」tab 的 .item-grid 同一个弹层，
          客户原文的「点击单品跳转详情」指的就是默认这屏看得见的这批格子。
        -->
        <view class="rec-grid">
          <view v-for="item in gridItems" :key="item.id" class="rec-cell" @tap="itemDetail = item">
            <TileImage :src="item.imageUrl" :emoji="item.emoji" ratio="1 / 1" />
          </view>
        </view>

        <!-- 穿搭搭配方式选择（样图底部三按钮，等宽） -->
        <text class="section-title mode-title">穿搭搭配方式选择</text>
        <view class="mode-row">
          <view class="mode-pill" :class="{ on: mode === 'mixed' }" @tap="mode = 'mixed'">
            新旧混搭
          </view>
          <view class="mode-pill" :class="{ on: mode === 'pure' }" @tap="mode = 'pure'">
            旧衣新生
          </view>
          <view class="mode-pill" @tap="goCustom">个性化定制</view>
        </view>

        <!--
          效果图大卡。「虚拟试穿」tab 或展开进阶时才出现 ——
          「AI推荐」tab 按样图是以单品网格为主，不放整张效果图。
        -->
        <template v-if="topTab === 'tryon' || showAdvanced">
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
              <view
                v-for="item in plan.items"
                :key="item.id"
                class="item"
                @tap="itemDetail = item"
              >
                <TileImage
                  :src="item.imageUrl"
                  :from="item.from"
                  :to="item.to"
                  :emoji="item.emoji"
                  ratio="1 / 1"
                  rounded="24rpx"
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

          <!-- 一键购买已提到上面 rec-head 里（对齐样图），这里不再重复一个 -->
          <view class="action-grid">
            <button class="action-button" @tap="saveTemplate">保存模板</button>
            <button class="action-button" @tap="shareScene">分享</button>
            <button class="action-button" @tap="exportPoster">保存海报</button>
          </view>
        </template>
      </view>
    </scroll-view>

    <BottomNav active="ai" />

    <!-- 单品详情弹层：新品给价格 + 淘口令 + 加购，旧衣给衣橱入口 -->
    <view v-if="itemDetail" class="modal-mask" @tap="itemDetail = null">
      <view class="modal-sheet" @tap.stop>
        <text class="modal-title">{{ itemDetail.name }}</text>
        <view class="detail-body">
          <TileImage
            class="detail-image"
            :src="itemDetail.imageUrl"
            :from="itemDetail.from"
            :to="itemDetail.to"
            :emoji="itemDetail.emoji"
            ratio="1 / 1"
            rounded="24rpx"
          />
          <view class="detail-meta">
            <text class="detail-tag" :class="{ fresh: itemDetail.isNew }">
              {{ itemDetail.isNew ? '新增单品' : '衣橱旧衣' }}
            </text>
            <text class="detail-line">品类：{{ itemDetail.category }}</text>
            <text class="detail-line">适用季节：{{ itemDetail.season }}</text>
            <text v-if="itemDetail.tags?.length" class="detail-line">
              标签：{{ itemDetail.tags.join(' / ') }}
            </text>
            <text v-if="itemDetail.isNew" class="detail-price">¥{{ itemDetail.price.toFixed(2) }}</text>
            <text v-else class="detail-line">旧衣不计入购买清单</text>
          </view>
        </view>
        <view class="detail-actions">
          <template v-if="itemDetail.isNew">
            <button class="action-button" @tap="copyTaokouling(itemDetail)">复制淘口令</button>
            <button class="action-button primary" @tap="addDetailToCart">加入购物车</button>
          </template>
          <button v-else class="action-button primary" @tap="goClosetFromDetail">去衣橱查看</button>
        </view>
        <button class="btn btn-ghost modal-close" @tap="itemDetail = null">关闭</button>
      </view>
    </view>

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
        <!-- 小程序发不了朋友圈，这条限制必须写在界面上，见 utils/share.ts -->
        <text class="poster-message weak">{{ MOMENT_HINT }}</text>
        <button class="btn btn-ghost modal-close" @tap="posterVisible = false">关闭</button>
      </view>
    </view>

    <view v-if="toast" class="toast">{{ toast }}</view>
  </view>
</template>

<style scoped>
/*
 * ============================================================
 *  按钮尺寸只有两档 —— 不要再引入第三个高度
 * ============================================================
 * 用户反馈「按钮最好统一大小不显得杂乱」。原来这一页的按钮高度有
 * 34px / 36px / 40px / 46px 四档，padding 有 5/12/14/16px 五种，
 * 而且整页用 px 而不是项目统一的 rpx，所以看起来七零八落。
 *
 * 现在收成两档（都换成 rpx，跟随屏宽缩放）：
 *   --btn-h-sm  chip / 筛选片 / 换一套 —— 一切行内小按钮
 *   --btn-h-md  功能按钮（保存模板/分享/海报）、三选一的搭配方式
 * 主 CTA 走全局 .btn（100rpx），不在这里另定。
 *
 * ⚠️ 这两个变量原来在下面 `.body { }` 里本地声明（60rpx / 72rpx）。
 * 现在已经进了 styles/tokens.css（60 / 80 / 100rpx，对齐 uv-button 三档），
 * 本地声明删掉 —— 留着的话 md 会被这一页压回 72rpx，比全站矮 8rpx，
 * 就又变成「同一个变量两个值」的覆盖问题。md 从 72 → 80rpx 是刻意的对齐。
 */

/* ---------------- 顶部 ---------------- */

/* PageHeader 右侧的「＋」/「×」。方形点击区，和左侧返回键对称 */
.hdr-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
}
.hdr-btn.on {
  background: var(--pink-soft);
}

.top-seg {
  flex-shrink: 0;
  padding: 0 var(--page-x) 8rpx;
}

/* ---------------- 天气卡 ---------------- */

.weather-card {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.wc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.wc-loc {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.wc-city {
  font-size: 28rpx;
  color: var(--text-1);
}
/*
 * 穿搭日记的字号 / 字色 / 内边距 / 圆角全部由 .pill-macaron + .pill-macaron-mint
 * 提供，这里**只留全局类没给的差异**：图标和文字之间的 8rpx。
 *
 * ⚠️ 原来这里有一整套 font-size / color / padding / border / border-radius，
 * 已删。不删不行 —— scoped 选择器编译成 `.wc-diary[data-v-x]`，特异性 (0,2,0)
 * 比全局的 `.pill-macaron-mint` (0,1,0) 高，留着就等于全局类白写、
 * 胶囊仍然是灰字白底。这个坑上一轮的交接文档里记过。
 */
.wc-diary {
  gap: 8rpx;
}
.wc-date {
  font-size: 24rpx;
  color: var(--text-3);
}

/*
 * 预报行：今天一格 + 未来三天三格。
 * 今天那格用 flex:1.4 占宽一点，把「实时」和「预报」的层级拉开。
 *
 * ⚠️ 底色必须是半透明白（--glass-pane）而不是 --surface-tint。
 * 这几格现在坐在 .card-glass 的毛玻璃面上，不透明块会把玻璃感直接切断 ——
 * 第一版用了不透明冷灰 + 不透明浅粉，截出来整张卡是「粉卡片 + 灰方块」。
 */
.wc-forecast {
  display: flex;
  align-items: stretch;
  gap: 12rpx;
  margin-top: 4rpx;
}
.fc {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6rpx;
  padding: 16rpx 4rpx;
  border-radius: var(--radius-sm);
  background: var(--glass-pane);
}
/* 今天那格靠「更白」强调，不靠 --pink-soft 换色相 —— 玻璃左上角本来就是粉光晕 */
.fc-today {
  flex: 1.4;
  background: var(--glass-pane-strong);
}
.fc-temp-now {
  font-size: 34rpx;
  font-weight: 700;
  color: var(--text-1);
}
.fc-cond {
  font-size: 20rpx;
  color: var(--text-2);
}
/*
 * 这两个原来是 --text-3（#909193）。半透明面上 20rpx 的 #909193 太飘，
 * 而且安卓端 blur 不生效时底下透出的是页面灰，对比度更差 ——
 * 这正是 tokens.css 里「别在玻璃面上放浅灰小字」那条说的情况，提到 --text-2。
 */
.fc-day {
  font-size: 20rpx;
  color: var(--text-2);
}
.fc-range {
  font-size: 22rpx;
  color: var(--text-2);
}

/* ---------------- AI 搭配方式推荐 ---------------- */

.rec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.rec-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  min-width: 0;
}
.rec-refresh {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: var(--hairline);
}
.rec-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.rec-link {
  font-size: 22rpx;
  color: var(--pink-deep);
}
.rec-sep {
  font-size: 22rpx;
  color: var(--text-4);
}

.rec-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}
.rec-cell {
  border-radius: var(--radius);
  overflow: hidden;
  border: var(--hairline);
}

/* ---------------- 穿搭搭配方式选择 ---------------- */

.mode-title {
  margin-top: 8rpx;
}
/*
 * 三个按钮等宽（flex: 1 + 相同 min-width: 0），这样文字长短不同也不会一宽一窄。
 * 样图里中间那个是选中态。
 */
.mode-row {
  display: flex;
  gap: 12rpx;
}
.mode-pill {
  flex: 1;
  min-width: 0;
  height: var(--btn-h-md);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  border: var(--hairline);
  background: var(--surface);
  color: var(--text-2);
  font-size: 26rpx;
}
.mode-pill.on {
  background: var(--pink-deep);
  border-color: var(--pink-deep);
  color: #fff;
}
.body {
  flex: 1;
  min-height: 0;
  padding: 24rpx 32rpx 44rpx;
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

/* .header-action 已随「我的搭配」按钮换成右上「＋」而退役，见 .hdr-btn */

.control-card,
.result-area,
.difference-note {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 28rpx;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 20rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-1);
}
.section-sub {
  font-size: 24rpx;
  color: var(--text-2);
}
.scene-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
}
.scene-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  padding: 20rpx 8rpx;
  border-radius: var(--radius);
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 26rpx;
  font-weight: 700;
  transition: all 0.15s ease;
}
.scene-option.on {
  color: var(--text-on-brand);
  background: var(--brand-gradient);
  box-shadow: var(--shadow-card);
}
.scene-emoji {
  font-size: 48rpx;
}
.scene-label {
  line-height: 1.2;
}

.control-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.control-label {
  width: 84rpx;
  flex-shrink: 0;
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
}
.season-chips,
.mode-switch {
  flex: 1;
  display: flex;
  gap: 16rpx;
}
/* 小按钮档，见文件头「按钮尺寸只有两档」 */
.mini-chip,
.mode-button {
  flex: 1;
  min-width: 0;
  height: var(--btn-h-sm);
  border-radius: var(--radius-pill);
  border: var(--hairline);
  background: var(--surface);
  color: var(--text-2);
  font-size: 24rpx;
}
.mini-chip.on,
.mode-button.on {
  color: var(--text-on-brand);
  background: var(--brand-gradient);
}
/* 主 CTA 走全局 .btn 的 100rpx，不在这里另定高度 —— 第三个高度就是杂乱的开始 */
.generate-btn {
  margin-top: 8rpx;
}
.generate-btn.busy {
  opacity: 0.7;
}
.error-message {
  color: var(--warning);
  font-size: 24rpx;
  text-align: center;
}

.active-banner {
  background: var(--brand-gradient);
  border-radius: var(--radius);
  padding: 24rpx;
  color: var(--text-on-brand);
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.active-title {
  font-size: 30rpx;
  font-weight: 500;
}
.active-sub {
  font-size: 24rpx;
  opacity: 0.9;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.filter-chip {
  height: var(--btn-h-sm);
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  border: var(--hairline);
  background: var(--surface);
  color: var(--text-2);
  font-size: 24rpx;
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
  height: var(--btn-h-sm);
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  border: var(--hairline);
  background: var(--surface);
  color: var(--pink-deep);
  font-size: 24rpx;
}
.plan-count {
  font-size: 24rpx;
  color: var(--text-2);
  font-weight: 500;
}

.plan-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 24rpx;
}
.plan-grid.compare {
  grid-template-columns: 1fr 1fr;
  gap: 16rpx;
}
.plan-card {
  min-width: 0;
  background: var(--surface-soft);
  border-radius: var(--radius);
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.plan-head {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
}
.plan-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.plan-title {
  flex: 1;
  font-size: 26rpx;
  font-weight: 500;
  color: var(--text-1);
  line-height: 1.35;
}
.plan-tag {
  flex-shrink: 0;
  padding: 8rpx 16rpx;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}
.plan-reason {
  font-size: 22rpx;
  line-height: 1.45;
  color: var(--text-2);
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14rpx;
}
.item {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.item-name {
  font-size: 20rpx;
  color: var(--text-1);
  line-height: 1.25;
  min-height: 50rpx;
}
.item-tag {
  align-self: flex-start;
  padding: 4rpx 10rpx;
  border-radius: var(--radius-sm);
  background: var(--pink-soft);
  color: var(--purple-deep);
  font-size: 18rpx;
  font-weight: 700;
}
.item-price {
  font-size: 22rpx;
  font-weight: 500;
  color: var(--pink-deep);
}

.new-panel {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 18rpx;
}
.new-title {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--text-1);
}
.new-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.new-name {
  flex: 1;
  font-size: 22rpx;
  color: var(--text-2);
}
.copy-button {
  flex-shrink: 0;
  height: var(--btn-h-sm);
  padding: 0 24rpx;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 20rpx;
  font-weight: 700;
}

.difference-note {
  gap: 14rpx;
}
.difference-title {
  font-size: 26rpx;
  font-weight: 500;
  color: var(--text-1);
}
.difference-text {
  font-size: 22rpx;
  line-height: 1.45;
  color: var(--text-2);
}

.action-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
}
/* 中按钮档。等宽靠父级 grid，这里只管高度和字号统一 */
.action-button {
  min-width: 0;
  height: var(--btn-h-md);
  padding: 0 16rpx;
  border-radius: var(--radius);
  border: var(--hairline);
  background: var(--surface);
  color: var(--text-1);
  font-size: 24rpx;
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
  padding: 36rpx 32rpx calc(36rpx + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.modal-title {
  font-size: 36rpx;
  font-weight: 500;
  color: var(--text-1);
  text-align: center;
}
/* 单品详情弹层 */
.detail-body {
  display: flex;
  gap: 24rpx;
}
.detail-image {
  width: 220rpx;
  flex-shrink: 0;
}
.detail-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.detail-tag {
  align-self: flex-start;
  font-size: 22rpx;
  color: var(--text-2);
  background: var(--surface-placeholder);
  border-radius: var(--radius-pill);
  padding: 4rpx 16rpx;
}
.detail-tag.fresh {
  color: #fff;
  background: var(--pink-deep);
}
.detail-line {
  font-size: 25rpx;
  color: var(--text-2);
}
.detail-price {
  font-size: 34rpx;
  color: var(--pink-deep);
  margin-top: 4rpx;
}
.detail-actions {
  display: flex;
  gap: 16rpx;
}
.detail-actions .action-button {
  flex: 1;
}
.purchase-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
}
.purchase-info {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.purchase-name {
  font-size: 26rpx;
  font-weight: 700;
  color: var(--text-1);
}
.purchase-price {
  font-size: 24rpx;
  color: var(--pink-deep);
  font-weight: 700;
}
/* 弹窗主按钮走全局 .btn（100rpx），不另定高度 */
.modal-close {
  margin-top: 8rpx;
}

.poster-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}
.poster-message {
  font-size: 24rpx;
  color: var(--text-2);
  text-align: center;
}
.poster-message.weak {
  font-size: 21rpx;
  line-height: 1.5;
  color: var(--text-3);
}

</style>
