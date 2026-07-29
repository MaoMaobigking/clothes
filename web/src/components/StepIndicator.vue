<script setup lang="ts">
import type { StepMeta } from '@/types'

defineProps<{
  steps: StepMeta[]
  /** 当前步（1 起） */
  current: number
}>()

const emit = defineEmits<{
  (e: 'select', step: number): void
}>()
</script>

<template>
  <nav class="steps hide-scrollbar">
    <button
      v-for="(s, i) in steps"
      :key="s.key"
      class="step"
      :class="{
        active: current === i + 1,
        done: current > i + 1,
      }"
      @click="emit('select', i + 1)"
    >
      <span class="dot">
        <span v-if="current > i + 1" class="check">✓</span>
        <span v-else class="emoji">{{ s.emoji }}</span>
      </span>
      <span class="label">{{ s.title }}</span>
    </button>
  </nav>
</template>

<style scoped>
.steps {
  display: flex;
  gap: 6px;
  padding: 4px 16px 12px;
  overflow-x: auto;
  flex-shrink: 0;
}

.step {
  flex: 1 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  min-width: 56px;
  opacity: 0.55;
  transition: opacity 0.2s ease;
}
.step.active,
.step.done {
  opacity: 1;
}

.dot {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(255, 255, 255, 0.75);
  box-shadow: var(--shadow-card);
  font-size: 20px;
  transition: transform 0.2s ease, background 0.2s ease;
}
.step.active .dot {
  background: var(--brand-gradient);
  transform: scale(1.08);
}
.step.done .dot {
  background: var(--mint);
}

.check {
  color: #fff;
  font-weight: 800;
  font-size: 18px;
}

.label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
}
.step.active .label {
  color: var(--purple-deep);
}
</style>
