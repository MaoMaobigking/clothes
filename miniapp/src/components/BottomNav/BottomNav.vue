<script setup lang="ts">
import { onMounted } from 'vue'
import type { IconName } from '@/utils/icons'

interface Tab {
  key: string
  label: string
  route: string
  /** Ai 那格是方块徽标，没有 icon */
  icon?: IconName
}

const tabs: Tab[] = [
  { key: 'home', label: '首页', route: '/pages/home/home', icon: 'home' },
  { key: 'ai', label: 'Ai', route: '/pages/ai/ai' },
  { key: 'closet', label: '衣橱', route: '/pages/closet/closet', icon: 'closet' },
  { key: 'mall', label: '商城', route: '/pages/mall/mall', icon: 'mall' },
  { key: 'me', label: '我的', route: '/pages/me/me', icon: 'me' },
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

function go(t: Tab) {
  if (t.key === props.active) return
  // switchTab 之后原生栏可能被重新显示出来，跳完再藏一次
  uni.switchTab({ url: t.route, complete: hideNativeTabBar })
}
</script>

<template>
  <view class="tabbar">
    <view
      v-for="t in tabs"
      :key="t.key"
      class="tab"
      :class="{ on: active === t.key }"
      @tap="go(t)"
    >
      <view class="ico">
        <!-- Ai：圆角方块徽标 -->
        <text v-if="t.key === 'ai'" class="ai-badge">Ai</text>
        <UiIcon
          v-else-if="t.icon"
          :name="t.icon"
          :size="44"
          :tone="active === t.key ? 'dark' : 'muted'"
          :stroke-width="active === t.key ? 1.9 : 1.6"
        />
      </view>
      <text class="lbl">{{ t.label }}</text>
    </view>
  </view>
</template>

<style scoped>
.tabbar {
  flex-shrink: 0;
  display: flex;
  background: #ffffff;
  padding: 12rpx 12rpx calc(12rpx + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #eceaf0;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8rpx 0;
  color: #9a94a8;
  transition: color 0.15s ease;
}
.tab.on {
  color: #2f2a3d;
}
.ico {
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.lbl {
  font-size: 21rpx;
  font-weight: 500;
}

/* Ai 徽标 */
.ai-badge {
  width: 54rpx;
  height: 40rpx;
  border-radius: 12rpx;
  border: 2px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 800;
}
.tab.on .ai-badge {
  background: #2f2a3d;
  color: #fff;
  border-color: #2f2a3d;
}
</style>
