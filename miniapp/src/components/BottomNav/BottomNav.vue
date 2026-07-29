<script setup lang="ts">
interface Tab {
  key: string
  label: string
  route: string
}

const tabs: Tab[] = [
  { key: 'home', label: '首页', route: '/pages/home/home' },
  { key: 'ai', label: 'Ai', route: '/pages/ai/ai' },
  { key: 'closet', label: '衣橱', route: '/pages/closet/closet' },
  { key: 'mall', label: '商城', route: '/pages/mall/mall' },
  { key: 'me', label: '我的', route: '/pages/me/me' },
]

defineProps<{ active: string }>()

function go(t: Tab) {
  uni.switchTab({ url: t.route })
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
        <!-- 其他用 emoji 简化 -->
        <text v-else class="ico-emoji">
          <template v-if="t.key === 'home'">🏠</template>
          <template v-else-if="t.key === 'closet'">👗</template>
          <template v-else-if="t.key === 'mall'">🛍️</template>
          <template v-else>👤</template>
        </text>
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
.ico-emoji {
  font-size: 44rpx;
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
