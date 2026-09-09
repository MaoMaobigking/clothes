<script setup lang="ts">
import { onMounted } from 'vue'
import type { IconName } from '@/utils/icons'
import { ROUTES, type TabRouteKey } from '@/constants/routes'

/*
 * key 用 TabRouteKey（constants/routes.ts 里 tabBar 五页的字面量联合类型），
 * 路径也从 ROUTES 取 —— 这里原来自己写了一遍五条 '/pages/xxx' 字符串。
 * 打错一个字母不会有编译错误，switchTab 只会静默失败，这一栏就点不动。
 */
interface Tab {
  key: TabRouteKey
  label: string
  /** Ai 那格是方块徽标，没有 icon */
  icon?: IconName
}

const tabs: Tab[] = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'ai', label: 'Ai' },
  { key: 'closet', label: '衣橱', icon: 'closet' },
  { key: 'mall', label: '商城', icon: 'mall' },
  { key: 'me', label: '我的', icon: 'me' },
]

const props = defineProps<{ active: string }>()

/*
 * 藏掉原生 tab 栏。
 *
 * pages.json 里的 tabBar 声明不能删 —— uni.switchTab 只认声明过的页面，
 * 删了这 5 个页面之间就跳不动了。但原生 tab 栏会和这个自定义导航同时显示，
 * 屏幕底部就出现两条。所以声明留着只为路由，栏本身藏起来。
 */
function hideNativeTabBar() {
  uni.hideTabBar({ animation: false, fail: () => {} })
}

onMounted(hideNativeTabBar)

/*
 * 这一格自己的跳转，**不能**换成 utils/nav 的 go()：
 * 它多一步 complete: hideNativeTabBar —— switchTab 之后原生栏会被系统重新显示，
 * 跳完必须再藏一次，否则底部会同时出现两条导航。
 */
function go(key: string) {
  if (key === props.active) return
  const t = tabs.find((x) => x.key === key)
  if (!t) return
  uni.switchTab({ url: ROUTES[t.key], complete: hideNativeTabBar })
}

/* 和 uni.scss 的 $uv-primary / $uv-tips-color 同值。
   这里必须写字面色值：uv-tabbar 把它们拼进 inline style，CSS 变量传不进去。 */
const ACTIVE_COLOR = '#ff5c9d'
const INACTIVE_COLOR = '#909193'
</script>

<template>
  <!--
    外层这个 view 不能省：
    .page 是纵向 flex，底栏必须 flex-shrink:0 才不会被内容挤扁。
    uv-tabbar 的根节点不接 customStyle（它只把 style 加在内部的 __content 上），
    所以 flex-shrink 只能挂在外面。

    :fixed="false" + :placeholder="false" 是刻意的 ——
    uv-tabbar 默认 fixed 定位 + 生成等高占位块，那套是给「页面自己不管底栏」的布局用的。
    本项目的 .page 骨架是把底栏当流内元素排的，改成 fixed 会让 .body 底部被盖住。
    safeAreaInsetBottom 独立于 fixed 生效（它渲染的是 uv-safe-bottom 子元素），
    所以流内布局下安全区照样有。
  -->
  <view class="tabbar-slot">
    <uv-tabbar
      :value="active"
      :fixed="false"
      :placeholder="false"
      :safe-area-inset-bottom="true"
      :border="true"
      :active-color="ACTIVE_COLOR"
      :inactive-color="INACTIVE_COLOR"
      @change="go"
    >
      <uv-tabbar-item v-for="t in tabs" :key="t.key" :name="t.key" :text="t.label">
        <!--
          不传 icon prop，走 active-icon / inactive-icon 插槽。
          原因：icon prop 走的是 uv-icon 的 iconfont（uvicons.ttf），
          那套 158 个图标里没有「衣橱」这类服装图标，只能用项目自己的 UiIcon。
        -->
        <template #active-icon>
          <text v-if="t.key === 'ai'" class="ai-badge on">Ai</text>
          <UiIcon v-else-if="t.icon" :name="t.icon" :size="44" tone="brand" :stroke-width="1.9" />
        </template>
        <template #inactive-icon>
          <text v-if="t.key === 'ai'" class="ai-badge">Ai</text>
          <UiIcon v-else-if="t.icon" :name="t.icon" :size="44" tone="muted" :stroke-width="1.6" />
        </template>
      </uv-tabbar-item>
    </uv-tabbar>
  </view>
</template>

<style scoped>
.tabbar-slot {
  flex-shrink: 0;
}

/*
 * Ai 徽标：中间那格不是图标而是一个方框「Ai」。
 * uv-ui 没有对应形态，保留自绘。
 * 选中态从「深色底」改成主色底 —— uv-ui 的选中一律是主色，不是深灰。
 */
.ai-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 54rpx;
  height: 40rpx;
  font-size: var(--fs-base);
  font-weight: 700;
  color: #909193;
  border: 2rpx solid #909193;
  border-radius: var(--radius-sm);
}

.ai-badge.on {
  color: #fff;
  background: var(--pink-deep);
  border-color: var(--pink-deep);
}
</style>
