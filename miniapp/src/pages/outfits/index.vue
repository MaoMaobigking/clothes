<script setup lang="ts">
/*
 * 我的搭配（规格 §8.11 §10.10）。
 *
 * 以前这是三处：closet.vue 的二级 tab 只有功能二的收藏搭配，
 * 本页只列功能四的场景模板，me.vue 的「我的搭配」菜单指向本页 ——
 * 同一个名字下的三份列表，互相看不到对方，用户存过的东西找不回来。
 * 现在这里是唯一的一页：两个来源一起读，按来源分组，各自可重开与分享。
 *
 * 入口用 ?source=wardrobe|scene 预选筛选，不再各自维护第二份列表。
 */
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { listSceneOutfits, type SavedSceneOutfit } from '@/api/scene'
import { apiListOutfits, type Outfit } from '@/api/wardrobe'
import { isAuthError } from '@/api/http'
import { piecesFromOutfit, piecesFromSceneItems, type OutfitPiece } from '@/utils/outfitPieces'

type SourceKey = 'wardrobe' | 'scene'

interface OutfitEntry {
  key: string
  source: SourceKey
  title: string
  /** 右上角时间 */
  time: string
  /** 副标题：功能二是场合 / 季节，功能四是城市 / 天气 */
  meta: string
  tag: string
  pieces: OutfitPiece[]
  /** 点「重新打开」去哪 */
  route: string
  shareText: string
}

const SOURCE_LABELS: Record<SourceKey, string> = {
  wardrobe: '旧衣搭配',
  scene: '场景模板',
}

const filter = ref<'all' | SourceKey>('all')
const wardrobeOutfits = ref<Outfit[]>([])
const sceneOutfits = ref<SavedSceneOutfit[]>([])
const loading = ref(true)
const errorMessage = ref('')

