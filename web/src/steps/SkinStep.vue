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
    <div class="grid">
      <OptionCard
        v-for="opt in SKIN_OPTIONS"
        :key="opt.id"
        :option="opt"
        :selected="store.profile.skinTone === opt.id"
        @select="store.setSkin"
      />
    </div>
  </StepShell>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}
</style>
