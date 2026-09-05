<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { iconForEmoji, type IconName } from '@/utils/icons'
import { useWardrobeStore } from '@/stores/wardrobe'
import { useProfileStore } from '@/stores/profile'
import { MODEL_IMAGES, SCENES, type Garment, type Scene } from '@/data/mock'
import { apiCreateOutfit, apiStarOutfit } from '@/api/wardrobe'
import { apiTryonEnabled, runTryon } from '@/api/tryon'
import { isAuthError } from '@/api/http'
import { garmentToAccessoryContext, setAccessoryPageContext } from '@/utils/accessoryContext'
import { MOMENT_HINT_PREVIEW, copyText } from '@/utils/share'

const wardrobe = useWardrobeStore()
const profile = useProfileStore()

/* ---------- 轻提示 ---------- */
const toastMsg = ref('')
let toastTimer: ReturnType<typeof setTimeout> | undefined
function showToast(msg: string) {
  toastMsg.value = msg
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (toastMsg.value = ''), 1500)
}

/* ---------- 已选单品（本地管理） ---------- */
const selected = ref<Garment[]>([])
/** 这件是不是已经穿上了（左栏缩略图的 × 只在穿上后出现） */
function isWearing(id: string) {
  return selected.value.some((s) => s.id === id)
}
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

/* ---------- 保存 / 收藏（规格 §8.9：两件事，不是一个按钮的两种说法） ----------
 * 保存 = 把这组衣物落成一条 kind='manual' 的搭配，之后在「我的搭配」里能翻到。
 * 收藏 = 在已落库的搭配上打星标。没落库就点收藏的话先落库再打星。
 *
 * savedOutfitId 记住这一组对应哪条库里的搭配，避免重复点保存生成一堆副本。
 * 但它只对「当前这一组」有效 —— 换了单品就是另一套了，下面的 watch 会清掉它，
 * 否则给 A 打的星会落到 B 头上。
 */
const savedOutfitId = ref(0)
const isStarred = ref(false)
const busy = ref(false)

watch(
  () => selected.value.map((s) => s.id).join('|'),
  () => {
    savedOutfitId.value = 0
    isStarred.value = false
  },
)

/** 落库并返回 outfitId；已经落过就直接复用。失败返回 0（提示已在内部给过）。 */
async function ensureSaved(): Promise<number> {
  if (savedOutfitId.value) return savedOutfitId.value
  const outfit = await apiCreateOutfit({
    garmentIds: selected.value.map((s) => s.id),
    scene: currentScene.value?.key || '',
    title: currentScene.value ? `${currentScene.value.label} · 自由搭配` : '',
  })
  savedOutfitId.value = outfit.id
  isStarred.value = outfit.isStarred
  return outfit.id
}

/**
 * 出错兜底。401 不提示：请求层已经把人送去登录页了，
 * 再弹一条 toast 只会叠在登录页上（同 stores/cart.ts 的处理）。
 */
function reportError(error: unknown, fallback: string) {
  if (isAuthError(error)) return
  showToast((error as Error)?.message || fallback)
}

async function onSave() {
  if (busy.value) return
  if (!selected.value.length) {
    showToast('先穿上至少一件')
    return
  }
  if (savedOutfitId.value) {
    showToast('这套已经保存过啦')
    return
  }
  busy.value = true
  try {
    await ensureSaved()
    showToast('已保存到我的搭配')
  } catch (error) {
    reportError(error, '保存失败，请稍后再试')
  } finally {
    busy.value = false
  }
}

async function onStar() {
  if (busy.value) return
  if (!selected.value.length) {
    showToast('先穿上至少一件')
    return
  }
  busy.value = true
  try {
    const id = await ensureSaved()
    const next = !isStarred.value
    const outfit = await apiStarOutfit(id, next)
    isStarred.value = outfit.isStarred
    showToast(outfit.isStarred ? '已收藏本套造型' : '已取消收藏')
  } catch (error) {
    reportError(error, '收藏失败，请稍后再试')
  } finally {
    busy.value = false
  }
}

