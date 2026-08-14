<script setup lang="ts">
import { onMounted, ref } from 'vue'
import PageHeader from '@/components/PageHeader/PageHeader.vue'
import TileImage from '@/components/TileImage/TileImage.vue'
import { listSceneOutfits, type SavedSceneOutfit } from '@/api/scene'

const items = ref<SavedSceneOutfit[]>([])
const loading = ref(true)
const errorMessage = ref('')

onMounted(async () => {
  loading.value = true
  try {
    items.value = await listSceneOutfits()
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : String(error)
  } finally {
    loading.value = false
  }
})

function openOutfit(outfit: SavedSceneOutfit) {
  uni.navigateTo({
    url: `/pages/scene/index?outfitId=${outfit.id}`,
  })
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function copyOutfit(outfit: SavedSceneOutfit) {
  const text = `${outfit.title}\n${outfit.weather?.city || '未记录城市'} ${outfit.weather?.condition || ''} ${outfit.weather?.temp ?? ''}℃\n${outfit.composition.map((item) => item.name).join(' / ')}`
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: '分享文案已复制', icon: 'none' }),
  })
}
</script>

<template>
  <view class="page">
    <PageHeader title="我的搭配" to="/pages/me/me" />

    <scroll-view class="body" scroll-y>
      <text v-if="loading" class="status">正在读取我的搭配…</text>
      <text v-else-if="errorMessage" class="status error">{{ errorMessage }}</text>

      <view v-else-if="items.length" class="outfit-list">
        <view v-for="outfit in items" :key="outfit.id" class="outfit-card" @tap="openOutfit(outfit)">
          <view class="outfit-head">
            <view class="outfit-title-wrap">
              <text class="outfit-title">{{ outfit.title }}</text>
              <text class="outfit-tag">{{ outfit.mode === 'pure' ? '纯旧衣' : '新旧混搭' }}</text>
            </view>
            <text class="outfit-date">{{ formatDate(outfit.createdAt) }}</text>
          </view>

          <view class="outfit-meta">
            <text>{{ outfit.season }}</text>
            <text>{{ outfit.weather?.city || '未记录城市' }} · {{ outfit.weather?.condition || '未知天气' }}</text>
          </view>

          <scroll-view scroll-x class="piece-list">
            <view v-for="piece in outfit.composition.slice(0, 8)" :key="piece.id" class="piece">
              <TileImage
                :src="piece.imageUrl"
                :from="piece.from"
                :to="piece.to"
                :emoji="piece.emoji"
                ratio="1 / 1"
                rounded="10px"
              />
              <text class="piece-name">{{ piece.name }}</text>
              <text class="piece-tag">{{ piece.isNew ? '新增' : '旧衣' }}</text>
            </view>
          </scroll-view>

          <view class="outfit-actions">
            <button class="outfit-action" @tap.stop="openOutfit(outfit)">重新打开</button>
            <button class="outfit-action" @tap.stop="copyOutfit(outfit)">复制分享</button>
          </view>
        </view>
      </view>

      <view v-else class="empty">
        <text class="empty-emoji">👗</text>
        <text>还没有保存的搭配方案</text>
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
}
.empty {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.empty-emoji {
  font-size: 68px;
}

.outfit-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
.outfit-meta,
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
  gap: 16px;
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
.piece-tag {
  align-self: flex-start;
  font-size: 9px;
  color: var(--purple-deep);
  background: rgba(177, 140, 255, 0.14);
  border-radius: 6px;
  padding: 2px 5px;
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
