<script setup lang="ts">
import { useRouter } from 'vue-router'

interface Tab {
  key: string
  label: string
  route: string
}

const tabs: Tab[] = [
  { key: 'home', label: '首页', route: '/home' },
  { key: 'ai', label: 'Ai', route: '/ai' },
  { key: 'closet', label: '衣橱', route: '/closet' },
  { key: 'mall', label: '商城', route: '/mall' },
  { key: 'me', label: '我的', route: '/me' },
]

defineProps<{ active: string }>()

const router = useRouter()
function go(t: Tab) {
  router.push(t.route)
}
</script>

<template>
  <nav class="tabbar">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="tab"
      :class="{ on: active === t.key }"
      @click="go(t)"
    >
      <span class="ico">
        <!-- 首页：房子 -->
        <svg v-if="t.key === 'home'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 10.7 12 3.5l9 7.2" />
          <path d="M5.5 9.5V20h13V9.5" />
          <path d="M10 20v-5.5h4V20" />
        </svg>

        <!-- Ai：圆角方块徽标 -->
        <span v-else-if="t.key === 'ai'" class="ai-badge">Ai</span>

        <!-- 衣橱：衣柜 -->
        <svg v-else-if="t.key === 'closet'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="5" y="3" width="14" height="18" rx="1.6" />
          <path d="M12 3v18" />
          <path d="M9.6 9.5v2" />
          <path d="M14.4 9.5v2" />
        </svg>

        <!-- 商城：购物袋 -->
        <svg v-else-if="t.key === 'mall'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6.2 8h11.6l-1 11.2a1 1 0 0 1-1 .9H8.2a1 1 0 0 1-1-.9L6.2 8Z" />
          <path d="M9 8.5V6.2a3 3 0 0 1 6 0v2.3" />
        </svg>

        <!-- 我的：人 -->
        <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="8" r="3.4" />
          <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
        </svg>
      </span>
      <span class="lbl">{{ t.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.tabbar {
  flex-shrink: 0;
  display: flex;
  background: #ffffff;
  padding: 6px 6px calc(6px + var(--safe-bottom));
  border-top: 1px solid #eceaf0;
}
.tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 4px 0;
  color: #9a94a8; /* 未选中：中性灰，去卡通 */
  transition: color 0.15s ease;
}
.tab.on {
  color: #2f2a3d; /* 选中：接近黑，和设计稿一致 */
}
.ico {
  height: 26px;
  display: grid;
  place-items: center;
}
.ico svg {
  width: 25px;
  height: 25px;
}
.lbl {
  font-size: 10.5px;
  font-weight: 500;
}

/* Ai 徽标 */
.ai-badge {
  width: 27px;
  height: 20px;
  border-radius: 6px;
  border: 1.8px solid currentColor;
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.tab.on .ai-badge {
  background: #2f2a3d;
  color: #fff;
  border-color: #2f2a3d;
}
</style>