/* ---------- 更换模特 ----------
 * 整张预设图切换，不是把衣服图层叠到人台上 —— 衣橱图没有 alpha 通道，
 * 叠上去就是一堆白底方块（见 .handoff/公共底座-图片素材）。
 */
const MODEL_VIEWS = [
  { key: 'female-front', label: '女生 · 正面', src: MODEL_IMAGES.front },
  { key: 'male-front', label: '男生 · 正面', src: MODEL_IMAGES.frontMale },
  // 官方示例人像：AI 试衣用它出图质量有保证（百炼文档配套素材）
  { key: 'official', label: '官方 · 人像', src: MODEL_IMAGES.official },
]
/** 默认跟随身形档案的性别；没填过就用女生正面 */
const modelIndex = ref(profile.profile.gender === 'male' ? 2 : 0)
const currentModel = computed(() => MODEL_VIEWS[modelIndex.value % MODEL_VIEWS.length])
function switchModel() {
  modelIndex.value = (modelIndex.value + 1) % MODEL_VIEWS.length
  showToast(`已切换到${currentModel.value.label}`)
}

/* ---------- 更换场景 ----------
 * 只换舞台背景图 + 一层半透明白遮罩（规格 §10.9：切换时衣服本身不变）。
 * 背景走 <image> 而不是 CSS background-image —— 小程序 WXSS 的 background-image
 * 不认本地路径，只吃 base64 和网络图，写了就是不显示。
 */
const sceneKey = ref('')
const currentScene = computed<Scene | null>(() => SCENES.find((s) => s.key === sceneKey.value) || null)
function switchScene() {
  const options = ['默认（无背景）', ...SCENES.map((s) => s.label)]
  uni.showActionSheet({
    itemList: options,
    success: ({ tapIndex }) => {
      if (tapIndex === 0) {
        sceneKey.value = ''
        showToast('已还原默认背景')
        return
      }
      const scene = SCENES[tapIndex - 1]
      if (!scene) return
      sceneKey.value = scene.key
      showToast(`背景已换成「${scene.label}」`)
    },
  })
}

/* ---------- 更换搭配 ----------
 * 本地规则随机，不落库也不调 AI：每个部位从衣橱里随机抽一件。
 * 「智能生成」是首页那条链路（/api/wardrobe/generate），这里只是换个组合看看。
 */
const SHUFFLE_GROUPS = [['top'], ['pants', 'skirt', 'dress'], ['shoes'], ['bag', 'hat', 'jewelry', 'accessory']]
function pickRandom<T>(list: T[]): T | undefined {
  if (!list.length) return undefined
  return list[Math.floor(Math.random() * list.length)]
}
function shuffleOutfit() {
  const pool = wardrobe.garments
  if (pool.length < 2) {
    showToast('衣橱里至少要有 2 件才能换搭配')
    return
  }
  const used = new Set<string>()
  const next: Garment[] = []
  for (const group of SHUFFLE_GROUPS) {
    const picked = pickRandom(pool.filter((g) => group.includes(g.category) && !used.has(g.id)))
    if (!picked) continue
    used.add(picked.id)
    next.push(picked)
  }
  // 衣橱里的分类可能压根不覆盖上面四组（比如全是配饰），兜底随便抽三件
  if (next.length < 2) {
    for (const g of [...pool].sort(() => Math.random() - 0.5)) {
      if (next.length >= 3) break
      if (used.has(g.id)) continue
      used.add(g.id)
      next.push(g)
    }
  }
  selected.value = next
  showToast(`换了一套 ${next.length} 件的搭配`)
}

