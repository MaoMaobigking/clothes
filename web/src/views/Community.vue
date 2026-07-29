<script setup lang="ts">
import { ref } from 'vue'
import PageHeader from '@/components/PageHeader.vue'
import TileImage from '@/components/TileImage.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import { POSTS, HOT_TOPICS } from '@/data/mock'

// 精选 banner：取前 2 条
const banners = POSTS.slice(0, 2)

// 瀑布感：给每条帖子分配一个高度比例（循环取用）
const RATIOS = ['3 / 4', '1 / 1', '4 / 5', '3 / 5', '5 / 6', '4 / 3']
function ratioOf(index: number): string {
  return RATIOS[index % RATIOS.length]
}

// 本地点赞：记录被点亮的帖子 id（不写回 mock）
const liked = ref<Set<string>>(new Set())
function isLiked(id: string): boolean {
  return liked.value.has(id)
}
function toggleLike(id: string): void {
  const next = new Set(liked.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  liked.value = next
}
function likeCount(id: string, base: number): number {
  return base + (liked.value.has(id) ? 1 : 0)
}
</script>

<template>
  <div class="page">
    <PageHeader title="时尚社群" to="/home">
      <template #right>
        <button class="city">杭州 ▾</button>
      </template>
    </PageHeader>

    <div class="body scroll-y hide-scrollbar">
      <!-- 搜索框（仅样式） -->
      <div class="search">
        <span class="s-ico">🔍</span>
        <span class="s-ph">搜索穿搭灵感、话题、达人</span>
      </div>

      <!-- 热门推荐 banner -->
      <section>
        <SectionTitle title="热门推荐" />
        <div class="banners">
          <article v-for="b in banners" :key="b.id" class="banner">
            <div class="b-text">
              <span class="b-topic">#{{ b.topic }}</span>
              <p class="b-title">{{ b.text }}</p>
              <span class="b-author">{{ b.avatar }} {{ b.author }}</span>
            </div>
            <TileImage
              :src="b.img"
              :from="b.from"
              :to="b.to"
              :emoji="b.emoji"
              ratio="1 / 1"
              rounded="var(--radius)"
              class="b-img"
            />
          </article>
        </div>
      </section>

      <!-- 热门话题 chips（横滑） -->
      <section>
        <SectionTitle title="热门话题" />
        <div class="topics hide-scrollbar">
          <span v-for="t in HOT_TOPICS" :key="t" class="chip">{{ t }}</span>
        </div>
      </section>

      <!-- 信息流：瀑布流 2 列 -->
      <section>
        <SectionTitle title="穿搭广场" />
        <div class="feed">
          <article v-for="(p, i) in POSTS" :key="p.id" class="post">
            <TileImage
              :src="p.img"
              :from="p.from"
              :to="p.to"
              :emoji="p.emoji"
              :ratio="ratioOf(i)"
              rounded="var(--radius)"
            />
            <p class="p-text">{{ p.text }}</p>
            <footer class="p-foot">
              <span class="p-author">
                <span class="p-avatar">{{ p.avatar }}</span>
                <span class="p-name">{{ p.author }}</span>
              </span>
              <span class="p-stats">
                <button
                  class="p-like"
                  :class="{ on: isLiked(p.id) }"
                  @click="toggleLike(p.id)"
                >
                  {{ isLiked(p.id) ? '❤️' : '🤍' }} {{ likeCount(p.id, p.likes) }}
                </button>
                <span class="p-cmt">💬 {{ p.comments }}</span>
              </span>
            </footer>
          </article>
        </div>
      </section>
    </div>
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
  gap: 16px;
}

.city {
  font-size: 13px;
  font-weight: 700;
  color: var(--pink-deep);
  background: rgba(255, 255, 255, 0.75);
  border-radius: var(--radius-pill);
  padding: 6px 12px;
  box-shadow: var(--shadow-card);
  white-space: nowrap;
}

/* 搜索框 */
.search {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--surface);
  border-radius: var(--radius-pill);
  padding: 11px 16px;
  box-shadow: var(--shadow-card);
}
.s-ico {
  font-size: 15px;
}
.s-ph {
  font-size: 14px;
  color: var(--text-3);
}

/* 热门话题 chips */
.topics {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  margin-top: 10px;
  padding-bottom: 2px;
}
.chip {
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 600;
  color: var(--purple-deep);
  background: var(--surface-soft);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  padding: 7px 14px;
  white-space: nowrap;
}

/* 精选 banner */
.banners {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
}
.banner {
  display: flex;
  align-items: stretch;
  gap: 12px;
  background: var(--surface);
  border-radius: var(--radius-lg);
  padding: 12px;
  box-shadow: var(--shadow-card);
}
.b-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.b-topic {
  font-size: 12px;
  font-weight: 700;
  color: var(--pink-deep);
}
.b-title {
  margin: 0;
  flex: 1;
  font-size: 15px;
  font-weight: 700;
  line-height: 1.5;
  color: var(--text-1);
}
.b-author {
  font-size: 12px;
  color: var(--text-2);
}
.b-img {
  width: 92px;
  flex-shrink: 0;
}

/* 瀑布流信息流 */
.feed {
  column-count: 2;
  column-gap: 12px;
  margin-top: 10px;
}
.post {
  break-inside: avoid;
  display: inline-block;
  width: 100%;
  margin-bottom: 12px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 8px;
  box-shadow: var(--shadow-card);
}
.p-text {
  margin: 8px 2px 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.p-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin: 8px 2px 2px;
}
.p-author {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
}
.p-avatar {
  font-size: 15px;
}
.p-name {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.p-stats {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.p-like {
  font-size: 11px;
  color: var(--text-2);
  transition: transform 0.12s ease;
}
.p-like.on {
  color: var(--pink-deep);
}
.p-like:active {
  transform: scale(1.2);
}
.p-cmt {
  font-size: 11px;
  color: var(--text-3);
}
</style>
