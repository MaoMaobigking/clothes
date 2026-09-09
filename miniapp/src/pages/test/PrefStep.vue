<script setup lang="ts">
import { computed } from 'vue'
import { PREFERENCE_QUESTIONS } from '@/constants/questions'
import { useProfileStore } from '@/stores/profile'
import { iconForEmoji } from '@/utils/icons'

const store = useProfileStore()

const answered = computed(() => Object.keys(store.profile.preferences).length)
const subtitle = computed(() => `共 ${PREFERENCE_QUESTIONS.length} 题，已答 ${answered.value} 题`)
</script>

<template>
  <StepShell title="最后几个小问题" :subtitle="subtitle">
    <view class="q-list">
      <view v-for="q in PREFERENCE_QUESTIONS" :key="q.id" class="q-card">
        <view class="q-title">{{ q.title }}</view>
        <view class="chips">
          <view
            v-for="opt in q.options"
            :key="opt.id"
            class="chip"
            :class="{ on: store.profile.preferences[q.id] === opt.id }"
            @tap="store.setPreference(q.id, opt.id)"
          >
            <UiIcon class="chip-emoji" :name="iconForEmoji(opt.emoji) ?? 'star'" :size="30" tone="soft" />
            {{ opt.label }}
          </view>
        </view>
      </view>
    </view>
  </StepShell>
</template>

<style scoped>
.q-list {
  display: flex;
  flex-direction: column;
  gap: 28rpx;
}

.q-card {
  padding: 32rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.q-title {
  margin: 0 0 24rpx;
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--text-1);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;
}

.chip {
  gap: 10rpx;
  padding: 18rpx 32rpx;
  font-size: var(--fs-lg);
  font-weight: 500;
  background: var(--surface-tint);
  border: 4rpx solid transparent;
  transition: all 0.15s ease;
}

.chip:active {
  transform: scale(0.96);
}

.chip.on {
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-color: var(--pink);
}

.chip-emoji {
  font-size: var(--fs-xl);
}
</style>