/* ---------- AI 试衣（阿里百炼 aitryon） ----------
 * 这是「把衣服真的穿到人身上」的那条路，和上面的换模特/换场景不是一回事：
 * 前者只是切预设图，这里是把人像和衣服图发给百炼生成一张上身图。
 *
 * 只取上装和下装两件：aitryon 的入参就这两个槽，鞋子包配饰它不认。
 * 连衣裙按上装传（模型侧就是这么处理的）。
 *
 * 素材说明（2026-08-18）：官方示例图（images/tryon/）已加入素材池 ——
 * 衣橱里多了「官方示例」上装/下装两件，模特列表里多了「官方 · 人像」一项。
 * 选中它们再点 AI 试衣，就是官方验证过的输入，出图质量有保证；
 * 不选它们就用当前穿搭，逻辑不写死。
 */
const TOP_CATEGORIES = ['top', 'dress']
const BOTTOM_CATEGORIES = ['pants', 'skirt']

const tryonEnabled = ref(false)
const tryonImage = ref('')
const tryonBusy = ref(false)

onMounted(async () => {
  tryonEnabled.value = await apiTryonEnabled()
})

/** 出图对应的是「当时那一套」；换了单品就作废，否则会挂着一张对不上的图 */
watch(
  () => selected.value.map((s) => s.id).join('|'),
  () => {
    tryonImage.value = ''
  },
)

async function onTryon() {
  if (tryonBusy.value) return
  if (!tryonEnabled.value) {
    showToast('服务端还没配置百炼 API Key，AI 试衣暂不可用')
    return
  }
  const top = selected.value.find((g) => TOP_CATEGORIES.includes(g.category))
  const bottom = selected.value.find((g) => BOTTOM_CATEGORIES.includes(g.category))
  if (!top && !bottom) {
    showToast('先穿上一件上装或下装')
    return
  }

  tryonBusy.value = true
  uni.showLoading({ title: '正在生成…', mask: true })
  try {
    // 用「当前人像 + 当前选中单品」：衣橱里选了官方示例衣服就是官方验证过的输入
    const url = await runTryon(
      {
        personImageUrl: currentModel.value.src,
        topGarmentUrl: top?.img,
        bottomGarmentUrl: bottom?.img,
      },
      // 排队和出图是两种等待，状态变了就把提示也换掉，免得看起来像卡住
      (task) => uni.showLoading({ title: task.status === 'RUNNING' ? '正在出图…' : '排队中…', mask: true }),
    )
    tryonImage.value = url
    showToast('试衣完成')
  } catch (error) {
    reportError(error, '试衣失败，请稍后再试')
  } finally {
    uni.hideLoading()
    tryonBusy.value = false
  }
}

/**
 * 点人台看大图。只在出过图时有意义 —— 预设人台就是个小图，放大没内容。
 * 出图是 OSS 临时地址，预览页的「保存到相册」在 24h 内可用，过期就只剩记录了。
 */
function previewTryon() {
  if (!tryonImage.value) return
  uni.previewImage({ urls: [tryonImage.value], current: tryonImage.value })
}

/**
 * 发朋友圈要配的那段字。
 * 图存了相册、文案在剪贴板，用户切到微信只要粘贴 —— 这是小程序能做到的极限，
 * 「一键发朋友圈」的 API 不存在（见 utils/share.ts 的说明）。
 */
function copyLookText() {
  const names = selected.value.map((g) => g.name).join(' + ')
  copyText(
    [currentScene.value ? `${currentScene.value.label} · 今日穿搭` : '今日穿搭', names, '由 灵犀 AI 穿搭 生成']
      .filter(Boolean)
      .join('\n'),
    '搭配文案已复制',
  )
}

/* ---------- 右侧工具 ---------- */
/*
 * 右侧竖排工具，对齐样图的五项：穿搭保存 / 更换模特 / 更换场景 / 更换搭配 / 还原穿搭。
 * 原来是「换鞋子 / 换裙子 / 进阶穿搭」，样图上没有这三项。
 * 第六项 AI 试衣是样图之外加的：前五项都不出图，这一项才是真的生成上身效果。
 */
