<script setup lang="ts">
import StepShell from '@/components/StepShell/StepShell.vue'
import OptionCard from '@/components/OptionCard/OptionCard.vue'
import { SKIN_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
</script>

<template>
  <StepShell
    title="你的肤色更接近？"
    subtitle="对着自然光看手腕内侧，选最接近的一档"
  >
    <view class="options">
      <OptionCard
        v-for="opt in SKIN_OPTIONS"
        :key="opt.id"
        :option="opt"
        :selected="store.profile.skinTone === opt.id"
        @select="store.setSkin"
      />
    </view>
  </StepShell>
</template>

<style scoped>
.options {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 22rpx;
  padding: 2rpx 0 40rpx;
}
</style>
