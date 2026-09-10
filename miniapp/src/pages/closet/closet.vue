<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useWardrobeStore } from '@/stores/wardrobe'
import { apiGenerateOutfits, type WardrobeItem } from '@/api/wardrobe'
import { categoryLabel, seasonLabel } from '@/constants/wardrobe'
import { CLOSET_CATEGORIES } from '@/constants/ui'
import { iconForEmoji } from '@/utils/icons'
import { garmentToAccessoryContext, setAccessoryPageContext } from '@/utils/accessoryContext'
import { toast } from '@/utils/toast'
import { go } from '@/utils/nav'

const wardrobe = useWardrobeStore()
const activeCategory = ref('all')
const manage = ref(false)
/*
 * 左侧分类栏是否展开。默认展开。
 * 收起后 118rpx 的栏宽让给右侧衣物网格 —— 小屏上两列图会宽出一截。
 */
const railOpen = ref(true)
/** 收起状态下显示在把手上的当前分类名，否则看不出自己在哪一类 */
const activeCategoryLabel = computed(
  () => CLOSET_CATEGORIES.find((c) => c.key === activeCategory.value)?.label ?? '全部',
)
const generating = ref(false)
const sortOpen = ref(false)
const sortItems = ref<WardrobeItem[]>([])
const dragIndex = ref(-1)
const dragOffset = ref(0)
const dragStartY = ref(0)
/*
 * 拖拽排序的行间距。
 *
 * 这个常量必须等于 .sort-row 的「高度 + margin-bottom」，否则每拖过一行就
 * 累积一点误差，列表越长偏得越远。CSS 那边写死 height: 114rpx + margin-bottom: 12rpx，
 * 改一边记得改另一边。
 */
const ROW_PITCH_RPX = 126
const rowHeight = uni.upx2px(ROW_PITCH_RPX)

const filtered = computed(() =>
  activeCategory.value === 'all'
    ? wardrobe.items
    : wardrobe.items.filter((item) => item.category === activeCategory.value),
)

onMounted(async () => {
  await wardrobe.load()
})

function goUpload() {
  go('wardrobeUpload')
}

function goManual() {
  go('wardrobeMatch')
}

async function generateNow() {
  if (generating.value) return
  if (wardrobe.items.length < 2) {
    toast('先上传至少 2 件旧衣')
    return
  }
  generating.value = true
  try {
    const batch = await apiGenerateOutfits()
    go('outfitResult', { batchId: batch.id })
  } catch (error) {
    toast((error as Error).message || '生成失败')
  } finally {
    generating.value = false
  }
}

async function toggleFrequent(id: string) {
  try {
    await wardrobe.toggleFrequentlyWorn(id)
  } catch {
    toast('标记常穿失败')
  }
}

async function removeItem(id: string) {
  uni.showModal({
    title: '删除旧衣',
    content: '删除后会同时从搭配历史中移除，确定继续吗？',
    success: async (result) => {
      if (!result.confirm) return
      // store 的删除失败会抛（不再本地假删），这里必须接住，否则是未捕获 rejection
      try {
        await wardrobe.removeItem(id)
      } catch (error) {
        toast((error as Error)?.message || '删除失败')
        return
      }
      toast('已删除')
    },
  })
}

function openSort() {
  sortItems.value = [...wardrobe.items]
  dragIndex.value = -1
  dragOffset.value = 0
  sortOpen.value = true
}

function startDrag(event: TouchEvent, index: number) {
  dragIndex.value = index
  dragOffset.value = 0
  dragStartY.value = event.touches[0].clientY
}

function moveDrag(event: TouchEvent) {
  if (dragIndex.value < 0) return
  dragOffset.value = event.touches[0].clientY - dragStartY.value
}

function endDrag() {
  if (dragIndex.value < 0) return
  const offset = dragOffset.value
  const sourceIndex = dragIndex.value
  const target = Math.max(
    0,
    Math.min(sortItems.value.length - 1, Math.round((sourceIndex * rowHeight + offset) / rowHeight)),
  )
  if (target !== sourceIndex) {
    const next = [...sortItems.value]
    const [moved] = next.splice(sourceIndex, 1)
    next.splice(target, 0, moved)
    sortItems.value = next
  }
  dragIndex.value = -1
  dragOffset.value = 0
}