const tools: { key: string; label: string; icon: IconName }[] = [
  { key: 'save', label: '穿搭保存', icon: 'save' },
  { key: 'tryon', label: 'AI 试衣', icon: 'sparkle' },
  { key: 'model', label: '更换模特', icon: 'model-switch' },
  { key: 'scene', label: '更换场景', icon: 'scene-switch' },
  { key: 'outfit', label: '更换搭配', icon: 'outfit-switch' },
  { key: 'reset', label: '还原穿搭', icon: 'refresh' },
]
function onTool(t: { key: string; label: string }) {
  if (t.key === 'save') return void onSave()
  if (t.key === 'tryon') return void onTryon()
  if (t.key === 'model') return switchModel()
  if (t.key === 'scene') return switchScene()
  if (t.key === 'outfit') return shuffleOutfit()
  // 还原穿搭：清空已穿上的，背景、模特和试衣结果也一起回到初始态
  if (!selected.value.length && !sceneKey.value && !tryonImage.value) {
    showToast('还没穿上任何单品')
    return
  }
  selected.value = []
  sceneKey.value = ''
  tryonImage.value = ''
  showToast('已还原为初始形象')
}

/* ---------- 左侧可替换缩略（取衣橱前 6 件） ---------- */
const quickThumbs = computed<Garment[]>(() => wardrobe.garments.slice(0, 6))

/* ---------- 底部面板：两个平铺分区 + 各自的小分类 chips ---------- */
type Chip = { key: string; label: string; kw?: string[] }

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

/*
 * 「我的收藏」和「试穿」两个分区**同时显示**，不再用 SegTabs 二选一 ——
 * 样图上是两块平铺的区，各带一行 chips 和一条横滑衣物条。
 * 所以两个分区各自记一份 chip 状态。
 */
const favChipKey = ref('all')
const tryChipKey = ref('all')

/** 宽松过滤：chip 没有关键词（「全部」）或一件都匹配不到时，退回整个列表 */
function filterByChip(list: Garment[], chips: Chip[], activeKey: string) {
  const chip = chips.find((c) => c.key === activeKey)
  if (!chip?.kw) return list
  const kw = chip.kw
  const matched = list.filter((g) =>
    kw.some((k) => g.name.includes(k) || (g.tags?.some((t) => t.includes(k)) ?? false)),
  )
  return matched.length ? matched : list
}

const sections = computed(() => [
  {
    key: 'fav',
    label: '我的收藏',
    chips: favChips,
    activeChip: favChipKey.value,
    list: filterByChip(wardrobe.favoriteGarments, favChips, favChipKey.value),
    emptyText: '还没有收藏的衣物',
  },
  {
    key: 'try',
    label: '试穿',
    chips: tryChips,
    activeChip: tryChipKey.value,
    list: filterByChip(wardrobe.garments, tryChips, tryChipKey.value),
    emptyText: '衣橱里还没有衣物',
  },
])

