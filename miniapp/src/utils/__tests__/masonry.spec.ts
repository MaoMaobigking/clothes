import { describe, expect, it } from 'vitest'
import { getVisibleItems, layoutMasonry, type MasonryItem } from '../masonry'

/** 造一批指定宽高比的项，id 从 1 开始 */
function items(...ratios: number[]): MasonryItem[] {
  return ratios.map((aspectRatio, i) => ({ id: i + 1, aspectRatio }))
}

describe('layoutMasonry · 列宽计算', () => {
  it('列间距占 cols-1 份，不是 cols 份', () => {
    // 300 宽 3 列 gap 10 → 可用 300-20=280，每列 280/3
    const { positions } = layoutMasonry(items(1), { containerWidth: 300, columnCount: 3, gap: 10 })
    expect(positions[0].width).toBeCloseTo(280 / 3)
  })

  it('gap 为 0 时列宽正好均分', () => {
    const { positions } = layoutMasonry(items(1), { containerWidth: 300, columnCount: 3 })
    expect(positions[0].width).toBe(100)
  })

  it('列数至少为 1，传 0 或负数不会除零', () => {
    const { positions } = layoutMasonry(items(1), { containerWidth: 200, columnCount: 0 })
    expect(positions[0].width).toBe(200)
    expect(positions[0].x).toBe(0)
  })
})

describe('layoutMasonry · 最短列优先', () => {
  it('前 N 项按顺序铺满 N 列（此时各列都是 0，取下标最小的）', () => {
    const { positions } = layoutMasonry(items(1, 1, 1), { containerWidth: 300, columnCount: 3 })
    expect(positions.map((p) => p.x)).toEqual([0, 100, 200])
    expect(positions.map((p) => p.y)).toEqual([0, 0, 0])
  })

  it('第 4 项落到最矮的那一列，而不是回到第 0 列', () => {
    // 三项高度：100/1=100、100/2=50、100/0.5=200 → 列高 [100, 50, 200]
    // 最矮是第 1 列
    const { positions } = layoutMasonry(items(1, 2, 0.5, 1), { containerWidth: 300, columnCount: 3 })
    expect(positions[3].x).toBe(100) // 第 1 列
    expect(positions[3].y).toBe(50) // 接在那一列的 50 之后
  })

  it('并列最矮时取下标最小的列（保证同输入同输出，布局可复现）', () => {
    const a = layoutMasonry(items(1, 1, 1, 1), { containerWidth: 200, columnCount: 2 })
    const b = layoutMasonry(items(1, 1, 1, 1), { containerWidth: 200, columnCount: 2 })
    expect(a.positions.map((p) => p.x)).toEqual(b.positions.map((p) => p.x))
    expect(a.positions.map((p) => p.x)).toEqual([0, 100, 0, 100])
  })
})

describe('layoutMasonry · 高度换算', () => {
  it('高度 = 列宽 / 宽高比', () => {
    const { positions } = layoutMasonry(items(2, 0.5), { containerWidth: 200, columnCount: 2 })
    expect(positions[0].height).toBe(50) // 100 / 2
    expect(positions[1].height).toBe(200) // 100 / 0.5
  })

  it('总高取最高列，且不含末尾多余的 gap', () => {
    // 2 列 gap 10，两项各高 100 → 各列 100+10，减掉末尾 gap = 100
    const { totalHeight } = layoutMasonry(items(1, 1), { containerWidth: 210, columnCount: 2, gap: 10 })
    expect(totalHeight).toBe(100)
  })

  it('空列表时总高为 0，不是 -gap', () => {
    const { totalHeight, positions } = layoutMasonry([], { containerWidth: 300, columnCount: 3, gap: 10 })
    expect(totalHeight).toBe(0)
    expect(positions).toEqual([])
  })
})

describe('layoutMasonry · 脏数据不能毁掉整个布局', () => {
  it.each([
    ['0', 0],
    ['负数', -1],
    ['NaN', NaN],
    ['Infinity', Infinity],
  ])('宽高比是 %s 时退化成正方形，不产出 NaN/Infinity', (_label, ratio) => {
    const { positions, totalHeight } = layoutMasonry(items(ratio), { containerWidth: 200, columnCount: 2 })
    expect(positions[0].height).toBe(100) // 退化成 1:1
    expect(Number.isFinite(totalHeight)).toBe(true)
  })

  it('一条脏数据不会污染后面的项', () => {
    const { positions } = layoutMasonry(items(1, NaN, 1), { containerWidth: 200, columnCount: 2 })
    expect(positions.every((p) => Number.isFinite(p.y) && Number.isFinite(p.height))).toBe(true)
  })
})

