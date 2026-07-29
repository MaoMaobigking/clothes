<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="phone-shell">
    <div class="phone-screen">
      <RouterView v-slot="{ Component }">
        <transition name="page" mode="out-in">
          <component :is="Component" />
        </transition>
      </RouterView>
    </div>
  </div>
</template>

<style scoped>
/* 外层：桌面上把内容裱在一个手机大小的框里，手机上直接铺满 */
.phone-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e9ecf3;
  padding: 0;
}

.phone-screen {
  position: relative;
  width: 100%;
  max-width: 430px;
  height: 100vh;
  max-height: 932px;
  overflow: hidden;
  background: var(--bg-gradient);
  display: flex;
  flex-direction: column;
}

/* 桌面（宽屏）上给一点手机外观 */
@media (min-width: 500px) {
  .phone-shell {
    padding: 24px;
  }
  .phone-screen {
    height: calc(100vh - 48px);
    border-radius: 36px;
    box-shadow: 0 24px 60px rgba(90, 70, 140, 0.25);
    border: 8px solid #1c1c24;
  }
}

/* 路由切换动画 */
.page-enter-active,
.page-leave-active {
  transition: opacity 0.22s ease, transform 0.22s ease;
}
.page-enter-from {
  opacity: 0;
  transform: translateX(16px);
}
.page-leave-to {
  opacity: 0;
  transform: translateX(-16px);
}
</style>