function setChip(sectionKey: string, chipKey: string) {
  if (sectionKey === 'fav') favChipKey.value = chipKey
  else tryChipKey.value = chipKey
}

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
          <button class="head-ico" aria-label="配配饰" @tap="goAccessory">
            <UiIcon name="cat-jewelry" :size="34" tone="purple" />
          </button>
          <button class="head-ico" aria-label="收藏" @tap="onStar">
            <UiIcon name="star" :size="34" :tone="isStarred ? 'brand' : 'dark'" />
          </button>
          <button class="head-ico" aria-label="保存" @tap="onSave">
            <UiIcon name="save" :size="34" :tone="savedOutfitId ? 'brand' : 'dark'" />
          </button>
        </view>
      </template>
    </PageHeader>

    <scroll-view scroll-y class="body">
      <!-- 上半区：形象 + 工具 -->
      <view class="stage-area">
        <!--
          场景背景。用 <image> 而不是 CSS background-image：
          小程序 WXSS 的 background-image 不认 /static/ 这种本地路径。
          上面再压一层半透明白遮罩，免得背景把人台和衣物压得看不清。
        -->
        <image v-if="currentScene" class="stage-bg" :src="currentScene.img" mode="aspectFill" />
        <view v-if="currentScene" class="stage-mask" />

        <!-- 样图左上那个「我的虚拟形象」标签 -->
        <view class="stage-badge">我的虚拟形象</view>

        <!-- 左侧竖排可替换缩略 -->
        <scroll-view scroll-y class="thumbs">
          <view v-for="g in quickThumbs" :key="g.id" class="thumb-wrap">
            <button class="thumb" :aria-label="`换上${g.name}`" @tap="wear(g)">
              <TileImage :src="g.img" :emoji="g.emoji" ratio="1 / 1" />
            </button>
            <!--
              样图里每个缩略图右上角都有一个 ×。
              只在「这件已经穿上了」时出现 —— 它的语义是脱下来，
              没穿的衣服给个 × 无处可去。
            -->
            <view v-if="isWearing(g.id)" class="thumb-x" :aria-label="`脱下${g.name}`" @tap.stop="takeOff(g.id)">
              <UiIcon name="close" :size="20" tone="white" :stroke-width="2.4" />
            </view>
          </view>
        </scroll-view>

        <!--
          中央人台。整张预设图切换（女/男 × 正面/背面，见 MODEL_VIEWS）。
          不做「衣服图层叠到人台上」：衣橱图是不带 alpha 的 RGB PNG，
          叠上去只会得到一堆白底方块。真要做得先有去背景管线。
        -->
        <view class="model" @tap="previewTryon">
          <!--
            出过图就显示试衣结果，没出过还是原来的预设人台。
            结果图是百炼的 OSS 临时地址（24h 过期），所以只当「这次的展示」，
            要留下来得走保存那条路。点一下可以全屏看大图。
          -->
          <TileImage v-if="tryonImage" :src="tryonImage" icon="sparkle" ratio="3 / 4" fit="contain" />
          <TileImage v-else :src="currentModel.src" icon="me" ratio="3 / 4" fit="contain" />
        </view>
        <view v-if="tryonImage" class="tryon-badge">AI 试衣结果</view>

        <!--
          试衣结果出来之后，用户真正想做的两件事：发出去、留个文案。
          小程序发不了朋友圈（见 utils/share.ts），所以这里只给「保存 → 手动发」的说明，
          不给一个点了没反应的「分享到朋友圈」按钮。
        -->
        <view v-if="tryonImage" class="tryon-share">
          <button class="tryon-share-btn" @tap="copyLookText">复制搭配文案</button>
          <text class="tryon-share-hint">{{ MOMENT_HINT_PREVIEW }}</text>
        </view>

        <!-- 右侧竖排工具 -->
        <scroll-view scroll-y class="tools">
          <button v-for="t in tools" :key="t.key" class="tool" :aria-label="t.label" @tap="onTool(t)">
            <UiIcon :name="t.icon" :size="36" tone="dark" />
            <text class="tool-label">{{ t.label }}</text>
          </button>
        </scroll-view>

        <!-- 右下：个性化创建入口 -->
        <button class="create-entry" @tap="goCreate">
          <UiIcon name="sparkle" :size="26" tone="white" />
          <text>个性化创建</text>
        </button>
      </view>

      <!-- 已选单品 chips -->
      <view class="selected">
        <view v-if="selected.length" class="sel-row">
          <button v-for="s in selected" :key="s.id" class="sel-chip" @tap="takeOff(s.id)">
            <UiIcon class="sel-emoji" :name="iconForEmoji(s.emoji) ?? 'image'" :size="28" tone="soft" />
            <text class="sel-name">{{ s.name }}</text>
            <text class="sel-x">×</text>
          </button>
        </view>
        <view v-else class="sel-empty">还没穿上单品，去下面挑一件试试吧</view>
      </view>

      <!--
        下半区：两个分区平铺（样图就是「我的收藏」和「试穿」上下排开，不是 tab）。
        每区一行 chips + 一条横滑衣物条 —— 横滑比原来的两列网格省一半竖向空间，
        上面的舞台才留得住。
      -->
      <view class="panel">
        <view v-for="sec in sections" :key="sec.key" class="pnl-sec">
          <text class="section-title">{{ sec.label }}</text>

          <scroll-view scroll-x class="chips row-scroll hide-scrollbar" :show-scrollbar="false">
            <view
              v-for="c in sec.chips"
              :key="c.key"
              class="chip"
              :class="{ on: sec.activeChip === c.key }"
              @tap="setChip(sec.key, c.key)"
            >
              {{ c.label }}
            </view>
          </scroll-view>

          <scroll-view
            v-if="sec.list.length"
            scroll-x
            class="pnl-row row-scroll hide-scrollbar"
            :show-scrollbar="false"
          >
            <view v-for="g in sec.list" :key="g.id" class="pnl-cell" @tap="wear(g)">
              <TileImage :src="g.img" :emoji="g.emoji" ratio="3 / 4" />
              <text class="pnl-name">{{ g.name }}</text>
            </view>
          </scroll-view>
          <view v-else class="pnl-empty">{{ sec.emptyText }}</view>
        </view>
      </view>
    </scroll-view>

    <BottomNav active="closet" />

    <!-- 轻提示 -->
    <transition name="toast">
      <view v-if="toastMsg" class="toast">{{ toastMsg }}</view>
    </transition>
  </view>
