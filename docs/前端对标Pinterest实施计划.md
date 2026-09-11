# 前端深度补齐 · 实施计划（性能工程 + 虚拟列表）

> 版本：v0.2　日期：2026-09-11　状态：**待执行**
> v0.1 是「对标 Pinterest 重做 App」，方向偏了。本版按真实目标重写：**产出可信的前端简历 bullet + 覆盖题库高频考点**。
> 相关：`简历要点.md`「灵犀前端弹药」节（真相源）· `E:\简历\resume-副版-前端全栈.md`（成品）

## 执行状态

| 批次                | 风险   | 状态         | 一句话                                               |
| ------------------- | ------ | ------------ | ---------------------------------------------------- |
| 0 性能基线          | **零** | 待执行       | 只读只出文档。**不做这步，后面所有优化都说不出数字** |
| 1 虚拟列表 + 瀑布流 | **低** | 待执行       | 全新组件，新页面并存，不动现有页面                   |
| 2 性能优化与量化    | 中     | 待执行       | 有基线兜底，劣化立刻可见                             |
| 3 测试最小版        | 低     | 可选         | 补硬伤，不追覆盖率                                   |
| ~~拆巨型组件~~      | 高     | **本轮砍掉** | 收益最低、风险最高。见「明确不做」                   |

---

## Context

### 真实目标

投**前端岗**（2027 届秋招，2026-09-03 起以副版为主线）。此前的问题不是功能少，而是**主力项目的简历弹药 95% 是后端**——`简历要点.md` 里灵犀那几节全是 RAG / MCP / token / 上下文 / 越权，前端只有「35 页面 + 19 组件」两行。

2026-09-11 已修复简历层面：删掉 3 条「已写未做」的后端条目，补上 3 条已完成的前端 bullet（跨端构建产物排障 / 鉴权边界判定 / 请求层与接口分层），前端占比 1/10 → 4/12。

**本计划要解决的是剩下那一半**：简历上仍然写不出**性能优化**和**长列表渲染**——因为项目里真的没有。

### 为什么选这两个方向

因为它们**同时命中三件事**，性价比最高：

|          | 简历 bullet                                       | 题库考点                  | 面试深挖          |
| -------- | ------------------------------------------------- | ------------------------- | ----------------- |
| 性能工程 | 「LCP x → y」是唯一能压过「我用了 XX 技术」的句式 | 5 条高频（见下表）        | 能追到渲染流水线  |
| 虚拟列表 | 长列表渲染 + 内存                                 | **手撕高频题**（🔥 2026） | 前缀高度表 + 二分 |

### 与 `题库.md` 的咬合

做完这两批，下列题目从「背过」变成「项目里做过」：

| 题库条目                                                | 本计划哪一步覆盖                                  |
| ------------------------------------------------------- | ------------------------------------------------- |
| 🔥 **虚拟列表**（前缀高度表 + 二分查找，2026高频·手撕） | 批次 1 全部                                       |
| ⭐ **从输入 URL 到页面展示全流程**（超高频）            | 批次 0 读 Lighthouse 瀑布图 + 批次 2 关键渲染路径 |
| 🔥 **SPA 白屏优化、图片懒加载**                         | 批次 1 渐进式图片 + 批次 2 首屏                   |
| **重排 reflow / 重绘 repaint**                          | 批次 1（位置预算避免回流）+ 批次 2                |
| **CSS 动画 vs JS 动画、GPU 加速**                       | 批次 2                                            |
| ⭐ **HTTP 强缓存 / 协商缓存**                           | 批次 2 资源缓存策略                               |
| **cookie / localStorage / sessionStorage**              | 批次 1 滚动位置恢复要选存储介质                   |

---

## 决策

| #   | 决定                                              | 理由                                                                                                    |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| D1  | **H5 优先**，小程序端降级成普通网格即可           | 前端 JD 绝大多数是 Web 岗；**LCP / CLS / INP 只有 H5 有**，能拿 Lighthouse 报真数字；面试官能直接点链接 |
| D2  | **新开 `/discover` 页并存**，不原地改 `community` | 现有社区页 740 行、无测试保护。新页面并存 = 原页面一行都不用动，随时可弃                                |
| D3  | **自己写虚拟列表，不引库**                        | 引库就只剩「我用了 xx」；自己写才是手撕题的答案                                                         |
| D4  | **不用 CSS `columns`** 做瀑布流                   | `columns` 是**竖向填充**，第 1 项和第 2 项不相邻，视觉顺序会乱                                          |
| D5  | **图片宽高比由服务端给**                          | 零 CLS 的关键：图片没加载完就能算好布局。也避开小程序 `createSelectorQuery` 异步测量                    |
| D6  | **批次 0 必须先做**                               | 没有「优化前」，批次 2 只能说「感觉快了」                                                               |
| D7  | **新组件一律 easycom 注册，不写显式组件 import**  | 就是简历那条 bug 的直接结论，违反会全站白屏                                                             |