function formatDate(value?: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const entries = computed<OutfitEntry[]>(() => {
  const fromWardrobe: OutfitEntry[] = wardrobeOutfits.value.map((outfit) => ({
    key: `wardrobe-${outfit.id}`,
    source: 'wardrobe',
    title: outfit.title,
    time: formatDate(outfit.createdAt),
    meta: [outfit.occasion, outfit.season, outfit.scene].filter(Boolean).join(' · ') || '旧衣智能搭配',
    tag: SOURCE_LABELS.wardrobe,
    pieces: piecesFromOutfit(outfit),
    route: `/pages/outfit-result/index?batchId=${outfit.batchId}`,
    shareText: `${outfit.title}\n${outfit.items.map((item) => item.garment.name).join(' / ')}\n来自灵犀 AI 旧衣智能搭配。`,
  }))

  const fromScene: OutfitEntry[] = sceneOutfits.value.map((outfit) => ({
    key: `scene-${outfit.id}`,
    source: 'scene',
    title: outfit.title,
    time: formatDate(outfit.createdAt),
    meta: [
      outfit.season,
      outfit.mode === 'pure' ? '纯旧衣' : '新旧混搭',
      `${outfit.weather?.city || '未记录城市'} ${outfit.weather?.condition || ''}`.trim(),
    ]
      .filter(Boolean)
      .join(' · '),
    tag: SOURCE_LABELS.scene,
    pieces: piecesFromSceneItems(outfit.composition || []),
    route: `/pages/scene/index?outfitId=${outfit.id}`,
    shareText: `${outfit.title}\n${outfit.weather?.city || '未记录城市'} ${outfit.weather?.condition || ''} ${outfit.weather?.temp ?? ''}℃\n${(outfit.composition || []).map((item) => item.name).join(' / ')}`,
  }))

  return [...fromWardrobe, ...fromScene]
})

const counts = computed(() => ({
  all: entries.value.length,
  wardrobe: entries.value.filter((entry) => entry.source === 'wardrobe').length,
  scene: entries.value.filter((entry) => entry.source === 'scene').length,
}))

/** 分组展示（§8.11「按来源分组」）；筛选只是把另一组隐藏，不改数据 */
const groups = computed(() =>
  (['wardrobe', 'scene'] as SourceKey[])
    .filter((source) => filter.value === 'all' || filter.value === source)
    .map((source) => ({
      source,
      label: SOURCE_LABELS[source],
      items: entries.value.filter((entry) => entry.source === source),
    }))
    .filter((group) => group.items.length > 0),
)

async function load() {
  loading.value = true
  errorMessage.value = ''
  // 两个来源分别兜底：功能四接口挂了不该让功能二的收藏也看不见
  const [wardrobeResult, sceneResult] = await Promise.allSettled([
    apiListOutfits(true),
    listSceneOutfits(),
  ])
  if (wardrobeResult.status === 'fulfilled') {
    wardrobeOutfits.value = wardrobeResult.value
  } else if (!isAuthError(wardrobeResult.reason)) {
    errorMessage.value = '旧衣搭配读取失败'
  }
  if (sceneResult.status === 'fulfilled') {
    sceneOutfits.value = sceneResult.value
  } else if (!isAuthError(sceneResult.reason)) {
    errorMessage.value = errorMessage.value
      ? `${errorMessage.value}；场景模板读取失败`
      : '场景模板读取失败'
  }
  loading.value = false
}

onLoad((options) => {
  const source = options?.source
  if (source === 'wardrobe' || source === 'scene') filter.value = source
})

onShow(load)

function openEntry(entry: OutfitEntry) {
  uni.navigateTo({ url: entry.route })
}

function copyEntry(entry: OutfitEntry) {
  uni.setClipboardData({
    data: entry.shareText,
    success: () => uni.showToast({ title: '分享文案已复制', icon: 'none' }),
  })
}

function goScene() {
  uni.navigateTo({ url: '/pages/scene/index' })
}

function goCloset() {
  uni.switchTab({
    url: '/pages/closet/closet',
    fail: () => uni.navigateTo({ url: '/pages/closet/closet' }),
  })
}
</script>

<template>
  <view class="page">
    <PageHeader title="我的搭配" to="/pages/me/me" sub="旧衣搭配与场景模板都在这里" />

    <view class="filter-row">
      <button
        class="filter-chip"
        :class="{ on: filter === 'all' }"
        @tap="filter = 'all'"
      >
        全部 {{ counts.all }}
      </button>
      <button
        class="filter-chip"
        :class="{ on: filter === 'wardrobe' }"
        @tap="filter = 'wardrobe'"
      >
        旧衣搭配 {{ counts.wardrobe }}
      </button>
      <button
        class="filter-chip"
        :class="{ on: filter === 'scene' }"
        @tap="filter = 'scene'"
      >
        场景模板 {{ counts.scene }}
      </button>
    </view>

    <scroll-view class="body" scroll-y>
      <text v-if="loading" class="status">正在读取我的搭配…</text>
      <text v-else-if="errorMessage" class="status error">{{ errorMessage }}</text>

      <template v-if="!loading && groups.length">
        <view v-for="group in groups" :key="group.source" class="group">
          <view class="group-head">
            <text class="group-title">{{ group.label }}</text>
            <text class="group-count">{{ group.items.length }} 套</text>
          </view>

          <view
            v-for="entry in group.items"
            :key="entry.key"
            class="outfit-card"
            @tap="openEntry(entry)"
          >
            <view class="outfit-head">
              <view class="outfit-title-wrap">
                <text class="outfit-title">{{ entry.title }}</text>
                <text class="outfit-tag">{{ entry.tag }}</text>
              </view>
              <text class="outfit-date">{{ entry.time }}</text>
            </view>

            <text class="outfit-meta">{{ entry.meta }}</text>

            <scroll-view scroll-x class="piece-list">
              <view v-for="piece in entry.pieces.slice(0, 8)" :key="piece.id" class="piece">
                <TileImage
                  :src="piece.img"
                  :from="piece.from"
                  :to="piece.to"
                  :emoji="piece.emoji"
                  ratio="1 / 1"
                  rounded="10px"
                />
                <text class="piece-name">{{ piece.name }}</text>
              </view>
            </scroll-view>

            <view class="outfit-actions">
              <button class="outfit-action" @tap.stop="openEntry(entry)">重新打开</button>
              <button class="outfit-action" @tap.stop="copyEntry(entry)">复制分享</button>
            </view>
          </view>
        </view>
      </template>

      <view v-else-if="!loading" class="empty">
        <text class="empty-emoji">👗</text>
        <text>还没有保存的搭配</text>
        <text class="empty-sub">
          在搭配结果页点「收藏」，或在场景模拟里点「保存模板」，都会出现在这里。
        </text>
        <view class="empty-actions">
          <button class="outfit-action" @tap="goCloset">去生成搭配</button>
          <button class="outfit-action" @tap="goScene">去场景模拟</button>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.filter-row {
  flex-shrink: 0;
  display: flex;
  gap: 8px;
  padding: 8px 16px 0;
}
.filter-chip {
  flex: 1;
  height: 34px;
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
.body {
  flex: 1;
  min-height: 0;
  padding: 12px 16px 22px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.status,
.empty {
  padding: 80px 0;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.status.error {
  color: #d9694f;
  padding: 16px 0;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.empty-emoji {
  font-size: 68px;
}
.empty-sub {
  max-width: 80%;
  font-size: 12px;
  line-height: 1.6;
}
.empty-actions {
  display: flex;
  gap: 10px;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 6px;
}
.group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.group-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-1);
}
.group-count {
  font-size: 11px;
  color: var(--text-3);
}

.outfit-card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 14px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.outfit-head,
.outfit-title-wrap,
.outfit-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.outfit-head {
  justify-content: space-between;
}
.outfit-title-wrap {
  min-width: 0;
  flex: 1;
}
.outfit-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-1);
  line-height: 1.3;
}
.outfit-tag {
  flex-shrink: 0;
  padding: 4px 7px;
  border-radius: var(--radius-pill);
  background: rgba(177, 140, 255, 0.14);
  color: var(--purple-deep);
  font-size: 10px;
  font-weight: 700;
}
.outfit-date {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-3);
}
.outfit-meta {
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
}

.piece-list {
  display: flex;
  gap: 8px;
  white-space: nowrap;
  padding-bottom: 4px;
}
.piece {
  flex: 0 0 82px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.piece-name {
  font-size: 10px;
  color: var(--text-1);
  white-space: normal;
  line-height: 1.25;
}
.outfit-actions {
  justify-content: flex-end;
}
.outfit-action {
  height: 32px;
  padding: 0 13px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  color: var(--purple-deep);
  font-size: 11px;
  font-weight: 700;
}
</style>