</template>

<style scoped>
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  background: rgba(255, 255, 255, 0.8);
  box-shadow: var(--shadow-card);
}

/* ---------- 上半区舞台 ---------- */
.stage-area {
  position: relative;
  flex-shrink: 0;
  display: flex;
  gap: 16rpx;
  background: var(--surface);
  border: var(--hairline);
  border-radius: var(--radius-lg);
  /* 背景图要被圆角裁住 */
  overflow: hidden;
  /* 顶部多留 56rpx 给「我的虚拟形象」那个角标 */
  padding: 56rpx 20rpx 24rpx;
}

/* 场景背景 + 遮罩，都垫在最底下 */
.stage-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
}
.stage-mask {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: rgba(255, 255, 255, 0.72);
}
/*
 * 上面加了定位背景层之后，静态流里的三栏会被它盖住 ——
 * 定位元素永远画在非定位元素上面。所以三栏都要显式抬到遮罩之上。
 */
.thumbs,
.model,
.tools {
  position: relative;
  z-index: 2;
}

/*
 * 样图左上角的「我的虚拟形象」。
 * 原来它是 TileImage 的 label（压在人台图左下），角标放在舞台左上更符合样图，
 * 也不会挡住衣物层。
 */
.stage-badge {
  position: absolute;
  top: 14rpx;
  left: 20rpx;
  z-index: 3;
  padding: 6rpx 20rpx;
  border-radius: var(--radius-pill);
  background: var(--pink-soft);
  color: var(--pink-deep);
  font-size: 20rpx;
}

/*
 * 「AI 试衣结果」角标，和左上的「我的虚拟形象」对称放右上。
 * 必须绝对定位：它在模板里是 .stage-area 这个 flex 行的直接子元素，
 * 留在流里会挤掉中间人台的宽度。
 */
.tryon-badge {
  position: absolute;
  top: 14rpx;
  right: 20rpx;
  z-index: 3;
  padding: 6rpx 20rpx;
  border-radius: var(--radius-pill);
  background: var(--pink-deep);
  color: #fff;
  font-size: 20rpx;
}

/* 试衣结果下方的「复制文案 + 怎么发朋友圈」，绝对定位贴在人台底部，不挤压舞台布局 */
.tryon-share {
  position: absolute;
  left: 50%;
  bottom: 16rpx;
  z-index: 3;
  transform: translateX(-50%);
  width: 78%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}