---

## 实施方案

### 批次 0 — 性能基线（零风险，动手前必做）

留档 `docs/perf-baseline.md`，每项要有可复现命令。

```bash
cd miniapp && npm run build:h5
npx serve dist/build/h5 -p 5000
npx lighthouse http://localhost:5000 --preset=desktop \
  --output=json --output=html --output-path=../docs/perf/base
# 移动端模式再跑一次，各跑 3 次取中位数
```

四组数字都要记：

1. **Lighthouse**：LCP / CLS / INP / TBT / Speed Index / Performance 总分
2. **包体积**：`dist/build/h5` 总大小 + 最大 3 个 chunk（`rollup-plugin-visualizer` 出图存档）
3. **长列表 FPS**：目标页滚到底，DevTools Performance 录制，记 FPS 曲线与掉帧数
4. **内存**：滚动 200 项后的 JS Heap

> ⚠️ 现在**没有 200 项数据可滚**（见批次 1 的前置步骤）。批次 0 先记「当前数据量下」的数字，
> 批次 1 灌完数据后**再补一次基线**——这两组都要留，因为「数据量变了」本身会影响指标，
> 面试被问「你的对照组公平吗」要答得出来。

### 批次 1 — 虚拟列表 + 瀑布流（核心批次）

**1.0 前置：得先有足够数据**

现在种子数据每人只有 **20 件衣物**，社区内容也不足。虚拟列表在 20 项上毫无意义，也测不出性能差异。

- 扩 `server/seeds/` 的种子量到 **300+ 项**（复用 `miniapp/src/static` 里现成的 **205 张图**，允许重复引用图片但记录要独立）
- 后端补**游标分页**：`services/community/content.mjs:42` 的 `listContents` 现在只接 `limit`（`communityRepo.mjs:81`，上限 100），**没有 offset / cursor**。用 `created_at + id` 复合游标，别用 offset（翻页时插入新数据会重复/漏项），返回 `nextCursor` / `hasMore`
- 给内容表补 `img_w` / `img_h` / `img_color` 三列（D5），走 `db/mysql.mjs` 已有的 `ensureColumn` 幂等迁移
- 主色**构建期算**，不在运行时算（运行时算要先把图下下来，等于白做懒加载）。写个一次性脚本，缩放到 1×1 取像素即可

**1.1 `MasonryGrid` 组件（列平衡 + 虚拟化）**

```
components/MasonryGrid/MasonryGrid.vue
```

列平衡用「最短列优先」贪心（D4）：

```
colHeights = new Array(colCount).fill(0)
for (item of items):
  c = argmin(colHeights)              // 最短列优先
  item.x = c * (colW + gap)
  item.y = colHeights[c]
  item.h = colW / item.aspectRatio    // aspectRatio 来自服务端，D5
  colHeights[c] += item.h + gap
containerH = max(colHeights)
```

虚拟化 = **前缀高度表 + 二分查找**（就是手撕题的解法）：位置全部预先算好（不依赖图片加载），按 `scrollTop` 二分出可视区间，只渲染 `[start - buffer, end + buffer]`。

⭐ **面试要能讲清的三点**：

- 为什么不用 CSS `columns`（竖向填充，顺序乱）
- 为什么位置要预算而不是测量（测量→回流→再测量，且图片异步加载会导致抖动）
- 瀑布流的虚拟化比线性列表难在哪（每列高度不同，不能用 `index * itemHeight` 直接算）

**1.2 `ProgressiveImage` 组件**

```
外层背景 = 服务端给的主色
  ↓ IntersectionObserver 进入视口
<img loading="lazy" decoding="async" srcset=... sizes=...>
  ↓ onload
opacity 0 → 1
```

**1.3 无限滚动 + 滚动恢复**

- 哨兵放列表底部往上 1.5 屏（预取余量）
- **跨页去重**：游标分页也会重复，用 `Set<id>` 兜一道
- **滚动恢复**：缓存 `items + scrollTop`，返回时精确还原（位置是算出来的，所以能精确）

**1.4 骨架屏**

复用同一套列平衡算法，喂随机 aspectRatio。

### 批次 2 — 性能优化与量化

拿批次 0 的基线做对照，**每项都要有前后数字**：

| 手段                                                  | 预期改善                              |
| ----------------------------------------------------- | ------------------------------------- |
| 路由级代码分割（19,968 行现在大概率打进一个大 chunk） | 包体积、LCP                           |
| `srcset` + WebP + 主色占位                            | LCP、**CLS 应该直接归零**（宽高已知） |
| 虚拟滚动（批次 1 已做）                               | 长列表 FPS、JS Heap                   |
| `content-visibility: auto` 给非视口区块               | TBT、Speed Index                      |
| 字体 `font-display: swap` + 首屏关键 CSS              | LCP、CLS                              |
| 静态资源缓存策略（强缓存 + 内容哈希）                 | 二次访问 LCP                          |

