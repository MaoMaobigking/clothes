<script setup lang="ts">
defineProps<{
  title: string
  /** 当前步（1 起） */
  current: number
  /** 总步数 */
  total: number
}>()

const emit = defineEmits<{
  (e: 'back'): void
}>()
</script>

<template>
  <header class="app-header">
    <div class="bar">
      <button class="back" aria-label="返回" @click="emit('back')">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <path
            d="M15 18l-6-6 6-6"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <h1 class="title">{{ title }}</h1>
      <span class="counter">{{ current }}/{{ total }}</span>
    </div>

    <!-- 进度条 -->
    <div class="progress">
      <div class="progress-fill" :style="{ width: `${(current / total) * 100}%` }" />
    </div>
  </header>
</template>

<style scoped>
.app-header {
  padding: calc(env(safe-area-inset-top, 12px) + 8px) 16px 12px;
  flex-shrink: 0;
}

.bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.back {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.7);
  color: var(--text-1);
  box-shadow: var(--shadow-card);
  flex-shrink: 0;
}

.title {
  flex: 1;
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-1);
  text-align: center;
  padding-right: 36px; /* 抵消左边返回键，视觉居中 */
}

.counter {
  position: absolute;
  right: 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--purple-deep);
  background: rgba(255, 255, 255, 0.7);
  padding: 4px 10px;
  border-radius: var(--radius-pill);
}

.progress {
  margin-top: 14px;
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.6);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--brand-gradient);
  transition: width 0.35s ease;
}
</style>
