<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import {
  fetchCommunityContents,
  toggleCommunityInteraction,
  type CommunityContent,
  type CommunityContentType,
} from '@/api/community'
import { isAuthError } from '@/api/http'

const TABS: { key: CommunityContentType; label: string }[] = [
  { key: 'magazine', label: '杂志推送' },
  { key: 'tutorial', label: '穿搭教程' },
  { key: 'share', label: '用户分享' },
  { key: 'challenge', label: '话题挑战' },
]

const activeTab = ref<CommunityContentType>('magazine')
const loading = ref(false)
const loadError = ref('')
const topicFilter = ref('')
const activeCategory = ref('全部')
const contentByType = reactive<Record<CommunityContentType, CommunityContent[]>>({
  magazine: [],
  tutorial: [],
  share: [],
  challenge: [],
})

const categories = ['全部', '新手入门', '高级技巧', '场景穿搭', '配饰搭配']

const visibleTutorials = computed(() =>
  activeCategory.value === '全部'
    ? contentByType.tutorial
    : contentByType.tutorial.filter((item) => item.category === activeCategory.value),
)

const verifiedTutorials = computed(() =>
  contentByType.tutorial.filter((item) => item.body.verified),
)

const visibleShares = computed(() =>
  topicFilter.value
    ? contentByType.share.filter((item) => item.topics.includes(topicFilter.value))
    : contentByType.share,
)

/*
 * 当前 tab 手里有没有可显示的数据。
 * 用来决定「加载中」要不要盖住整页 —— 见下面 loadCurrentTab 的注释。
 */
const hasCurrentData = computed(() => contentByType[activeTab.value].length > 0)

onLoad((options) => {
  const tab = options?.tab
  if (TABS.some((item) => item.key === tab)) activeTab.value = tab as CommunityContentType
})

/*
 * 只在 onShow 里拉数据，**不要再加 onMounted**。
 *
 * 原来两个钩子都调了 loadCurrentTab()，而 onShow 首次进页面也会触发 ——
 * 结果首次进入是两个并发请求、loading 被来回切两轮，页面闪两次。
 * onShow 单独用就够：它覆盖「首次进入」和「从详情页返回」两种情况。
 */
onShow(() => {
  void loadCurrentTab()
})

async function loadCurrentTab() {
  /*
   * 关键：只有当前 tab **一条数据都没有**时才置 loading。
   *
   * 原来无条件 loading = true，而模板里 `v-if="loading"` 会把整个 body 换成
   * 「正在读取社区内容...」。于是每次切 tab、每次从详情页返回，都是
   * 内容 → 整页文字 → 内容，看起来就是闪屏。
   *
   * 手里已经有数据时静默刷新：旧内容一直挂着，新数据到了直接替换，中间没有空帧。
   */
  const silent = hasCurrentData.value
  if (!silent) loading.value = true
  loadError.value = ''
  try {
    const filters =
      activeTab.value === 'tutorial'
        ? { category: activeCategory.value === '全部' ? '' : activeCategory.value }
        : activeTab.value === 'share'
          ? { topic: topicFilter.value }
          : {}
    const items = await fetchCommunityContents(activeTab.value, filters)
    contentByType[activeTab.value] = items
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复报错（规格 §5）
    if (!isAuthError(error)) {
      loadError.value = error instanceof Error ? error.message : '内容加载失败'
    }
  } finally {
    loading.value = false
  }
}

function switchTab(tab: CommunityContentType) {
  activeTab.value = tab
  if (tab !== 'share') topicFilter.value = ''
  void loadCurrentTab()
}

function setCategory(category: string) {
  activeCategory.value = category
  void loadCurrentTab()
}

function openContent(item: CommunityContent) {
  if (item.type === 'magazine') {
    uni.navigateTo({ url: `/pages/magazine-detail/index?id=${encodeURIComponent(item.id)}` })
  } else if (item.type === 'tutorial') {
    uni.navigateTo({ url: `/pages/teach-detail/index?id=${encodeURIComponent(item.id)}` })
  } else {
    uni.navigateTo({ url: `/pages/share-detail/index?id=${encodeURIComponent(item.id)}` })
  }
}

function publishShare() {
  uni.navigateTo({ url: '/pages/share-editor/index' })
}

