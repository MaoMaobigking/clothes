/**
 * 瀑布流布局计算 —— 纯函数，不碰 DOM、不认识 Vue。
 *
 * 为什么单独抽出来：
 * 1. 布局是「一堆数字算另一堆数字」，本质上和渲染无关。抽开之后不用挂载组件、
 *    不用 happy-dom 就能测，跑一次是毫秒级。
 * 2. 虚拟滚动的可视区间计算需要「所有项的最终位置」，而位置又依赖布局结果 ——
 *    两件事必须共用同一份计算，放一起才不会算出两套坐标。
 *
 * 为什么不用 CSS `columns` 做瀑布流：
 *   `columns` 是**竖向填充** —— 它先把第 1 列填满再填第 2 列，所以视觉上
 *   第 1 项和第 2 项不相邻（第 2 项在第 1 项正下方）。而瀑布流要的是
 *   「按顺序横向铺、哪列矮放哪列」。顺序语义完全不同，CSS 那条路走不通。
 */

/** 布局的输入：只需要宽高比，不需要真实像素尺寸 */
export interface MasonryItem {
  /** 稳定标识，用于渲染时的 key 与跨页去重 */
  id: string | number
  /**
   * 宽高比 = 宽 / 高。**由服务端下发，不在前端测量。**
   *
   * 这是零 CLS 的关键：图片还没加载完就能算出它将来占多高，
   * 布局一次到位，不会出现「图片加载完把下面的内容顶下去」。
   * 前端测量的话必须等图片 onload，那时候布局已经抖过一次了。
   */
  aspectRatio: number
}

/** 布局的输出：每项在容器里的绝对坐标与尺寸 */
export interface PositionedItem<T extends MasonryItem = MasonryItem> {
  item: T
  x: number
  y: number
  width: number
  height: number
  column: number
}

export interface MasonryLayout<T extends MasonryItem = MasonryItem> {
  positions: PositionedItem<T>[]
  /** 容器总高 = 最高那一列的高度 */
  totalHeight: number
  /** 每列最终高度，调试和续算下一页时用得上 */
  columnHeights: number[]
  /**
   * 按列分桶的**索引表**：`columns[c]` 是第 c 列所有项在 `positions` 里的下标，
   * 按 y 从小到大排列（也就是插入顺序）。
   *
   * ⚠️ 这是虚拟滚动能成立的前提。绕的这个弯值得说清楚：
   *
   *   `positions` 的 **y 其实是非降的** —— 每次都放进最矮的列，而「最矮列的高度」
   *   只会涨不会跌（被加高的那列原本就是最小值，加完之后所有列都 ≥ 原最小值）。
   *
   *   但可见性判定用的不是 y，是**底边 `y + height`**：一个项只要底边还在视口顶
   *   下方就得渲染（它有一半看得见）。而 height 任意，所以底边序列**不单调** ——
   *   早放的高图底边 200，后放的矮图底边可能才 50。二分的前提在这里断掉。
   *
   *   **同一列内部**才有 `y[k+1] = y[k] + h[k] + gap`，底边严格递增，能二分。
   *
   * 为什么在布局时就建好、而不是查询时再分桶：
   * 查询是每次滚动都要跑的（60fps），分桶是 O(n)。每帧分一次桶 = 每帧 O(n)，
   * 那二分就白做了。**建一次索引、查很多次** —— 这是虚拟滚动的本质。
   */
  columns: number[][]
}

export interface MasonryOptions {
  /** 容器可用宽度（px） */
  containerWidth: number
  /** 列数，至少 1 */
  columnCount: number
  /** 列间距与行间距（px） */
  gap?: number
}

/** 找最矮的那一列。并列时取下标最小的，保证同样输入永远得到同样布局（可测） */
function shortestColumn(heights: number[]): number {
  let best = 0
  for (let i = 1; i < heights.length; i++) {
    if (heights[i] < heights[best]) best = i
  }
  return best
}

/**
 * 列平衡瀑布流：**最短列优先**贪心。
 *
 * 每来一项就放进当前最矮的那一列。这是个贪心策略，不保证列高绝对最优
 * （那是 NP-hard 的多路数划分问题），但 O(n·列数) 一趟算完，
 * 实际视觉效果足够齐 —— 这个取舍要能讲清楚。
 *
 * @example
 * layoutMasonry(
 *   [{ id: 1, aspectRatio: 1 }, { id: 2, aspectRatio: 0.5 }],
 *   { containerWidth: 200, columnCount: 2, gap: 0 },
 * )
 * // 两项分别落在第 0、1 列，各占宽 100
 */
