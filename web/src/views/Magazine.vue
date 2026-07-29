<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import SegTabs from '@/components/SegTabs.vue'
import TileImage from '@/components/TileImage.vue'
import { MAGAZINES } from '@/data/mock'

const tab = ref('mag')
const TABS = [
  { key: 'mag', label: '时尚杂志' },
  { key: 'idea', label: '穿搭思路' },
]

const cover = MAGAZINES[0]
const rest = MAGAZINES.slice(1)

// 轻提示
const tip = ref('')
let tipTimer: ReturnType<typeof setTimeout> | null = null
function showTip(msg: string) {
  tip.value = msg
  if (tipTimer) clearTimeout(tipTimer)
  tipTimer = setTimeout(() => (tip.value = ''), 1600)
}
</script>

<template>
  <div class="page">
    <PageHeader title="时尚杂志" to="/home">
      <template #right>
        <span class="avatar">🙋‍♀️</span>
      </template>
    </PageHeader>

    <div class="seg-row">
      <SegTabs v-model="tab" :tabs="TABS" />
    </div>

    <div class="body scroll-y hide-scrollbar">
      <!-- 时尚杂志 -->
      <template v-if="tab === 'mag'">
        <button class="cover" @click="showTip('敬请期待')">
          <TileImage
            :src="cover.img"
            :from="cover.from"
            :to="cover.to"
            :emoji="cover.emoji"
            ratio="3 / 4"
            rounded="var(--radius-lg)"
          />
          <div class="cover-mask">
            <span class="cover-tag">{{ cover.tag }}</span>
            <h2 class="cover-title">{{ cover.title }}</h2>
            <p class="cover-sub">{{ cover.subtitle }}</p>
          </div>
        </button>

        <div class="grid">
          <button
            v-for="m in rest"
            :key="m.id"
            class="mag-card"
            @click="showTip('敬请期待')"
          >
            <div class="mag-cover">
              <TileImage
                :src="m.img"
                :from="m.from"
                :to="m.to"
                :emoji="m.emoji"
                ratio="3 / 4"
                rounded="var(--radius)"
              />
              <span class="mag-tag">{{ m.tag }}</span>
            </div>
            <p class="mag-title">{{ m.title }}</p>
            <p class="mag-sub">{{ m.subtitle }}</p>
          </button>
        </div>
      </template>

      <!-- 穿搭思路 -->
      <template v-else>
        <p class="idea-hint">✨ 精选穿搭干货，点开慢慢读</p>
        <button
          v-for="(m, i) in MAGAZINES"
          :key="m.id"
          class="row"
          @click="showTip('敬请期待')"
        >
          <div class="row-thumb">
            <TileImage
              :src="m.img"
              :from="m.from"
              :to="m.to"
              :emoji="m.emoji"
              ratio="1 / 1"
              rounded="var(--radius)"
            />
          </div>
          <div class="row-text">
            <span class="row-tag">{{ m.tag }}</span>
            <p class="row-title">{{ m.title }} · {{ m.subtitle }}</p>
            <span class="row-meta">第 {{ i + 1 }} 篇 · 3 分钟读完</span>
          </div>
          <span class="row-arrow">›</span>
        </button>
      </template>
    </div>

    <!-- 轻提示 -->
    <Transition name="tip">
      <div v-if="tip" class="toast">{{ tip }}</div>
    </Transition>
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.seg-row {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 2px 16px 10px;
}
.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 18px;
  background: var(--brand-gradient);
  box-shadow: var(--shadow-card);
}
.body {
  flex: 1;
  min-height: 0;
  padding: 4px 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
/* 可滚动的 flex 列里，子项不要被压缩（否则 3:4 大封面会塌成一条） */
.body > * {
  flex-shrink: 0;
}

/* 主打封面 */
.cover {
  position: relative;
  display: block;
  width: 100%;
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-float);
  transition: transform 0.15s ease;
}
.cover:active {
  transform: scale(0.98);
}
.cover-mask {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 40px 18px 18px;
  text-align: left;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0));
}
.cover-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: var(--text-on-brand);
  font-size: 11px;
  font-weight: 700;
}
.cover-title {
  margin: 10px 0 4px;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 1px;
  color: #fff;
}
.cover-sub {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
}

/* 2 列网格 */
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 14px;
}
.mag-card {
  text-align: left;
  transition: transform 0.15s ease;
}
.mag-card:active {
  transform: scale(0.96);
}
.mag-cover {
  position: relative;
  border-radius: var(--radius);
  overflow: hidden;
  box-shadow: var(--shadow-card);
}
.mag-tag {
  position: absolute;
  top: 8px;
  left: 8px;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.85);
  color: var(--pink-deep);
  font-size: 10px;
  font-weight: 700;
}
.mag-title {
  margin: 8px 2px 2px;
  font-size: 14px;
  font-weight: 800;
  color: var(--text-1);
}
.mag-sub {
  margin: 0 2px;
  font-size: 12px;
  color: var(--text-2);
  line-height: 1.4;
}

/* 穿搭思路列表 */
.idea-hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  text-align: left;
  transition: transform 0.15s ease;
}
.row:active {
  transform: scale(0.98);
}
.row-thumb {
  width: 74px;
  flex-shrink: 0;
}
.row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.row-tag {
  align-self: flex-start;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  color: var(--purple-deep);
  font-size: 10px;
  font-weight: 700;
}
.row-title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  line-height: 1.4;
}
.row-meta {
  font-size: 11px;
  color: var(--text-3);
}
.row-arrow {
  font-size: 22px;
  color: var(--text-3);
  flex-shrink: 0;
}

/* 轻提示 */
.toast {
  position: fixed;
  left: 50%;
  bottom: 60px;
  transform: translateX(-50%);
  padding: 10px 22px;
  border-radius: var(--radius-pill);
  background: rgba(40, 30, 55, 0.86);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow-float);
  z-index: 50;
}
.tip-enter-active,
.tip-leave-active {
  transition: all 0.25s ease;
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(10px);
}
</style>
