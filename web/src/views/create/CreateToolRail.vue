<script setup lang="ts">
import { AI_TOOLS } from '@/data/mock'

const emit = defineEmits<{ (e: 'tool', tool: (typeof AI_TOOLS)[number]): void }>()
</script>

<template>
  <div class="rail">
    <button
      v-for="t in AI_TOOLS"
      :key="t.key"
      class="tool"
      :class="{ disabled: t.disabled }"
      @click="emit('tool', t)"
    >
      <span class="t-ico">{{ t.emoji }}</span>
      <span class="t-label">{{ t.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.rail {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tool {
  width: 58px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 7px 2px;
  border-radius: var(--radius-sm);
  background: rgba(255, 255, 255, 0.78);
  backdrop-filter: blur(8px);
  box-shadow: var(--shadow-card);
  border: 1px solid var(--line);
  transition: transform 0.15s ease;
}
.tool:active {
  transform: scale(0.92);
}
.tool.disabled {
  opacity: 0.45;
  filter: grayscale(0.8);
}
.tool.disabled:active {
  transform: none;
}
.t-ico {
  font-size: 18px;
}
.t-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-2);
}
</style>
