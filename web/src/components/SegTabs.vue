<script setup lang="ts">
defineProps<{
  tabs: { key: string; label: string }[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', key: string): void
}>()
</script>

<template>
  <div class="seg">
    <button
      v-for="t in tabs"
      :key="t.key"
      class="seg-item"
      :class="{ on: modelValue === t.key }"
      @click="emit('update:modelValue', t.key)"
    >
      {{ t.label }}
    </button>
  </div>
</template>

<style scoped>
.seg {
  display: inline-flex;
  align-self: center;
  gap: 4px;
  padding: 4px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.6);
  box-shadow: var(--shadow-card);
}
.seg-item {
  padding: 8px 20px;
  border-radius: var(--radius-pill);
  font-size: 15px;
  font-weight: 700;
  color: var(--text-2);
  transition: all 0.2s ease;
}
.seg-item.on {
  background: var(--brand-gradient);
  color: #fff;
  box-shadow: 0 6px 14px rgba(177, 140, 255, 0.4);
}
</style>
