/**
 * 社区种子数据的**批量补充**部分。
 *
 * ── 为什么要拆分文件 ──
 * seeds/community.mjs 里那 19 条是**手写的**：每条标题、文案、话题都单独措辞，
 * 是「看起来像真实社区」的样板。而这里要的是 300+ 条，
 * 目标是**让长列表有真实的渲染压力** —— 手写 300 条既不可能也没意义
 * （没人会去读第 287 条的话题标签）。
 *
 * 所以职责分开：
 *   community.mjs            手写的 19 条，真实感与文案质量
 *   communityBulk.mjs（本文件）确定性生成的 300 条，渲染压力与数据量
 *
 * ── 为什么是「确定性生成」而不是随机 ──
 * 用固定种子的伪随机（下面 mulberry32），同样的输入永远产出同一批数据。
 * 这样性能测量的前后对比才有意义 —— 数据本身不变，变的只有代码。
 * 如果每次启动都随机生成，FPS 差异里就混进了「这次数据恰好更重」的噪声，
 * 而那正是 docs/perf-baseline.md 里「一个差点上简历的错误数字」那类错误。
 *
 * ── 为什么复用图片但记录独立 ──
 * 手上只有 205 张图（见 docs/图片素材清单.md），300 条内容必然要重复引用。
 * 这是**刻意接受**的：测的是「300 个列表项渲染多慢」，
 * 图片总数不影响 DOM 节点数与布局计算量，而重复引用同一个 URL 还能命中图片缓存，
 * 反而把变量收得更干净（图片网络耗时是常量，差异全来自渲染）。
 */

/** 固定种子的伪随机数生成器（mulberry32）。同种子 → 同序列。 */
function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/*
 * 图片池。相对路径，和 community.mjs 里手写那批写法一致
 * （构建期由 vite 的 rewriteStaticImages 改写成云端地址）。
 */
const COVERS = [
  ...Array.from({ length: 8 }, (_, i) => `/static/images/lookbook/look-0${i + 1}-front.jpg`),
  ...Array.from({ length: 6 }, (_, i) => `/static/images/community/p${i + 1}.jpg`),
  '/static/images/model/front.jpg',
  '/static/images/model/front-male.jpg',
  ...Array.from({ length: 6 }, (_, i) => `/static/images/outfit/outfit-0${i + 1}.jpg`),
].filter(Boolean)

const AUTHORS = [
  { key: 'alice', name: '小鱼要暴富', avatar: '🐟' },
  { key: 'lina', name: '通勤小圈', avatar: '💼' },
  { key: 'yan', name: '莫兰迪', avatar: '🫧' },
]

/** 话题池。带 # 前缀，与手写那批一致。 */
const TOPICS = [
  '#小个子穿搭',
  '#显高',
  '#通勤穿搭',
  '#一周穿搭挑战',
  '#胶囊衣橱',
  '#旧衣改造',
  '#夏季穿搭',
  '#秋冬穿搭',
  '#配色',
  '#配饰点睛',
  '#基础款',
  '#约会穿搭',
  '#运动风',
  '#复古',
  '#极简',
  '#层次感',
]

const TITLE_HEADS = [
  '衣柜里最值得留的',
  '被我翻牌最多的',
  '一周不重样的',
  '通勤路上被问链接的',
  '换季最省心的',
  '预算三百搞定的',
  '小个子友好的',
  '微胖也能穿的',
  '上班约会都能用的',
  '旧衣改造后的',
]
const TITLE_TAILS = ['三套搭配', '配色公式', '显高思路', '叠穿技巧', '选款逻辑', '实录', '清单', '踩坑记录']

const SUBTITLES = [
  '照着穿就不会出错',
  '重点是比例和顺色',
  '同件单品换内搭就够',
  '把复杂留给细节',
  '颜色控制在三个以内',
  '面料比款式更关键',
  '先定下装再挑上装',
  '腰线是唯一的重点',
]

/**
 * 生成 share 类型的补充内容。
 *
 * count 默认 300 —— 这个数字不是随便定的：虚拟滚动的收益要在「一屏放不下很多倍」
 * 的量级上才看得出来。19 条时整个列表一次渲染完，装不装虚拟化没区别；
 * 300 条时非虚拟化会创建 300 个卡片节点（每个含图、文字、多个 view），
 * 布局与绘制开销才是可测量的。
 */
export function buildBulkShares(count = 300) {
  const rand = mulberry32(20260927)
  const pick = (arr) => arr[Math.floor(rand() * arr.length)]

  return Array.from({ length: count }, (_, i) => {
    const author = AUTHORS[i % AUTHORS.length]
    const n = String(i + 1).padStart(3, '0')
    // 每条 2 个话题，允许重复 —— 真实社区里话题就是这么聚集的
    const topics = [pick(TOPICS), pick(TOPICS)].filter((t, idx, a) => a.indexOf(t) === idx)

    return {
      id: `share-bulk-${n}`,
      type: 'share',
      authorUserId: author.key,
      authorName: author.name,
      authorAvatar: author.avatar,
      title: `${pick(TITLE_HEADS)}${pick(TITLE_TAILS)}`,
      subtitle: pick(SUBTITLES),
      coverUrl: pick(COVERS),
      category: '用户分享',
      /*
       * publishedMonth 跨两个月分布，而不是全塞在同一个月 ——
       * 前端有按月/按类型筛选的逻辑，单月数据会让那些分支永远只有一条路径被走到。
       */
      publishedMonth: i % 3 === 0 ? '2026-09' : '2026-08',
      topics,
      body: {
        caption: pick(SUBTITLES),
        description: `第 ${i + 1} 条记录：${pick(SUBTITLES)}`,
      },
    }
  })
}

/**
 * 给补充内容配上少量互动。
 *
 * 不按条数等比配 —— 300 条内容配 300 条点赞既不符合真实社区（大部分内容没人互动），
 * 也会让写库变成 300 次额外的 INSERT。只给前 30 条配，让「有互动 / 无互动」
 * 两种卡片状态在列表里都能出现，这才是前端渲染时真正需要覆盖的分支。
 */
export function buildBulkInteractions(count = 300) {
  const rows = []
  const withInteraction = Math.min(30, count)
  for (let i = 0; i < withInteraction; i++) {
    const n = String(i + 1).padStart(3, '0')
    const author = AUTHORS[(i + 1) % AUTHORS.length]
    rows.push([`demo_bulk_like_${n}`, `share-bulk-${n}`, author.key, 'like'])
    if (i % 3 === 0) {
      rows.push([`demo_bulk_fav_${n}`, `share-bulk-${n}`, AUTHORS[(i + 2) % AUTHORS.length].key, 'favorite'])
    }
  }
  return rows
}

export function buildBulkComments(count = 300) {
  const texts = [
    '这个思路我明天就试',
    '腰线处理得好自然',
    '配色看着很舒服',
    '学到了，谢谢分享',
    '同身高，已收藏',
    '这个单品我也有，一直不知道怎么搭',
  ]
  const rows = []
  const withComment = Math.min(20, Math.min(count, 300))
  for (let i = 0; i < withComment; i++) {
    const n = String(i + 1).padStart(3, '0')
    rows.push([`demo_bulk_comment_${n}`, `share-bulk-${n}`, AUTHORS[i % AUTHORS.length].key, texts[i % texts.length]])
  }
  return rows
}