async function toggleAction(
  item: CommunityContent,
  action: 'like' | 'favorite' | 'report',
) {
  try {
    const result = await toggleCommunityInteraction(item.id, action)
    Object.assign(item, result.content)
    if (action === 'report' && result.active) {
      contentByType.share = contentByType.share.filter((post) => post.id !== item.id)
    }
  } catch (error) {
    // 未登录时请求层已跳登录页并提示过一次，这里不再重复弹（规格 §5）
    if (!isAuthError(error)) {
      uni.showToast({
        title: error instanceof Error ? error.message : '操作失败',
        icon: 'none',
      })
    }
  }
}

function joinChallenge(challenge: CommunityContent) {
  topicFilter.value = challenge.topics[0] || ''
  activeTab.value = 'share'
  void loadCurrentTab()
}

function clearTopic() {
  topicFilter.value = ''
  void loadCurrentTab()
}

function showCooperationTip() {
  uni.showToast({
    title: '合作邀约已记录，后续可联系演示博主',
    icon: 'none',
  })
}
</script>

<template>
  <view class="page">
    <PageHeader title="时尚社区" to="/pages/home/home">
      <template #right>
        <view class="publish" @tap="publishShare">发布</view>
      </template>
    </PageHeader>

    <view class="tabs">
      <view
        v-for="tab in TABS"
        :key="tab.key"
        class="tab"
        :class="{ on: activeTab === tab.key }"
        @tap="switchTab(tab.key)"
      >
        {{ tab.label }}
      </view>
    </view>

    <view class="body scroll-y hide-scrollbar">
      <!--
        `loading && !hasCurrentData`：只有「一条都没有」时才用整页文字盖住内容。
        手里有旧数据时是静默刷新（见 loadCurrentTab），旧内容一直挂着，
        不会出现 内容→整页文字→内容 的闪屏。
      -->
      <view v-if="loading && !hasCurrentData" class="state">正在读取社区内容...</view>
      <view v-else-if="loadError" class="state error">
        {{ loadError }}
        <view class="retry" @tap="loadCurrentTab">重新加载</view>
      </view>

      <template v-else>
        <template v-if="activeTab === 'magazine'">
          <view class="section-head">
            <view>
              <view class="section-title">杂志推送</view>
              <view class="section-sub">按月更新的电子杂志与专题</view>
            </view>
          </view>
          <view class="magazine-grid">
            <view
              v-for="(item, index) in contentByType.magazine"
              :key="item.id"
              class="magazine-card"
              :class="{ feature: index === 0 }"
              @tap="openContent(item)"
            >
              <TileImage
                :src="item.coverUrl"
                emoji="📖"
                from="#f3e0d6"
                to="#c98fb0"
                ratio="3 / 4"
                rounded="12px"
              />
              <view class="magazine-meta">
                <text class="magazine-month">{{ item.publishedMonth }}</text>
                <view class="magazine-title">{{ item.title }}</view>
                <view class="magazine-subtitle">{{ item.subtitle }}</view>
              </view>
            </view>
          </view>
        </template>

        <template v-else-if="activeTab === 'tutorial'">
          <view v-if="verifiedTutorials.length" class="blogger-strip">
            <view>
              <view class="blogger-title">认证博主独家教程</view>
              <view class="blogger-sub">{{ verifiedTutorials.length }} 位演示博主在线发布</view>
            </view>
            <view class="cooperation" @tap="showCooperationTip">合作邀约</view>
          </view>
          <view class="category-row">
            <view
              v-for="category in categories"
              :key="category"
              class="category-chip"
              :class="{ on: activeCategory === category }"
              @tap="setCategory(category)"
            >
              {{ category }}
            </view>
          </view>
          <view class="tutorial-grid">
            <view
              v-for="item in visibleTutorials"
              :key="item.id"
              class="tutorial-card"
              @tap="openContent(item)"
            >
              <TileImage
                :src="item.coverUrl"
                :emoji="item.authorAvatar"
                from="#d6e4f0"
                to="#9ab6d8"
                ratio="16 / 10"
                rounded="12px"
              />
              <text class="tutorial-category">{{ item.category }}</text>
              <text v-if="item.body.verified" class="verified-mark">认证博主</text>
              <view class="card-title">{{ item.title }}</view>
              <view class="tutorial-meta">
                {{ item.body.duration || '图文教程' }}
                <text v-if="item.completed" class="completed-mark">已完成</text>
              </view>
            </view>
          </view>
        </template>

        <template v-else-if="activeTab === 'share'">
          <view class="share-toolbar">
            <view class="share-head">
              <view class="section-title">穿搭广场</view>
              <view class="section-sub">点赞、评论与收藏都会真实保存</view>
            </view>
            <view class="share-button" @tap="publishShare">上传穿搭</view>
          </view>
          <view v-if="topicFilter" class="active-topic">
            正在参加 {{ topicFilter }}
            <text class="clear-topic" @tap="clearTopic">清除</text>
          </view>
          <view v-if="!visibleShares.length" class="state">这个话题下还没有内容</view>
          <view class="feed">
            <view
              v-for="(item, index) in visibleShares"
              :key="item.id"
              class="share-card"
              @tap="openContent(item)"
            >
              <TileImage
                :src="item.coverUrl"
                :emoji="item.authorAvatar"
                from="#ffd6e8"
                to="#c9b8ff"
                :ratio="index % 3 === 0 ? '3 / 4' : index % 2 === 0 ? '1 / 1' : '4 / 5'"
                rounded="12px"
              />
              <view class="share-author">
                <text class="author-avatar">{{ item.authorAvatar }}</text>
                <text class="author-name">{{ item.authorName }}</text>
              </view>
              <view class="share-caption">{{ item.title }}</view>
              <view class="share-topics">
                <text v-for="topic in item.topics" :key="topic" class="topic">{{ topic }}</text>
              </view>
              <view class="share-actions">
                <view
                  class="action"
                  :class="{ on: item.liked }"
                  @tap.stop="toggleAction(item, 'like')"
                >
                  <UiIcon name="heart" :size="28" :tone="item.liked ? 'brand' : 'muted'" :stroke-width="item.liked ? 2.6 : 1.7" /><text>{{ item.likeCount }}</text>
                </view>
                <view class="action" @tap.stop="openContent(item)">
                  <UiIcon name="comment" :size="28" tone="muted" /><text>{{ item.commentCount }}</text>
                </view>
                <view
                  class="action"
                  :class="{ on: item.favorited }"
                  @tap.stop="toggleAction(item, 'favorite')"
                >
                  <UiIcon name="star" :size="28" :tone="item.favorited ? 'brand' : 'muted'" :stroke-width="item.favorited ? 2.6 : 1.7" /><text>{{ item.favoriteCount }}</text>
                </view>
                <view class="action subtle" @tap.stop="toggleAction(item, 'report')">举报</view>
              </view>
            </view>
          </view>
        </template>

        <template v-else>
          <view class="section-head">
            <view>
              <view class="section-title">话题挑战</view>
              <view class="section-sub">完成挑战，让真实穿搭被看见</view>
            </view>
          </view>
          <view class="challenge-list">
            <view
              v-for="item in contentByType.challenge"
              :key="item.id"
              class="challenge-card"
            >
              <TileImage
                :src="item.coverUrl"
                :emoji="item.authorAvatar"
                from="#e3f0e6"
                to="#9fceb0"
                ratio="16 / 9"
                rounded="12px"
              />
              <text class="challenge-category">{{ item.category }}</text>
              <view class="card-title">{{ item.title }}</view>
              <view class="challenge-subtitle">{{ item.subtitle }}</view>
              <view class="challenge-body">
                {{ item.body.description }}
              </view>
              <view class="challenge-footer">
                <text class="participants">{{ item.participantCount }} 人已参与</text>
                <view class="join-button" @tap="joinChallenge(item)">去参加</view>
              </view>
            </view>
          </view>
        </template>
      </template>
    </view>
  </view>
