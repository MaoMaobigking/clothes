<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import {
  fetchCommunityContents,
  toggleCommunityInteraction,
  type CommunityContent,
  type CommunityContentType,
} from '@/api/community'
import { isAuthError } from '@/utils/request'
import { useAsyncTask } from '@/composables/useAsyncTask'
import { go } from '@/utils/nav'

const TABS: { key: CommunityContentType; label: string }[] = [
  { key: 'magazine', label: '杂志推送' },
  { key: 'tutorial', label: '穿搭教程' },
  { key: 'share', label: '用户分享' },
  { key: 'challenge', label: '话题挑战' },
]

const activeTab = ref<CommunityContentType>('magazine')
const { loading, errorText: loadError, run } = useAsyncTask({ initialLoading: false, message: '内容加载失败' })
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

const verifiedTutorials = computed(() => contentByType.tutorial.filter((item) => item.body.verified))

const visibleShares = computed(() =>
  topicFilter.value
    ? contentByType.share.filter((item) => item.topics.includes(topicFilter.value))
    : contentByType.share,
)

/*
 * 用户分享的瀑布流（客户需求原文「瀑布流展示用户上传的穿搭照」）。
 *
 * 2026-09-27 换成 MasonryList 组件（虚拟滚动）。原先这里是手写的两列 flex 瀑布流：
 * 布局能对，但**所有卡片都会被渲染**——300 条数据就是 300 个卡片节点同时挂在页面上。
 * MasonryList 只渲染视口内 + overscan 的项，滚动时复用，节点数恒定在十几个。
 * 布局算法本身没变（还是「哪个列矮放哪个」），只是从组件里挪进了纯函数
 * utils/masonry.ts —— 那边有 27 个测试，而这里原来一份测试都没有。
 *
 * ── 两个数字必须对齐，否则卡片会重叠 ──
 * MasonryList 的定位假设「单元格高度 = 列宽 / aspectRatio」，也就是它以为
 * 单元格就是封面。但真实卡片 = 封面 + 作者行 + 文案 + 话题 + 互动按钮，
 * 比封面高。所以传进去的 aspectRatio 必须是**整张卡片的**等效比例，
 * 而不是封面的比例 —— 传封面比例的话每张卡片都会压到下一张上。
 *
 * 换算：卡片高 = 封面高 + 固定开销 = 列宽/封面比例 + 列宽*CARD_OVERHEAD
 *       等效比例 = 列宽 / 卡片高 = 1 / (1/封面比例 + CARD_OVERHEAD)
 */
const COVER_RATIOS = ['3 / 4', '1 / 1', '4 / 5'] as const
/** 封面比例字符串 → 宽/高数值（MasonryList 要的是数值，不是 '3 / 4' 这种字符串） */
const COVER_RATIO_VALUE: Record<string, number> = { '3 / 4': 3 / 4, '1 / 1': 1, '4 / 5': 4 / 5 }
/** 封面以外那部分（作者行 + 文案 + 话题 + 互动按钮）折算成列宽的倍数 */
const CARD_OVERHEAD = 0.95

/*
 * 封面比例按**在 visibleShares 里的位置**定，而不是按列内下标 ——
 * 用列内下标重算的话，切话题筛选时同一张图的列位置变了、比例也跟着换，看着像闪。
 * 这条约定是从手写版本继承下来的，行为没变。
 */
function coverRatioAt(index: number): number {
  return COVER_RATIO_VALUE[COVER_RATIOS[index % 3]]
}

/** 封面比例 → 整张卡片的等效比例（推导见上方注释） */
function cardAspectRatio(index: number): number {
  return 1 / (1 / coverRatioAt(index) + CARD_OVERHEAD)
}

const shareItems = computed(() =>
  visibleShares.value.map((item, index) => ({
    ...item,
    aspectRatio: cardAspectRatio(index),
    /** 封面单独的比例，TileImage 用（它是封面自己的比例，不是卡片的） */
    coverRatio: COVER_RATIOS[index % 3],
  })),
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
  const filters =
    activeTab.value === 'tutorial'
      ? { category: activeCategory.value === '全部' ? '' : activeCategory.value }
      : activeTab.value === 'share'
        ? { topic: topicFilter.value }
        : {}
  const items = await run(() => fetchCommunityContents(activeTab.value, filters), { silent })
  if (items) contentByType[activeTab.value] = items
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
    go('magazineDetail', { id: item.id })
  } else if (item.type === 'tutorial') {
    go('teachDetail', { id: item.id })
  } else {
    go('shareDetail', { id: item.id })
  }
}

