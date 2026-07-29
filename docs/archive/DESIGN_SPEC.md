# 页面搭建规范（所有页面必须遵守）

> 这是一个手机端 Vue3 + TS 的 App。你负责搭建**指定的一个页面**（一个 view 文件，
> 复杂时可在自己的页面子文件夹里拆子组件）。请严格照本规范，保证和已有页面风格一致。

## 0. 铁律

1. **只创建你被分配的 view 文件**（以及该页面专属的子组件，放在自己的子文件夹里，用页面名前缀命名，如 `MallProductSheet.vue`）。
2. **绝对不要修改**这些共享文件：`router/index.ts`、`main.ts`、`App.vue`、`assets/styles/*`、`components/BottomNav.vue`、`components/PageHeader.vue`、`components/SegTabs.vue`、`components/TileImage.vue`、`components/ProductCard.vue`、`components/SectionTitle.vue`、`data/*`、`stores/*`。路由我已经接好了，指向你要创建的文件路径。
3. 语言：Vue3 `<script setup lang="ts">`。TS 是 **strict + noUnusedLocals + noUnusedParameters**，所以：**不要留没用到的 import / 变量 / 参数**，否则打包报错。
4. 不用任何真实图片。所有"图片"一律用 `<TileImage>` 占位（渐变色块 + emoji）。
5. 全中文文案，粉紫少女风，圆角卡片、柔和阴影、emoji 图标。参考 `views/Home.vue`、`views/Closet.vue` 这两个已完成的页面照着写。

## 1. 目录 & 别名

- `@` = `src`。例：`import TileImage from '@/components/TileImage.vue'`。

## 2. 页面骨架（必须这样）

每个页面根是一个纵向 flex 的满高容器：

```vue
<template>
  <div class="page">
    <!-- 有底部 tab 的页面（首页/Ai/衣橱/商城/我的）：顶部可无 header -->
    <!-- 二级页面：顶部放 <PageHeader title="xxx" /> -->
    <PageHeader title="情景模拟" />

    <div class="body scroll-y hide-scrollbar">
      <!-- 你的内容 -->
    </div>

    <!-- 只有 5 个 tab 主页面才加这行；二级页面不要加 -->
    <BottomNav active="closet" />
  </div>
</template>

<style scoped>
.page { height: 100%; display: flex; flex-direction: column; }
.body { flex: 1; min-height: 0; padding: 12px 16px 16px;
        display: flex; flex-direction: column; gap: 14px; }
</style>
```

- 底部 tab 主页面（active 值）：`home` / `ai` / `closet` / `mall` / `me`。
- 二级页面用 `<PageHeader title="..." />`，它自带返回键（默认 `router.back()`；可传 `to="/home"` 指定目标）。

## 3. 设计变量（`assets/styles/variables.css` 已全局注入，直接用）

颜色：`--pink` `--pink-deep` `--purple` `--purple-deep` `--mint` `--mint-deep`
渐变：`--brand-gradient`（粉→紫，按钮/高亮用）、`--bg-gradient`（页面大背景，已在外壳设置）
文字：`--text-1`(主) `--text-2`(次) `--text-3`(弱) `--text-on-brand`(白)
面：`--surface`(白卡) `--surface-soft`(半透白) `--line`(描边)
圆角：`--radius-sm` `--radius` `--radius-lg` `--radius-pill`
阴影：`--shadow-card` `--shadow-float`
其它：`--gap`(16px) `--safe-bottom`

## 4. 全局按钮类（`global.css` 已定义，直接加 class）

- `.btn`（基类）+ `.btn-primary`（粉紫渐变实心）/ `.btn-ghost`（白底）/ `.btn-text`（弱文字按钮）
- 滚动区加 `.scroll-y.hide-scrollbar`。

## 5. 共享组件 API（直接 import 复用，别重造）

### `<TileImage>` —— 万能图片占位
```
props: from?: string(默认粉) , to?: string(默认紫) , emoji?: string ,
       ratio?: string(默认 '1 / 1', 传 CSS aspect-ratio) , label?: string ,
       rounded?: string(默认 var(--radius))
```
例：`<TileImage from="#a6c8ff" to="#5f8bff" emoji="🧥" ratio="3 / 4" />`

### `<PageHeader>` —— 二级页顶部返回栏
```
props: title: string , to?: string(返回目标, 不传则 router.back()) , sub?: string
slots: right(标题栏右侧)
```

### `<SegTabs>` —— 分段切换（v-model）
```
props: tabs: {key:string,label:string}[] , modelValue: string
用法: <SegTabs v-model="tab" :tabs="[{key:'a',label:'虚拟试穿'},{key:'b',label:'AI推荐'}]" />
```

### `<SectionTitle>` —— 小节标题
```
props: title: string , more?: string(右侧文字, 传了才显示)
emits: more (点右侧文字)
```

### `<ProductCard>` —— 商品/衣物卡
```
props: title: string , price?: number , emoji?: string , from?: string , to?: string ,
       tag?: string , fav?: boolean , ratio?: string(默认 '1 / 1')
emits: click(卡片) , fav(点收藏心)
```

### `<BottomNav>` —— 底部 5 tab（只主页面用）
```
props: active: 'home'|'ai'|'closet'|'mall'|'me'
它内部已用 router 跳转，你只需传 active。
```

## 6. Mock 数据（`@/data/mock.ts`，全部现成，直接 import）

- `CLOSET_CATEGORIES` / `GARMENTS`（衣橱 & 试穿用，含 emoji/from/to/price/category/brand/season）
- `MALL_CATEGORIES` / `MALL_PRODUCTS`（商城，含 price）
- `MAGAZINES`（时尚杂志封面）
- `POSTS` / `HOT_TOPICS`（时尚社群）
- `WEATHER`（城市/日期/温度/预警/未来几天 forecast）
- `OUTFIT_RECOS`（AI 推荐的整套搭配）
- `SCENES`（场景：游玩/职场/约会/运动…）
- `AI_TOOLS`（个性化创建右侧工具：更换性别/拍照换脸/造型优化/局部身材/收藏夹）
- `AI_FEATURES`（AI hub 入口：个性化创建/自由搭配/情景模拟/旧衣新生/新旧混搭）

类型都从 `@/data/mock.ts` 具名导出（`import { GARMENTS, type Garment } from '@/data/mock'`）。

## 7. Store（`@/stores/*`，需要交互再用）

- `useProfileStore`（个人画像，已存在）
- `useWardrobeStore`：`favIds`、`activeCategory`、`filtered`(按分类过滤的衣物)、`favoriteGarments`、`toggleFav(id)`、`isFav(id)`、`setCategory(key)`
- `useCartStore`：`count`、`ids`、`has(id)`、`add(id)`、`toggle(id)`

用法：`const cart = useCartStore()`，模板里 `cart.count`。

## 8. 路由表（已接好，你的页面对应哪个路径见任务说明）

`/home` `/ai` `/closet` `/mall` `/me` `/create` `/test` `/result` `/free-match` `/scene` `/magazine` `/community`

页面间跳转用 `const router = useRouter(); router.push('/scene')`。

## 9. 交付

只输出：你创建了哪些文件（路径）+ 每个文件几句话说明 + 有没有需要主程接线的地方。不要贴整段代码。