</template>

<style scoped>
.publish {
  min-width: 72rpx;
  height: 64rpx;
  padding: 0 22rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.tabs {
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
  margin: 0 32rpx 20rpx;
  padding: 8rpx;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.72);
  box-shadow: var(--shadow-card);
}
.tab {
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  color: var(--text-2);
  font-size: 26rpx;
  font-weight: 700;
  white-space: nowrap;
}
.tab.on {
  background: var(--brand-gradient);
  color: #fff;
}
.body {
  flex: 1;
  min-height: 0;
  padding: 8rpx 32rpx 44rpx;
}
.state {
  padding: 64rpx 24rpx;
  text-align: center;
  color: var(--text-2);
  font-size: 26rpx;
}
.state.error {
  color: var(--danger);
}
.retry {
  margin-top: 20rpx;
  color: var(--purple-deep);
  font-weight: 700;
}
.section-head,
.share-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20rpx;
  margin: 18rpx 0 22rpx;
}
.section-title {
  font-size: 30rpx;
  font-weight: 500;
  color: var(--text-1);
}
.section-sub {
  margin-top: 8rpx;
  font-size: 22rpx;
  color: var(--text-3);
}
.share-button,
.join-button {
  flex-shrink: 0;
  height: 64rpx;
  padding: 0 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
  background: var(--brand-gradient);
  color: #fff;
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.magazine-grid,
.tutorial-grid,
.feed,
.challenge-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24rpx;
}
.magazine-card,
.tutorial-card,
.share-card,
.challenge-card {
  min-width: 0;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16rpx;
  box-shadow: var(--shadow-card);
}
.magazine-card.feature {
  grid-column: 1 / -1;
}
.magazine-meta {
  padding: 16rpx 4rpx 4rpx;
}
.magazine-month,
.tutorial-category,
.challenge-category {
  display: block;
  font-size: 20rpx;
  font-weight: 700;
  color: var(--purple-deep);
}
.magazine-title,
.card-title {
  margin-top: 10rpx;
  font-size: 28rpx;
  line-height: 1.4;
  font-weight: 500;
  color: var(--text-1);
}
.magazine-subtitle,
.challenge-subtitle {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.45;
  color: var(--text-2);
}
.category-row {
  display: flex;
  gap: 12rpx;
  overflow-x: auto;
  margin: 18rpx 0 22rpx;
  padding-bottom: 4rpx;
}
.blogger-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  margin: 18rpx 0 4rpx;
  padding: 22rpx;
  border-radius: var(--radius);
  background: rgba(169, 220, 214, 0.28);
}
.blogger-title {
  font-size: 26rpx;
  font-weight: 500;
  color: #3d716b;
}
.blogger-sub {
  margin-top: 6rpx;
  font-size: 21rpx;
  color: #618d86;
}
.cooperation {
  flex-shrink: 0;
  height: 60rpx;
  padding: 0 22rpx;
  display: flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: var(--mint);
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}
.category-chip {
  flex: 0 0 auto;
  height: 60rpx;
  padding: 0 24rpx;
  display: flex;
  align-items: center;
  border-radius: var(--radius-pill);
  background: var(--surface-soft);
  color: var(--text-2);
  font-size: 24rpx;
  font-weight: 700;
  box-shadow: var(--shadow-card);
}
.category-chip.on {
  background: var(--brand-gradient);
  color: #fff;
}
.tutorial-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: var(--text-3);
}
.verified-mark {
  display: inline-block;
  margin-top: 10rpx;
  margin-right: 8rpx;
  font-size: 20rpx;
  font-weight: 700;
  color: var(--mint-deep);
}
.completed-mark {
  color: var(--mint-deep);
  font-weight: 700;
}
.active-topic {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18rpx;
  padding: 18rpx 22rpx;
  border-radius: var(--radius);
  background: rgba(169, 220, 214, 0.25);
  color: #477a72;
  font-size: 24rpx;
  font-weight: 700;
}
.clear-topic {
  color: var(--purple-deep);
}
.share-author {
  display: flex;
  align-items: center;
  gap: 10rpx;
  margin-top: 14rpx;
}
.author-avatar {
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-soft);
  font-size: 26rpx;
}
.author-name {
  font-size: 22rpx;
  color: var(--text-2);
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.share-caption {
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.45;
  font-weight: 700;
  color: var(--text-1);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.share-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 10rpx;
}
.topic {
  font-size: 20rpx;
  color: var(--purple-deep);
}
.share-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6rpx;
  margin-top: 14rpx;
}
.action {
  font-size: 22rpx;
  color: var(--text-2);
  white-space: nowrap;
}
.action.on {
  color: var(--pink-deep);
}
.action.subtle {
  color: var(--text-3);
}
.challenge-body {
  margin-top: 10rpx;
  font-size: 22rpx;
  line-height: 1.5;
  color: var(--text-2);
}
.challenge-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12rpx;
  margin-top: 16rpx;
}
.participants {
  font-size: 22rpx;
  color: var(--text-3);
}
</style>