function publishShare() {
  go('shareEditor')
}

async function toggleAction(item: CommunityContent, action: 'like' | 'favorite' | 'report') {
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
  <!--
    share 分支要额外加 .page-share：把整页钉死在视口高度 + overflow:hidden，
    这样内部 flex:1 的滚动区才拿得到**确定高度**。
    不加的话父链 uni-page-body 会随内容长到全部内容的高度（实测 57507px），
    滚动容器高度等于内容高度 → 滚不动，虚拟滚动完全失效。
    见 .page-share 的样式注释。
  -->
  <view class="page" :class="{ 'page-share': activeTab === 'share' }">
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

    <!--
      ⚠️ 滚动容器不能嵌套，所以这里按 tab 分支切换 .body 的行为：

      - share 分支：瀑布流由 MasonryList 自己滚（它内部是 scroll-view），
        外层必须是「确定高度 + 不滚」的 flex 列，否则两层滚动会互相吃事件，
        虚拟可视区间算错 —— 表现是滚到一半卡片整片消失。
      - 其余三个 tab：内容是普通文档流，维持原来的整页滚动。

      别把这两个合成一个 `scroll-y`：那样 share 分支就变成嵌套滚动了。
    -->
    <view class="body hide-scrollbar" :class="activeTab === 'share' ? 'body-share' : 'scroll-y'">
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
              <TileImage :src="item.coverUrl" emoji="📖" from="#f3e0d6" to="#c98fb0" ratio="3 / 4" rounded="24rpx" />
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
            <view v-for="item in visibleTutorials" :key="item.id" class="tutorial-card" @tap="openContent(item)">
              <TileImage
                :src="item.coverUrl"
                :emoji="item.authorAvatar"
                from="#d6e4f0"
                to="#9ab6d8"
                ratio="16 / 10"
                rounded="24rpx"
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
          <!--
            虚拟滚动容器。它内部自带 scroll-view，所以外层不能再套滚动容器
            （嵌套滚动会让它的 scrollTop 与可视区计算错乱），见 .share-feed 的样式注释。
            卡片本体通过默认插槽传进去 —— MasonryList 只负责「放在哪」，不关心长什么样。
          -->
          <MasonryList v-else class="share-feed" :items="shareItems" :gap="12" :overscan="1">
            <template #default="{ item }">
              <view class="share-card" @tap="openContent(item)">
                <TileImage
                  :src="item.coverUrl"
                  :emoji="item.authorAvatar"
                  from="#ffd6e8"
                  to="#c9b8ff"
                  :ratio="item.coverRatio"
                  rounded="24rpx"
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
                  <view class="action" :class="{ on: item.liked }" @tap.stop="toggleAction(item, 'like')">
                    <UiIcon
                      name="heart"
                      :size="28"
                      :tone="item.liked ? 'brand' : 'muted'"
                      :stroke-width="item.liked ? 2.6 : 1.7"
                    />
                    <text>{{ item.likeCount }}</text>
                  </view>
                  <view class="action" @tap.stop="openContent(item)">
                    <UiIcon name="comment" :size="28" tone="muted" />
                    <text>{{ item.commentCount }}</text>
                  </view>
                  <view class="action" :class="{ on: item.favorited }" @tap.stop="toggleAction(item, 'favorite')">
                    <UiIcon
                      name="star"
                      :size="28"
                      :tone="item.favorited ? 'brand' : 'muted'"
                      :stroke-width="item.favorited ? 2.6 : 1.7"
                    />
                    <text>{{ item.favoriteCount }}</text>
                  </view>
                  <view class="action subtle" @tap.stop="toggleAction(item, 'report')">举报</view>
                </view>
              </view>
            </template>
          </MasonryList>
        </template>

        <template v-else>
          <view class="section-head">
            <view>
              <view class="section-title">话题挑战</view>
              <view class="section-sub">完成挑战，让真实穿搭被看见</view>
            </view>
          </view>
          <view class="challenge-list">
            <view v-for="item in contentByType.challenge" :key="item.id" class="challenge-card">
              <TileImage
                :src="item.coverUrl"
                :emoji="item.authorAvatar"
                from="#e3f0e6"
                to="#9fceb0"
                ratio="16 / 9"
                rounded="24rpx"
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
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 72rpx;
  height: 64rpx;
  padding: 0 22rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.tabs {
  display: grid;
  flex-shrink: 0;
  grid-template-columns: repeat(4, 1fr);
  gap: 8rpx;
  padding: 8rpx;
  margin: 0 32rpx 20rpx;
  background: rgb(255 255 255 / 72%);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.tab {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72rpx;
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
  border-radius: var(--radius-pill);
}

.tab.on {
  color: #fff;
  background: var(--brand-gradient);
}

/*
 * share 分支专用：把整页钉死在视口高度。
 *
 * ── 为什么必须这么写（实测数据）──
 * .page 原本是 `height:100%; min-height:100vh`。父链上的 uni-page-body 是
 * 「高度随内容长」的，所以 height:100% 解析出来的不是视口高，而是**全部内容的高度**：
 *
 *   masonry-scroll    clientH = 57334   ← 滚动容器高度 == 内容高度
 *   uni-page-body     clientH = 57507
 *   uni-page-wrapper  clientH =   844   ← 只有这一层是真视口高
 *
 * 结果：滚动容器 clientHeight === scrollHeight，**根本滚不动**
 * （程序化设 scrollTop=5000 实测回弹为 0）。
 * 虚拟滚动依赖 scrollTop 计算可视区间，滚不动 → 可视区永远停在开头 →
 * 往下全是空白。而这件事用 FPS 指标看不出来（不滚动时帧率反而更高），
 * 只有对比 clientHeight 与 scrollHeight 才会暴露。
 *
 * ── 为什么 height:100vh 而不是 100% ──
 * 100% 依赖父链有确定高度，而父链恰恰没有，所以必须用视口单位自己钉住。
 * overflow:hidden 是配套的：钉住高度后内容会溢出，不裁掉的话
 * 整页还能滚动，又会和外层滚动打架。
 *
 * 副作用：share 分支下 PageHeader 和 tabs 不再跟着内容滚走（固定住）。
 * 这是可接受的 —— 它们本来就是导航，固定反而更好用。
 */
.page-share {
  height: 100vh;
  overflow: hidden;
}

.body {
  padding: 8rpx 32rpx 44rpx;
}

/*
 * share 分支专用：不给它滚动，而是变成一个确定高度的 flex 列，
 * 把剩余高度交给内部的 MasonryList（.share-feed 是 flex:1）。
 *
 * padding-bottom 归零的原因：底部留白由 MasonryList 自己的滚动内容承担，
 * 这里再留一份的话，容器高度少了 44rpx，虚拟可视区就会比实际矮一截，
 * 表现为滚到底部时最后一行卡片还没进视口就已经「没有更多了」。
 */
.body-share {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding-bottom: 0;
}

.state {
  padding: 64rpx 24rpx;
  color: var(--text-2);
}

.state.error {
  color: var(--danger);
}

.retry {
  margin-top: 20rpx;
  font-weight: 700;
  color: var(--purple-deep);
}

.section-head,
.share-toolbar {
  display: flex;
  gap: 20rpx;
  align-items: center;
  justify-content: space-between;
  margin: 18rpx 0 22rpx;
}

.section-sub {
  margin-top: 8rpx;
  font-size: var(--fs-sm);
}

.share-button,
.join-button {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  height: 64rpx;
  padding: 0 26rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.magazine-grid,
.tutorial-grid,
.challenge-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24rpx;
}

/*
 * 用户分享是瀑布流，不能和上面几个共用 grid：
 * grid 会把同一行两张卡拉成等高，矮的下面留白。瀑布流由 MasonryList 负责
 * （虚拟滚动 + 「哪个列矮放哪个」），这里只给它一个**确定高度**的容器。
 *
 * ⚠️ 两个硬约束，改这里时都要留住：
 *
 * 1. 必须有确定高度。MasonryList 内部是 scroll-view，高度不定的话可视区
 *    算不出来（viewportHeight 取的是 windowHeight，容器实际高度对不上就会露白）。
 *    所以它是 flex:1 + min-height:0，靠父级 .page 的确定高度撑开。
 *
 * 2. 不能再套一层滚动容器。它自己就能滚，外面再套一个 overflow:auto 的话
 *    滚动事件被外层吃掉一部分，虚拟区间算错 —— 表现是滚到一半卡片整片消失。
 *    所以 share 分支要脱离 .body（那个是 .scroll-y），见模板里的结构。
 */
.share-feed {
  flex: 1;
  min-height: 0;
  margin-top: 16rpx;
}

/*
 * 卡片填满 MasonryList 算出的格子。
 *
 * width/height 都写 100% 而不是让内容自己撑：MasonryList 用 transform 把格子
 * 定位在算好的坐标上，格子高度是**按封面比例 + CARD_OVERHEAD 预估的**。
 * 卡片比格子矮 → 格子之间留缝（可接受）；比格子高 → 压住下一张（不可接受）。
 * 所以下面的 CARD_OVERHEAD 宁可估大一点。
 */
.share-feed .share-card {
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.magazine-card,
.tutorial-card,
.share-card,
.challenge-card {
  min-width: 0;
  padding: 16rpx;
  background: var(--surface);
  border-radius: var(--radius);
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
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--purple-deep);
}

.magazine-title,
.card-title {
  margin-top: 10rpx;
  font-size: var(--fs-lg);
  font-weight: 500;
  line-height: 1.4;
  color: var(--text-1);
}

.magazine-subtitle,
.challenge-subtitle {
  margin-top: 6rpx;
  font-size: var(--fs-sm);
  line-height: 1.45;
  color: var(--text-2);
}

.category-row {
  display: flex;
  gap: 12rpx;
  padding-bottom: 4rpx;
  margin: 18rpx 0 22rpx;
  overflow-x: auto;

  /* 横向分类条：iOS 下不开惯性滚动会「粘手」。体验评分 w=8 项点名过这里 */
  -webkit-overflow-scrolling: touch;
}

.blogger-strip {
  display: flex;
  gap: 18rpx;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx;
  margin: 18rpx 0 4rpx;
  background: rgb(169 220 214 / 28%);
  border-radius: var(--radius);
}

.blogger-title {
  font-size: var(--fs-md);
  font-weight: 500;
  color: #3d716b;
}

.blogger-sub {
  margin-top: 6rpx;
  font-size: var(--fs-xs);
  color: #618d86;
}

.cooperation {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  height: 60rpx;
  padding: 0 22rpx;
  font-size: var(--fs-sm);
  font-weight: 700;
  color: #fff;
  background: var(--mint);
  border-radius: var(--radius-pill);
}

.category-chip {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  height: 60rpx;
  padding: 0 24rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface-soft);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.category-chip.on {
  color: #fff;
  background: var(--brand-gradient);
}

.tutorial-meta {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
  margin-top: 12rpx;
  font-size: var(--fs-sm);
  color: var(--text-3);
}

.verified-mark {
  display: inline-block;
  margin-top: 10rpx;
  margin-right: 8rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--mint-deep);
}

.completed-mark {
  font-weight: 700;
  color: var(--mint-deep);
}

.active-topic {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18rpx 22rpx;
  margin-bottom: 18rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: #477a72;
  background: rgb(169 220 214 / 25%);
  border-radius: var(--radius);
}

.clear-topic {
  color: var(--purple-deep);
}

.share-author {
  display: flex;
  gap: 10rpx;
  align-items: center;
  margin-top: 14rpx;
}

.author-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44rpx;
  height: 44rpx;
  font-size: var(--fs-md);
  background: var(--surface-soft);
  border-radius: 50%;
}

.author-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--fs-sm);
  color: var(--text-2);
  white-space: nowrap;
}

.share-caption {
  display: -webkit-box;
  margin-top: 12rpx;
  overflow: hidden;
  -webkit-line-clamp: 2;
  font-size: var(--fs-md);
  font-weight: 700;
  line-height: 1.45;
  color: var(--text-1);
  -webkit-box-orient: vertical;
}

.share-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 10rpx;
}

.topic {
  font-size: var(--fs-xs);
  color: var(--purple-deep);
}

.share-actions {
  display: flex;
  gap: 6rpx;
  align-items: center;
  justify-content: space-between;
  margin-top: 14rpx;
}

.action {
  font-size: var(--fs-sm);
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
  font-size: var(--fs-sm);
  line-height: 1.5;
  color: var(--text-2);
}

.challenge-footer {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}

.participants {
  font-size: var(--fs-sm);
  color: var(--text-3);
}
</style>