async function saveSort() {
  const ids = sortItems.value.map((item) => item.id)
  try {
    await wardrobe.reorder(ids)
    sortOpen.value = false
    toast('衣柜顺序已保存')
  } catch {
    toast('保存排序失败')
  }
}

/** 收藏的搭配和场景模板都在同一页（§8.11 §10.10），带上来源筛选过去 */
function goMyOutfits() {
  go('outfits', { source: 'wardrobe' })
}

function maskClose(event: any) {
  if (event.target === event.currentTarget) sortOpen.value = false
}

function goAccessory(item: WardrobeItem) {
  setAccessoryPageContext({
    source: 'garment',
    title: item.name,
    outfit: [garmentToAccessoryContext(item)],
  })
  go('accessory')
}
</script>

<template>
  <view class="page page-stage">
    <view class="topbar">
      <view>
        <view class="title">我的衣橱</view>
        <view class="subtitle">让衣柜里的旧衣服重新搭起来</view>
      </view>
      <view class="top-actions">
        <view class="icon-btn" :class="{ active: manage }" @tap="manage = !manage">
          {{ manage ? '完成' : '管理' }}
        </view>
        <view class="icon-btn add" @tap="goUpload">＋</view>
      </view>
    </view>

    <view class="seg">
      <view class="seg-item on">今日搭配</view>
      <!-- 「我的搭配」只有一页（§8.11 §10.10），这里跳过去而不是再维护一份列表 -->
      <view class="seg-item" @tap="goMyOutfits">我的搭配 ›</view>
    </view>

    <view class="today-panel">
      <view class="action-card">
        <view class="action-main">
          <view class="action-text">
            <view class="action-title">一键生成今日穿搭</view>
            <view class="action-sub">优先使用靠前和常穿的 30 件旧衣</view>
          </view>
          <view class="btn btn-primary action-btn" @tap="generateNow">
            {{ generating ? '生成中…' : '生成 3 套' }}
          </view>
        </view>
        <view class="manual-link" @tap="goManual">手动调整搭配 →</view>
      </view>

      <view v-if="manage" class="sort-row">
        <view class="sort-link" @tap="openSort">拖动排序</view>
      </view>

      <!--
        设计稿（开发手册 §4 图③）是「左侧竖排分类 + 右侧两列大图」，
        不是顶部横向 chips —— 分类有 10 项，横排永远看不全，还要左右滑。

        左栏可折叠：分类栏占掉 118rpx，在小屏上右侧两列衣物图会被压得很窄。
        收起后整个宽度让给衣物网格，中间那条竖把手负责再展开 ——
        收起状态下把手上显示当前分类名，否则用户看不出自己在哪一类。
      -->
      <view class="closet-body">
        <view v-if="railOpen" class="cat-rail">
          <view
            v-for="category in CLOSET_CATEGORIES"
            :key="category.key"
            class="cat"
            :class="{ on: activeCategory === category.key }"
            @tap="activeCategory = category.key"
          >
            <UiIcon
              :name="iconForEmoji(category.emoji) ?? 'grid'"
              :size="28"
              :tone="activeCategory === category.key ? 'brand' : 'muted'"
            />
            <text class="cat-label">{{ category.label }}</text>
          </view>
        </view>

        <view
          class="rail-toggle"
          :class="{ closed: !railOpen }"
          :aria-label="railOpen ? '收起分类栏' : '展开分类栏'"
          @tap="railOpen = !railOpen"
        >
          <UiIcon :name="railOpen ? 'chevron-left' : 'chevron-right'" :size="26" tone="muted" />
          <text v-if="!railOpen" class="rail-toggle-label">{{ activeCategoryLabel }}</text>
        </view>

        <scroll-view scroll-y class="grid-scroll hide-scrollbar">
          <view v-if="filtered.length" class="grid">
            <view v-for="item in filtered" :key="item.id" class="cell">
              <TileImage
                :src="item.img"
                :from="item.primaryColor || item.from"
                :to="item.secondaryColors?.[0] || item.to"
                :emoji="item.emoji"
                ratio="3 / 4"
                rounded="24rpx"
              />
              <view v-if="item.frequentlyWorn" class="frequent-badge">常穿</view>
              <view v-if="item.recognitionStatus === 'suggested'" class="suggested-badge">待确认</view>
              <view class="accessory-entry" @tap="goAccessory(item)">配饰</view>
              <view class="cell-name">{{ item.name }}</view>
              <view class="cell-meta">{{ categoryLabel(item.category) }} · {{ seasonLabel(item.seasons?.[0]) }}</view>
              <view v-if="manage" class="cell-controls">
                <view class="cell-control" @tap="toggleFrequent(item.id)">
                  {{ item.frequentlyWorn ? '取消常穿' : '设为常穿' }}
                </view>
                <view class="cell-control danger" @tap="removeItem(item.id)">删除</view>
              </view>
            </view>
          </view>
          <view v-else-if="wardrobe.loadError" class="empty">
            <UiIcon class="empty-emoji" name="warn" :size="88" tone="muted" :stroke-width="1.3" />
            <view class="empty-title">衣橱加载失败</view>
            <view class="empty-sub">{{ wardrobe.loadError }}</view>
            <view class="btn btn-primary empty-btn" @tap="wardrobe.load()">重新加载</view>
          </view>
          <view v-else class="empty">
            <UiIcon class="empty-emoji" name="box" :size="88" tone="muted" :stroke-width="1.3" />
            <view class="empty-title">衣橱还是空的</view>
            <view class="empty-sub">先上传几张真实旧衣照片</view>
            <view class="btn btn-primary empty-btn" @tap="goUpload">上传旧衣</view>
          </view>
        </scroll-view>
      </view>
    </view>

    <BottomNav active="closet" />

    <view v-if="sortOpen" class="mask" @tap="maskClose">
      <view class="sort-sheet" @tap.stop>
        <view class="sheet-title">拖动排序</view>
        <view class="sheet-sub">拖动单品行调整优先级，点击保存后生效</view>
        <scroll-view scroll-y class="sort-list">
          <view
            v-for="(item, index) in sortItems"
            :key="item.id"
            class="sort-row"
            :class="{ dragging: dragIndex === index }"
            :style="{ transform: dragIndex === index ? `translateY(${dragOffset}px)` : 'none' }"
            @touchstart="startDrag($event, index)"
            @touchmove="moveDrag"
            @touchend="endDrag"
          >
            <view class="drag-handle">≡</view>
            <TileImage
              class="sort-thumb"
              :src="item.img"
              :emoji="item.emoji"
              :from="item.primaryColor || item.from"
              :to="item.secondaryColors?.[0] || item.to"
              ratio="1 / 1"
              rounded="16rpx"
            />
            <view class="sort-info">
              <view class="sort-name">{{ item.name }}</view>
              <view class="sort-meta">{{ categoryLabel(item.category) }}</view>
            </view>
            <view class="sort-index">{{ index + 1 }}</view>
          </view>
        </scroll-view>
        <view class="btn btn-primary sort-save" @tap="saveSort">保存排序</view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.topbar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top, 0px) + 24rpx) 32rpx 14rpx;
}