.tryon-share-btn {
  height: 56rpx;
  padding: 0 28rpx;
  display: flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.92);
  color: var(--pink-deep);
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1;
  box-shadow: var(--shadow-card);
}
.tryon-share-btn::after {
  border: none;
}
.tryon-share-hint {
  padding: 4rpx 16rpx;
  border-radius: var(--radius-pill);
  background: rgba(0, 0, 0, 0.45);
  color: rgba(255, 255, 255, 0.92);
  font-size: 19rpx;
  text-align: center;
}
/* 左侧竖排缩略 */
.thumbs {
  flex-shrink: 0;
  width: 104rpx;
  max-height: 680rpx;
}
/*
 * 缩略图外面套一层相对定位的壳，× 角标要挂在它上面。
 * 竖向间距用 margin-bottom 而不是父级 gap —— scroll-view 的 flex/gap
 * 在 uni-app 里传不到内层真正装内容的容器上（见 styles/base.css 里 .row-scroll 的注释）。
 */
.thumb-wrap {
  position: relative;
  width: 104rpx;
  margin-bottom: 16rpx;
}
.thumb {
  width: 104rpx;
  padding: 0;
  border-radius: var(--radius);
  overflow: hidden;
  border: var(--hairline);
  transition: opacity 0.15s ease;
}
.thumb:active {
  opacity: 0.7;
}
/* 「脱下」角标，只在这件已穿上时出现 */
.thumb-x {
  position: absolute;
  top: -6rpx;
  right: -6rpx;
  z-index: 2;
  width: 32rpx;
  height: 32rpx;
  border-radius: 50%;
  background: var(--pink-deep);
  display: flex;
  align-items: center;
  justify-content: center;
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
  /* 留出右下角「个性化创建」胶囊的位置，否则最后一个工具会被它盖住 */
  max-height: 560rpx;
}
/* 同 create 页：设计稿里是裸图标 + 文字，不套白卡 */
.tool {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6rpx;
  width: 108rpx;
  padding: 8rpx 4rpx;
  transition: transform 0.15s ease;
}
.tool:active {
  transform: scale(0.92);
}
.tool-label {
  font-size: 20rpx;
  font-weight: 500;
  color: var(--text-2);
}

.create-entry {
  position: absolute;
  right: 24rpx;
  bottom: 24rpx;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 8rpx;
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
  font-weight: 500;
}
.sel-x {
  font-size: 28rpx;
  color: var(--pink-deep);
  font-weight: 500;
}
.sel-empty {
  margin: 0;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-3);
}

/* ---------- 下半区面板 ---------- */
.panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}

/* 一个分区 = 标题 + 一行 chips + 一条横滑衣物条 */
.pnl-sec {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  background: var(--surface);
  border: var(--hairline);
  border-radius: var(--radius-lg);
  padding: 20rpx;
}
/*
 * 横滑衣物条。和 .chips 同一个道理：不能给 scroll-view 加 display:flex，
 * 靠 nowrap + 子元素 inline-block 横排（.row-scroll 已在全局提供这套）。
 */
.pnl-row {
  white-space: nowrap;
}
.pnl-cell {
  display: inline-block;
  width: 150rpx;
  margin-right: 16rpx;
  vertical-align: top;
}
.pnl-name {
  display: block;
  margin-top: 8rpx;
  font-size: 20rpx;
  color: var(--text-2);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.pnl-empty {
  padding: 40rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-3);
}

/*
 * 横向 chips 必须用 nowrap + inline-flex，不能给 scroll-view 本身加 display:flex：
 * uni-app 的 scroll-view 真正装内容的是内层容器，外层的 flex 传不下去，
 * 结果就是 chips 一个个竖着排。closet 里的 .filters 是正确写法，这里对齐它。
 */
.chips {
  white-space: nowrap;
}
.chip {
  display: inline-flex;
  margin-right: 12rpx;
  padding: 10rpx 26rpx;
  border-radius: var(--radius-pill);
  font-size: 24rpx;
  color: var(--text-2);
  background: var(--surface);
  border: var(--hairline);
}
.chip.on {
  color: var(--text-on-brand);
  background: var(--pink-deep);
  border-color: var(--pink-deep);
}

/* .grid-wrap / .grid / .empty 已随「两列网格 → 横滑条」的改版删除 */

/* ---------- 轻提示 ---------- */
.toast-enter-active,
.toast-leave-active {
  transition:
    opacity 0.25s ease,
    transform 0.25s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 16rpx);
}
</style>
