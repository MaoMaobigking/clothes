<script setup lang="ts">
import { computed } from 'vue'
import StepShell from '@/components/StepShell/StepShell.vue'
import OptionCard from '@/components/OptionCard/OptionCard.vue'
import { STYLE_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()

const subtitle = computed(
  () => `至少选择 3 项，可多选（已选 ${store.profile.styles.length} 项）`,
)

function orderOf(id: string) {
  const i = store.profile.styles.indexOf(id)
  return i >= 0 ? i + 1 : undefined
}
</script>

<template>
  <StepShell title="你喜欢哪种穿衣风格？" :subtitle="subtitle">
    <view class="grid">
      <OptionCard
        v-for="opt in STYLE_OPTIONS"
        :key="opt.id"
        :option="opt"
        :selected="store.profile.styles.includes(opt.id)"
        :order="orderOf(opt.id)"
        @select="store.toggleStyle"
      />
    </view>
  </StepShell>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 24rpx;
}
</style>