export function layoutMasonry<T extends MasonryItem>(
  items: readonly T[],
  { containerWidth, columnCount, gap = 0 }: MasonryOptions,
): MasonryLayout<T> {
  const cols = Math.max(1, Math.floor(columnCount))

  // 宽度按「总宽减掉列间距，再均分」算。列间距有 cols-1 个，不是 cols 个。
  const columnWidth = (containerWidth - gap * (cols - 1)) / cols
  const columnHeights = new Array<number>(cols).fill(0)
  const positions: PositionedItem<T>[] = []
  const columns: number[][] = Array.from({ length: cols }, () => [])

  for (const item of items) {
    const c = shortestColumn(columnHeights)

    // aspectRatio = 宽/高，所以 高 = 宽/aspectRatio。
    // 兜住脏数据：非正数或非有限值会算出 Infinity/NaN，一个坏数据能毁掉整个布局，
    // 所以退化成正方形而不是让 NaN 往下传染。
    const ratio = Number.isFinite(item.aspectRatio) && item.aspectRatio > 0 ? item.aspectRatio : 1
    const height = columnWidth / ratio

    // 先记下标再 push —— 此刻 positions.length 正好是这一项即将占据的位置。
    // 写反了整个索引表就全错位，而类型检查抓不到（空桶也是合法的 number[][]）。
    columns[c].push(positions.length)
    positions.push({
      item,
      x: c * (columnWidth + gap),
      y: columnHeights[c],
      width: columnWidth,
      height,
      column: c,
    })

    columnHeights[c] += height + gap
  }

  // 每列末尾都多加了一个 gap，算总高时要减掉（空列除外）
  const totalHeight = Math.max(0, ...columnHeights.map((h) => (h > 0 ? h - gap : 0)))

  return { positions, totalHeight, columnHeights, columns }
}

export interface VisibleRangeOptions {
  scrollTop: number
  viewportHeight: number
  overscan?: number
}

function firstBelow<T extends MasonryItem>(
  positions: readonly PositionedItem<T>[],
  bucket: readonly number[],
  top: number,
): number {
  let lo = 0
  let hi = bucket.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    const p = positions[bucket[mid]]
    if (p.y + p.height > top) hi = mid
    else lo = mid + 1
  }
  return lo
}

/**
 * 取当前视口内该渲染的项。
 *
 * 复杂度 O(列数 × (log n_col + k))，k 是实际可见数量。
 * 对比朴素遍历的 O(n)：n=10000、3 列、可见 30 项时，
 * 从每帧 10000 次判断降到约 3×(12+10)=66 次。
 *
 * 返回值按 `positions` 的原始顺序排列（不是按列分组）——
 * 保持顺序稳定，Vue 用 key 做 diff 时不会产生多余的节点移动。
 */
export function getVisibleItems<T extends MasonryItem>(
  layout: MasonryLayout<T>,
  { scrollTop, viewportHeight, overscan = 0 }: VisibleRangeOptions,
): PositionedItem<T>[] {
  const { positions, columns } = layout
  if (positions.length === 0) return []

  // 预渲染余量：上下各扩 overscan 屏。上边界不用夹到 0 ——
  // 负的 top 只会让二分返回 0，行为正确（下拉回弹时 scrollTop 可能是负数）
  const pad = viewportHeight * Math.max(0, overscan)
  const top = scrollTop - pad
  const bottom = scrollTop + viewportHeight + pad

  const picked: number[] = []

  for (const bucket of columns) {
    // 二分定位这一列的第一个可见项
    let i = firstBelow(positions, bucket, top)
    // 之后顺序扫，直到某项的顶边已经掉出视口下沿。
    // 因为同列 y 递增，一旦 y >= bottom，后面的只会更靠下，可以直接停
    for (; i < bucket.length; i++) {
      const idx = bucket[i]
      if (positions[idx].y >= bottom) break
      picked.push(idx)
    }
  }

  // 回到原始插入顺序。picked 长度是「可见项数」量级（几十），排序开销可忽略
  picked.sort((a, b) => a - b)
  return picked.map((idx) => positions[idx])
}