.title {
  font-size: 44rpx;
  font-weight: 500;
  color: var(--text-1);
}

.subtitle {
  margin-top: 4rpx;
  font-size: var(--fs-sm);
  color: var(--text-3);
}

.top-actions {
  display: flex;
  gap: 16rpx;
  align-items: center;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 64rpx;
  padding: 0 24rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.icon-btn.active {
  color: var(--pink-deep);
}

.icon-btn.add {
  width: 64rpx;
  padding: 0;
  font-size: 40rpx;
  color: #fff;
  background: var(--brand-gradient);
}

.seg {
  display: flex;
  flex-shrink: 0;
  gap: 10rpx;
  padding: 8rpx;
  margin: 4rpx 32rpx 18rpx;
  background: rgb(255 255 255 / 65%);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.seg-item {
  flex: 1;
  padding: 15rpx 10rpx;
  font-size: var(--fs-md);
  font-weight: 700;
  color: var(--text-2);
  text-align: center;
  border-radius: var(--radius-pill);
}

.seg-item.on {
  color: #fff;
  background: var(--brand-gradient);
  box-shadow: var(--shadow-float);
}

/*
 * 钉死一屏高度 —— 只在本页覆盖全局的 .page-stage。
 *
 * 根因：全局 base.css 里 `page` 只写了 min-height:100%、没有 height，所以
 * .page 的 height:100% 解析不出确定值、退化成 auto，内容一多页面就被顶长。
 * 于是 .closet-body 被右侧网格撑高，而分类栏是 absolute + bottom:0，跟着一起
 * 变高 —— 整页滚动时它就跟着右侧衣物走了。点「全部」时衣物最多，所以那时最明显。
 *
 * 不去动全局的 `page`：有 15 个页面（home / me / test 等）没有内部 scroll-view、
 * 靠整页滚动，给 page 钉死高度会把它们超出一屏的内容裁掉。这一类 page-stage
 * 页面本来就是「内部滚动」结构（全局那条 overflow:hidden 就是证据），钉高度才对。
 *
 * 用 100vh 而不是 100%：100% 依赖父链，而断点正在父链上。
 *
 * 再减掉 BottomNav 的高度（uv-tabbar 固定 50px + 安全区，fixed 不占文档流），
 * 让内容区的底边正好落在 tab 栏的上边缘。这样 .closet-body 的底边也在那里，
 * 分类栏 absolute + bottom:0 就直接顶到 tab，中间不留空隙；右侧网格同时也
 * 正好滚到 tab 上沿，最后一行不会被压住。
 *
 * 减的是 50px 而不是 100rpx：tabbar 的 50px 是 CSS 像素、固定值，而 rpx 按
 * 屏宽换算（750rpx = 屏宽），只在 375 宽的屏上两者恰好相等，宽屏上会多留一截。
 */
.page-stage {
  height: calc(100vh - env(safe-area-inset-bottom, 0px) - 50px);
}

.today-panel {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
}

.action-card {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 14rpx;
  padding: 26rpx;
  margin: 0 32rpx 18rpx;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
}

/*
 * 「手动调整搭配」原本是 position:absolute + bottom 定位，卡片高度由上面的
 * 标题/副标题撑开，两者必然叠在一起。改成正常的纵向流式布局。
 */
.action-main {
  display: flex;
  gap: 20rpx;
  align-items: center;
}

.action-text {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: var(--fs-xl);
  font-weight: 500;
}

.action-sub {
  margin-top: 8rpx;
  font-size: var(--fs-xs);
  line-height: 1.4;
  opacity: 0.9;
}

.action-btn {
  flex-shrink: 0;
  height: 76rpx;
  padding: 0 22rpx;
  font-size: var(--fs-base);
  color: var(--purple-deep);
  background: rgb(255 255 255 / 95%);
  box-shadow: 0 10rpx 20rpx rgb(80 45 120 / 24%);
}

.manual-link {
  font-size: var(--fs-xs);
  font-weight: 700;
  opacity: 0.9;
}

.sort-row {
  display: flex;
  flex-shrink: 0;
  justify-content: flex-end;
  padding: 0 32rpx 12rpx;
}

.sort-link {
  font-size: var(--fs-sm);
  font-weight: 700;
  color: var(--purple-deep);
}

/* 左栏 + 右网格 */

/*
 * 分类栏是**浮层抽屉**（概念稿图①）：绝对定位、更高层级、阴影投在右侧内容上，
 * 而不是和内容平级的 Flex 列。
 *
 * position:relative 是给 .cat-rail 当定位父级用的，别删。
 * --rail-w / --rail-x 定在这里而不是把数字写两遍：抽屉宽度要和把手的左偏移同值、
 * 抽屉的 left 要和容器左内边距同值，分开写下次调一定会漏一个。
 */
.closet-body {
  --rail-w: 118rpx;
  --rail-x: 12rpx;

  position: relative;
  display: flex;
  flex: 1;
  gap: 12rpx;
  min-height: 0;
  padding: 0 24rpx 0 var(--rail-x);
}

/*
 * 抽屉本体。
 *
 * z-index 走 --z-float(10) 而不是随手写个数：衣橱是 tabBar 主页面，
 * 底部导航是 --z-sticky(20)，抽屉必须低于它，否则滚到底时抽屉会盖住导航栏。
 *
 * 绝对定位顺带修掉一个原有的别扭处：原来抽屉是 Flex 列里的 scroll-view，
 * 和右侧网格各滚各的但**共享横向空间**；现在它脱离流，右侧网格滚动时它稳稳不动。
 *
 * 保持 v-if 卸载（不是把宽度动画到 0）—— 上面模板里的注释解释了原因：
 * 小程序的 scroll-view 在宽度变化时不重算内部滚动容器，动画收起会留下
 * 一片能滚但看不见的区域。改成浮层不改变这个约束。
 *
 * 本体是普通 view 而不是 scroll-view：十个分类得「一眼看全」。之前用
 * scroll-view，closet-body 的可用高度装不下十项（每项约 98rpx，合计 980rpx，
 * 上面还压着 topbar / SegTabs / 生成搭配面板），于是栏内自己滚 ——
 * 滑到「配饰」时「全部」「上衣」就滑出视野了，和固定菜单的预期相反。
 * 现在改成 flex 列 + 子项 flex:1 均分高度，多少项都是一屏。
 */
.cat-rail {
  position: absolute;
  top: 0;
  bottom: 0;

  /*
   * left 要显式写 var(--rail-x)，不能靠父级的 padding。
   * 绝对定位元素的包含块是定位父级的 **padding box**，所以 left:0 会落在
   * padding 的外边缘 —— 抽屉会贴死屏幕左边缘、左侧圆角被切在边上，
   * 和上面 Banner / SegTabs 的留白对不齐。
   */
  left: var(--rail-x);
  z-index: var(--z-float);
  display: flex;
  flex-direction: column;
  width: var(--rail-w);
  padding: 6rpx;

  /* 极端矮屏（或以后分类加更多）时宁可裁掉一点，也不要退回内部滚动 */
  overflow: hidden;
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-float);
}

/*
 * 分类栏的折叠把手。始终可见的一条竖窄条 ——
 * 用 v-if 卸载分类栏（而不是把宽度动画到 0）：小程序的 scroll-view 在
 * 宽度变化时不会重算内部滚动容器，动画收起会留下一片能滚但看不见的区域。
 *
 * 把手**留在 Flex 流里**、不跟着抽屉浮起来：它是"抽屉在哪、怎么开合"的唯一线索，
 * 浮层化之后反而会压住内容。抽屉展开时靠 margin-left 把它推到抽屉右边。
 */
.rail-toggle {
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8rpx;
  align-items: center;
  justify-content: center;
  width: 32rpx;
  margin-left: var(--rail-w);
  background: var(--surface);
  border: var(--hairline);
  border-radius: var(--radius-sm);
}

/* 收起时把手加宽一点，好点，也放得下分类名；抽屉没了就不用再让位 */
.rail-toggle.closed {
  width: 44rpx;
  margin-left: 0;
}

.rail-toggle-label {
  font-size: var(--fs-xs);
  color: var(--text-3);
  letter-spacing: 2rpx;

  /* 竖排文字：分类名最多 3 个字，竖着写正好塞进 44rpx 宽 */
  writing-mode: vertical-rl;
}

.cat {
  display: flex;

  /* 均分 .cat-rail 的高度：十项一屏排满，不出现内部滚动 */
  flex: 1;
  flex-direction: column;
  gap: 4rpx;
  align-items: center;
  justify-content: center;
  min-height: 56rpx;
  padding: 6rpx 0;

  /*
   * 概念稿图①的选中态是「带圆角的浅色高亮块」（Highlight Capsule）。
   * 6rpx(--radius-sm) 太方，看着像被选中的表格单元格，不像一个高亮胶囊。
   * 提到 16rpx(--radius-lg) —— 不用 --radius-pill：那是 9999rpx，
   * 在 118rpx 宽 × 约 80rpx 高的格子上会圆成一坨药丸，把图标和文字挤在中间。
   * 也不自造 20rpx 之类的中间值，圆角必须留在 tokens 那四档里。
   */
  border-radius: var(--radius-lg);
  transition: background 0.15s ease;
}

.cat.on {
  background: var(--pink-soft);
}

.cat-label {
  font-size: var(--fs-xs);
  font-weight: 500;
  color: var(--text-3);
}

.cat.on .cat-label {
  font-weight: 700;
  color: var(--pink-deep);
}

/*
 * 这里原来有两条 .grid-scroll，padding 一条 `0 0 28rpx`、一条 `0 32rpx 28rpx`，
 * 后者覆盖前者 —— 等于第一条从来没生效。合成一条，取实际生效的值。
 * 左侧已有分类栏和把手，网格自己不需要再留 32rpx 左边距，收窄到 16rpx。
 */
.grid-scroll {
  flex: 1;
  min-width: 0;
  height: 100%;
  min-height: 0;
  padding: 0 0 28rpx 16rpx;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.cell {
  position: relative;
  padding: 12rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.frequent-badge,
.suggested-badge {
  position: absolute;
  top: 22rpx;
  left: 22rpx;
  z-index: 3;
  padding: 6rpx 14rpx;
  font-size: var(--fs-2xs);
  font-weight: 500;
  background: rgb(255 255 255 / 88%);
  border-radius: var(--radius-pill);
}

.frequent-badge {
  color: var(--success);
}

.suggested-badge {
  top: 64rpx;
  color: #5f78a8;
}

.accessory-entry {
  position: absolute;
  top: 22rpx;
  right: 22rpx;
  z-index: 4;
  padding: 7rpx 14rpx;
  font-size: var(--fs-2xs);
  font-weight: 500;
  color: var(--purple-deep);
  background: rgb(255 255 255 / 90%);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-card);
}

.cell-name {
  margin: 14rpx 4rpx 2rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.cell-meta {
  margin: 4rpx 4rpx 10rpx;
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.cell-controls {
  display: flex;
  gap: 8rpx;
  margin-top: 4rpx;
}

.cell-control {
  flex: 1;
  padding: 10rpx 4rpx;
  font-size: var(--fs-xs);
  font-weight: 700;
  color: var(--text-2);
  text-align: center;
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.cell-control.danger {
  color: #d04c5b;
}

.empty {
  gap: 12rpx;
  padding-top: 140rpx;
  color: var(--text-3);
}

.empty-emoji {
  font-size: 88rpx;
}

.empty-title {
  font-weight: 700;
  color: var(--text-1);
}

.empty-sub {
  font-size: var(--fs-sm);
}

.empty-btn {
  height: 82rpx;
  padding: 0 40rpx;
  margin-top: 16rpx;
  font-size: var(--fs-md);
}

.sort-sheet {
  width: 100%;
  max-height: 82vh;
  padding: 30rpx 30rpx calc(30rpx + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-radius: var(--radius-lg) 44rpx 0 0;
  box-shadow: 0 -8rpx 24rpx rgb(0 0 0 / 10%);
}

.sheet-sub {
  margin-top: 8rpx;
  font-size: var(--fs-sm);
  color: var(--text-3);
}

.sort-list {
  max-height: 60vh;
  margin-top: 24rpx;
}

.sort-row {
  display: flex;
  gap: 14rpx;
  align-items: center;

  /* 高度 + margin-bottom 必须等于 closet.vue 里的 ROW_PITCH_RPX(126)，见那里的注释 */
  height: 114rpx;
  padding: 10rpx 14rpx;
  margin-bottom: 12rpx;
  background: var(--surface-tint);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
  transition:
    transform 0.12s ease,
    opacity 0.12s ease;
}

.sort-row.dragging {
  z-index: 5;
  background: #fff;
  opacity: 0.86;
}

.drag-handle {
  width: 40rpx;
  font-size: 42rpx;
  color: var(--text-3);
  text-align: center;
}

.sort-thumb {
  flex-shrink: 0;
  width: 76rpx;
}

.sort-info {
  flex: 1;
  min-width: 0;
}

.sort-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--fs-base);
  font-weight: 700;
  color: var(--text-1);
  white-space: nowrap;
}

.sort-meta {
  margin-top: 5rpx;
  font-size: var(--fs-xs);
  color: var(--text-3);
}

.sort-index {
  flex-shrink: 0;
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--purple-deep);
}

.sort-save {
  margin-top: 24rpx;
}
</style>