最后把「优化前 → 优化后」表格写进 `docs/perf-baseline.md`。**这张表是简历上最硬的一段。**

### 批次 3 — 测试最小版（可选）

补硬伤，不追覆盖率。目标是**面试能答「项目怎么测的」**。

- `vitest.config.ts`（复用 vite alias，`environment: 'happy-dom'`）
- `test/setup.ts` mock `uni.*`（全项目 **130 处**调用，只 mock 用到的）
- 挑 3–5 个写：`MasonryGrid` 的列平衡函数（**纯函数，最好测**）、`ProgressiveImage`、一个 composable

⭐ 面试点：**列平衡和二分查找抽成纯函数**，所以不用挂载组件就能测——这本身是可测性设计的例子。

---

## 验证

```bash
# 批次 1
cd miniapp && npm run dev:h5     # 浏览器手测：
#   滚到底自动加载、无重复项
#   进详情再返回，滚动位置精确还原
#   断网有错误态，恢复能重试
#   快速滚动不出现空白块（预取余量够）
#   DevTools 里 DOM 节点数不随滚动增长（虚拟化生效的判据）
npm run build:mp-weixin          # 小程序端不回归

# 批次 2
npx lighthouse http://localhost:5000 --preset=desktop \
  --output=json --output-path=docs/perf/after
# 与 docs/perf/base 逐项对比，差异写进 docs/perf-baseline.md

# 批次 3
npx vitest run
cd .. && npm run lint            # eslint + prettier
cd miniapp && npm run check:types # vue-tsc strict
```

**回归底线**：小程序端可以没有瀑布流，但**不能白屏、不能报错**。批次 1/2 每次提交都跑一次 `npm run build:mp-weixin`。

---

## 约束与坑

- **新组件一律靠 easycom 注册，不要在 `.vue` 里写显式组件 import**（D7）。原因见 `components/TileImage/TileImage.vue` 顶部注释——违反会导致微信开发者工具依赖分析失败、全站白屏。普通模块 import（`import { computed } from 'vue'`）不受影响
- TS `strict: true`。⚠️ 注意 `tsconfig.json` 里**没有** `noUnusedLocals` / `noUnusedParameters`（那是 `docs/开发手册.md` 的团队约定），别以为编译器会帮你抓未使用变量
- 不要改铁律共享文件（`docs/开发手册.md` 3.0）：`main.ts`、`App.vue`、`assets/styles/*`、`components/BottomNav.vue`、`components/PageHeader.vue` 等
- 小程序端**没有** `ResizeObserver`、CSS `columns`、`content-visibility`；`IntersectionObserver` 要换 `uni.createIntersectionObserver()`。组件要做能力检测后降级

---

## 明确不做

- **拆巨型组件**（`pages/scene/index.vue` 1462 行、`pages/accessory/index.vue` 1407 行）。
  **风险最高、简历收益最低** —— 讲出来就是「我把大文件拆小了」，远不如「LCP 3.2s → 1.1s」。
  而且拆之前需要特征测试，而特征测试锁的是「写测试的人理解的现有行为」，理解错就把错误行为一起锁住。
  等批次 3 有了测试网再回头做。⚠️ **简历里已明确标注这是已知缺口，不要吹「注重组件拆分」。**
- **小程序端的虚拟瀑布流**（D1）。要对抗 `setData` 开销，工作量翻倍，且小程序没有 LCP/CLS 可量化
- **Service Worker / PWA**。对 uni-app 项目收益低，和小程序端概念冲突
- **引入虚拟滚动库**（D3）。自己写才是手撕题的答案
- **React / SSR / 微前端 / Monorepo**。项目里没有真实场景，硬做就是新的壳（`面试深挖准备包.md` 已有「没用过就承认」的话术）

---

## 做完之后的简历 bullet（预期形态，做完再按真数字填）

> ⚠️ **数字没测出来之前，一个字都不许写进简历**（真相源铁律第 1 条）。

```
- **长列表渲染** 瀑布流列表以「最短列优先」分列并预算每项绝对位置（宽高比由接口下发，
  避免图片异步加载引起的二次回流），配合前缀高度表 + 二分查找定位可视区间，
  滚动时 DOM 节点数恒定；游标分页无限滚动含跨页去重与滚动位置精确恢复。

- **首屏与渲染性能** 建立 Lighthouse 基线后逐项优化：路由级代码分割、srcset + WebP、
  主色占位消除布局偏移、非视口区块 content-visibility。LCP __ → __、CLS __ → __、
  长列表滚动 FPS __ → __。
```

---

## 待确认

- 批次 0 需要完整环境（MySQL + dev server）。**本文撰写时本机 MySQL 未启动**
- 目标页选 `community`（内容型，接近 Pinterest）还是 `closet`（衣物图片，数据更好造）——
  建议 **`/discover` 新页读社区内容**，因为社区内容有 `img` 字段和多种类型，更像真产品
