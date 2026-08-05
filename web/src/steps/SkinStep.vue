<script setup lang="ts">
import StepShell from '@/components/StepShell.vue'
import OptionCard from '@/components/OptionCard.vue'
import { SKIN_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
</script>

<template>
  <StepShell
    title="你的肤色更接近？"
    subtitle="对着自然光看手腕内侧，选最接近的一档"
  >
    <div class="rail hide-scrollbar">
      <OptionCard
        v-for="opt in SKIN_OPTIONS"
        :key="opt.id"
        class="card"
        :option="opt"
        :selected="store.profile.skinTone === opt.id"
        @select="store.setSkin"
      />
    </div>
  </StepShell>
</template>

<style scoped>
.rail {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  padding: 4px 2px 12px;
  scroll-snap-type: x mandatory;
}
.card {
  flex: 0 0 132px;
  scroll-snap-align: start;
}
</style>
