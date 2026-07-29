<script setup lang="ts">
import { computed } from 'vue'
import StepShell from '@/components/StepShell.vue'
import { PREFERENCE_QUESTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()

const answered = computed(() => Object.keys(store.profile.preferences).length)
const subtitle = computed(
  () => `共 ${PREFERENCE_QUESTIONS.length} 题，已答 ${answered.value} 题`,
)
</script>

<template>
  <StepShell title="最后几个小问题" :subtitle="subtitle">
    <div class="q-list">
      <div v-for="q in PREFERENCE_QUESTIONS" :key="q.id" class="q-card">
        <p class="q-title">{{ q.title }}</p>
        <div class="chips">
          <button
            v-for="opt in q.options"
            :key="opt.id"
            class="chip"
            :class="{ on: store.profile.preferences[q.id] === opt.id }"
            @click="store.setPreference(q.id, opt.id)"
          >
            <span class="chip-emoji">{{ opt.emoji }}</span>
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>
  </StepShell>
</template>

<style scoped>
.q-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.q-card {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow-card);
}
.q-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text-1);
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 9px 16px;
  border-radius: 999px;
  background: #f4f0fb;
  color: var(--text-2);
  font-size: 14px;
  font-weight: 600;
  border: 2px solid transparent;
  transition: all 0.15s ease;
}
.chip:active {
  transform: scale(0.96);
}
.chip.on {
  background: rgba(255, 126, 179, 0.12);
  border-color: var(--pink);
  color: var(--pink-deep);
}
.chip-emoji {
  font-size: 15px;
}
</style>