describe('layoutMasonry · 列索引', () => {
  it('columns 记录每列的 positions 下标，按 y 递增', () => {
    const layout = layoutMasonry(items(1, 1, 1, 1, 1, 1), { containerWidth: 300, columnCount: 3 })
    expect(layout.columns).toEqual([
      [0, 3],
      [1, 4],
      [2, 5],
    ])
    for (const bucket of layout.columns) {
      const ys = bucket.map((i) => layout.positions[i].y)
      expect(ys).toEqual([...ys].sort((a, b) => a - b))
    }
  })

  it('y 沿插入顺序非降，但底边 y+height 不单调 —— 所以不能直接对 positions 二分', () => {
    // 2 列各 100 宽。第 1 项 h=200（底边 200），第 2 项 h=50（底边 50）→ 底边掉头
    const { positions } = layoutMasonry(items(0.5, 2, 2, 2), { containerWidth: 200, columnCount: 2 })

    // y 非降：每次都放进最矮的列，而「最矮列的高度」只会涨不会跌
    const ys = positions.map((p) => p.y)
    expect(ys).toEqual([...ys].sort((a, b) => a - b))

    // 但可见性判定用的是底边（y + height），它不单调 —— 二分的前提在这里断掉
    const bottoms = positions.map((p) => p.y + p.height)
    expect(bottoms).toEqual([200, 50, 100, 150])
    expect(bottoms).not.toEqual([...bottoms].sort((a, b) => a - b))
  })

  it('同一列内部底边严格递增 —— 这才是分列二分成立的依据', () => {
    const layout = layoutMasonry(items(1, 2, 0.5, 1, 1, 3), { containerWidth: 300, columnCount: 3 })
    for (const bucket of layout.columns) {
      const bottoms = bucket.map((i) => layout.positions[i].y + layout.positions[i].height)
      for (let k = 1; k < bottoms.length; k++) {
        expect(bottoms[k]).toBeGreaterThan(bottoms[k - 1])
      }
    }
  })

  it('每项记录自己的列号', () => {
    const { positions } = layoutMasonry(items(1, 1, 1, 1), { containerWidth: 300, columnCount: 3 })
    expect(positions.map((p) => p.column)).toEqual([0, 1, 2, 0])
  })
})

describe('getVisibleItems', () => {
  const grid = (n: number) =>
    layoutMasonry(
      Array.from({ length: n }, (_, i) => ({ id: i + 1, aspectRatio: 1 })),
      { containerWidth: 300, columnCount: 3 },
    )

  it('视口装得下全部时返回所有项', () => {
    expect(getVisibleItems(grid(6), { scrollTop: 0, viewportHeight: 1000 })).toHaveLength(6)
  })

  it('只返回与视口相交的项', () => {
    const got = getVisibleItems(grid(9), { scrollTop: 0, viewportHeight: 100 })
    expect(got.map((p) => p.item.id)).toEqual([1, 2, 3])
  })

  it('滚过去的项不再返回', () => {
    const got = getVisibleItems(grid(9), { scrollTop: 200, viewportHeight: 100 })
    expect(got.map((p) => p.item.id)).toEqual([7, 8, 9])
  })

  it('跨越视口上边界的项必须返回（只判 y>=top 会漏掉它）', () => {
    const got = getVisibleItems(grid(9), { scrollTop: 150, viewportHeight: 100 })
    expect(got.map((p) => p.item.id)).toEqual([4, 5, 6, 7, 8, 9])
  })

  it('跨越视口下边界的项必须返回', () => {
    const got = getVisibleItems(grid(9), { scrollTop: 0, viewportHeight: 150 })
    expect(got.map((p) => p.item.id)).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('overscan 会多渲染上下各若干屏', () => {
    const none = getVisibleItems(grid(9), { scrollTop: 100, viewportHeight: 100 })
    const one = getVisibleItems(grid(9), { scrollTop: 100, viewportHeight: 100, overscan: 1 })
    expect(none.map((p) => p.item.id)).toEqual([4, 5, 6])
    expect(one.map((p) => p.item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('返回值保持 positions 的原始顺序，不按列分组', () => {
    const got = getVisibleItems(grid(9), { scrollTop: 0, viewportHeight: 1000 })
    expect(got.map((p) => p.item.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  it('空列表返回空数组', () => {
    const empty = layoutMasonry([], { containerWidth: 300, columnCount: 3 })
    expect(getVisibleItems(empty, { scrollTop: 0, viewportHeight: 800 })).toEqual([])
  })

  it('滚过总高度后返回空，不崩', () => {
    expect(getVisibleItems(grid(9), { scrollTop: 99999, viewportHeight: 800 })).toEqual([])
  })

  it('scrollTop 为负（下拉回弹）不崩，返回顶部的项', () => {
    const got = getVisibleItems(grid(9), { scrollTop: -50, viewportHeight: 100 })
    expect(got.map((p) => p.item.id)).toEqual([1, 2, 3])
  })
})
