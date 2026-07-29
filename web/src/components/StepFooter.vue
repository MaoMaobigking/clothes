<script setup lang="ts">
withDefaults(
  defineProps<{
    current: number
    total: number
    canNext: boolean
    nextLabel?: string
    showPrev?: boolean
    showSkip?: boolean
  }>(),
  {
    nextLabel: '下一步',
    showPrev: true,
    showSkip: true,
  },
)

const emit = defineEmits<{
  (e: 'prev'): void
  (e: 'next'): void
  (e: 'skip'): void
}>()
</script>

<template>
  <footer class="footer">
    <!-- 圆点进度 -->
    <div class="dots">
      <span
        v-for="n in total"
        :key="n"
        class="dot"
        :class="{ on: n === current, passed: n < current }"
      />
    </div>

    <div class="actions">
      <button
        v-if="showPrev && current > 1"
        class="btn btn-ghost prev"
        @click="emit('prev')"
      >
        上一步
      </button>

      <button class="btn btn-primary next" :disabled="!canNext" @click="emit('next')">
        {{ nextLabel }}
      </button>

      <button v-if="showSkip" class="btn btn-text skip" @click="emit('skip')">
        跳过
      </button>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  flex-shrink: 0;
  padding: 12px 16px calc(12px + var(--safe-bottom));
  background: linear-gradient(180deg, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.55) 40%);
}

.dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 12px;
}
.dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: rgba(154, 107, 255, 0.28);
  transition: all 0.25s ease;
}
.dot.on {
  width: 20px;
  background: var(--purple-deep);
}
.dot.passed {
  background: var(--mint-deep);
}

.actions {
  display: flex;
  align-items: center;
  gap: 10px;
}
.prev {
  flex: 0 0 auto;
  padding: 0 20px;
}
.next {
  flex: 1;
}
.skip {
  flex: 0 0 auto;
}
</style>
