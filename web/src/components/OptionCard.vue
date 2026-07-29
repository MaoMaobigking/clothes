<script setup lang="ts">
import type { Option } from '@/types'

withDefaults(
  defineProps<{
    option: Option
    selected: boolean
    /** 选中角标里显示的序号（风格多选时用），不传则显示对勾 */
    order?: number
  }>(),
  { order: undefined },
)

const emit = defineEmits<{
  (e: 'select', id: string): void
}>()
</script>

<template>
  <button
    class="card"
    :class="{ selected }"
    @click="emit('select', option.id)"
  >
    <!-- 预览色块 + emoji -->
    <div class="preview" :style="{ background: option.color || 'var(--line)' }">
      <span v-if="option.emoji" class="emoji">{{ option.emoji }}</span>
    </div>

    <div class="meta">
      <span class="label">{{ option.label }}</span>
      <span v-if="option.desc" class="desc">{{ option.desc }}</span>
    </div>

    <!-- 选中角标 -->
    <span v-if="selected" class="badge">
      <template v-if="order !== undefined">{{ order }}</template>
      <template v-else>✓</template>
    </span>
  </button>
</template>

<style scoped>
.card {
  position: relative;
  width: 100%;
  text-align: left;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 10px;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  gap: 8px;
  border: 2px solid transparent;
  transition:
    transform 0.15s ease,
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}
.card:active {
  transform: scale(0.97);
}
.card.selected {
  border-color: var(--pink);
  box-shadow: 0 10px 24px rgba(255, 126, 179, 0.28);
}

.preview {
  width: 100%;
  aspect-ratio: 1.35 / 1;
  border-radius: 12px;
  display: grid;
  place-items: center;
}
.emoji {
  font-size: 34px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.12));
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 0 2px 2px;
}
.label {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}
.desc {
  font-size: 12px;
  color: var(--text-3);
}

.badge {
  position: absolute;
  top: 8px;
  right: 8px;
  min-width: 24px;
  height: 24px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 13px;
  font-weight: 800;
  display: grid;
  place-items: center;
  box-shadow: 0 4px 10px rgba(177, 140, 255, 0.5);
}
</style>
