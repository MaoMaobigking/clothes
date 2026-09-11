<script setup lang="ts">
/*
 * 瀑布流 + 虚拟滚动列表。
 *
 * 分层：**这一层不做任何布局计算**，只负责三件事 ——
 *   ① 量容器宽度  ② 拿 scrollTop  ③ 把纯函数算出的结果渲染出来
 * 列平衡与可视区间计算全在 @/utils/masonry.ts（纯函数，有 27 个测试）。
 * 这么切的理由：布局是「一堆数字算另一堆数字」，和渲染无关；
 * 抽开之后不用挂载组件就能测，也不会出现「组件里一套坐标、别处另一套」。
 *
 * ⚠️ 本文件不写任何显式组件 import —— 组件一律靠 easycom 注册。
 * 混用显式 import 和 easycom 会让编译产物里的路径 marker 生成错误，
 * 微信开发者工具解析依赖图失败 → 剔文件 → 全站白屏。
 * 详见 components/TileImage/TileImage.vue 顶部的完整记录。
 */
import { computed, onMounted, onUnmounted, ref, watch, getCurrentInstance } from 'vue'
import { getVisibleItems, layoutMasonry, type MasonryItem, type PositionedItem } from '@/utils/masonry'

const props = withDefaults(
  defineProps<{
    /** 数据源。每项必须有 id 与 aspectRatio（宽/高，由服务端下发） */
    items: MasonryItem[]
    /** 列数。默认 2 —— 移动端两列是瀑布流的常规密度 */
    columnCount?: number
    /** 列间距与行间距（px） */
    gap?: number
    /** 视口上下各多渲染几屏，防止快速滚动露白 */
    overscan?: number
    /** 距底部多少 px 时触发 loadMore */
    lowerThreshold?: number
    /** 是否还有下一页。false 时不再触发 loadMore */
    hasMore?: boolean
    /** 正在加载中，用于去重触发 */
    loading?: boolean
  }>(),
  {
    columnCount: 2,
    gap: 12,
    overscan: 0.5,
    lowerThreshold: 200,
    hasMore: false,
    loading: false,
  },
)

const emit = defineEmits<{ (e: 'loadMore'): void }>()

/* ============ ① 量容器宽度 ============ */

const containerWidth = ref(0)
const instance = getCurrentInstance()

/*
 * 小程序没有 DOM，量不了 offsetWidth，只能用 createSelectorQuery —— 而它是**异步**的。
 * 所以首帧 containerWidth 是 0，布局要等测量回来才有结果（下面 layout 里对 0 做了短路）。
 *
 * 不用 ResizeObserver 的原因：小程序端根本没有这个 API，两端各写一套就得维护两份逻辑。
 */
function measure() {
  uni
    .createSelectorQuery()
    .in(instance?.proxy)
    .select('.masonry-scroll')
    .boundingClientRect((rect) => {
      const width = (rect as UniApp.NodeInfo | null)?.width
      if (typeof width === 'number' && width > 0) containerWidth.value = width
    })
    .exec()
}

/* ============ ② 拿 scrollTop ============ */

const scrollTop = ref(0)
const viewportHeight = ref(0)

/*
 * 滚动事件在两端都是高频触发（可以一帧多次）。用 rAF 合并成「一帧最多算一次」。
 *
 * 存 pending 而不是直接节流固定毫秒：rAF 天然和渲染帧对齐，
 * 不会出现「算完了但这一帧不渲染」的浪费，也不会像 setTimeout 那样在后台标签页空转。
 */
let rafId = 0
let pendingTop = 0

function onScroll(e: { detail: { scrollTop: number } }) {
  pendingTop = e.detail.scrollTop
  if (rafId) return
  rafId = requestAnimationFrame(() => {
    rafId = 0
    scrollTop.value = pendingTop
  })
}

/* ============ ③ 调纯函数 ============ */

const layout = computed(() => {
  // 宽度还没量到（首帧）就先不算，避免用 0 宽算出一堆 Infinity
  if (containerWidth.value <= 0) {
    return { positions: [], totalHeight: 0, columnHeights: [], columns: [] }
  }
  return layoutMasonry(props.items, {
    containerWidth: containerWidth.value,
    columnCount: props.columnCount,
    gap: props.gap,
  })
})

const visible = computed<PositionedItem[]>(() =>
  getVisibleItems(layout.value, {
    scrollTop: scrollTop.value,
    viewportHeight: viewportHeight.value,
    overscan: props.overscan,
  }),
)

/* ============ ④ 触底加载 ============ */

/*
 * 用 scroll-view 自带的 @scrolltolower 而不是自己算距离：
 * 两端的实现都在原生层，比 JS 里比较 scrollTop + height 准，也不受 rAF 合并影响。
 * hasMore / loading 双重判断防止一次触底连发多次请求。
 */
function onReachBottom() {
  if (!props.hasMore || props.loading) return
  emit('loadMore')
}

/* ============ 生命周期 ============ */

onMounted(() => {
  const info = uni.getSystemInfoSync()
  viewportHeight.value = info.windowHeight
  // 挂载后下一帧再量，等布局稳定
  setTimeout(measure, 0)
})

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
})

// 列数变化（比如横竖屏切换）要重新量宽度
watch(() => props.columnCount, measure)

defineExpose({
  /** 供父组件在数据整批替换后重置滚动位置 */
  scrollToTop() {
    scrollTop.value = 0
  },
})
</script>

<template>
  <scroll-view
    class="masonry-scroll"
    scroll-y
    :lower-threshold="lowerThreshold"
    :scroll-top="scrollTop"
    @scroll="onScroll"
    @scrolltolower="onReachBottom"
  >
    <!--
      撑高容器用的占位层：高度是全部项的总高，而不是已渲染项的高度。
      没有它的话滚动条长度会随渲染项数量跳变 —— 这是虚拟滚动最典型的穿帮点。
    -->
    <view class="masonry-canvas" :style="{ height: layout.totalHeight + 'px' }">
      <view
        v-for="pos in visible"
        :key="pos.item.id"
        class="masonry-cell"
        :style="{
          transform: `translate(${pos.x}px, ${pos.y}px)`,
          width: pos.width + 'px',
          height: pos.height + 'px',
        }"
      >
        <!-- 渲染什么完全由调用方决定，本组件只管放在哪 -->
        <slot :item="pos.item" :width="pos.width" :height="pos.height" />
      </view>
    </view>

    <view v-if="loading" class="masonry-tip">加载中…</view>
    <view v-else-if="!hasMore && items.length > 0" class="masonry-tip">没有更多了</view>
  </scroll-view>
</template>

<style scoped>
.masonry-scroll {
  width: 100%;
  height: 100%;
}

.masonry-canvas {
  position: relative;
  width: 100%;
}

/*
 * 用 transform 定位而不是 top/left：
 * transform 只触发合成（composite），不触发重排（reflow）和重绘（repaint），
 * 滚动时每帧都在改位置，这个差别直接决定掉不掉帧。
 */
.masonry-cell {
  position: absolute;
  top: 0;
  left: 0;
  will-change: transform;
}

.masonry-tip {
  padding: 24rpx 0;
  font-size: 24rpx;
  color: #999;
  text-align: center;
}
</style>
