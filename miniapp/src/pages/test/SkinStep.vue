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
    <scroll-view scroll-x class="rail" :show-scrollbar="false">
      <view class="rail-inner">
        <OptionCard
          v-for="opt in SKIN_OPTIONS"
          :key="opt.id"
          class="card"
          :option="opt"
          :selected="store.profile.skinTone === opt.id"
          @select="store.setSkin"
        />
      </view>
    </scroll-view>
  </StepShell>
</template>

<style scoped>
.rail {
  width: 100%;
  white-space: nowrap;
}
.rail-inner {
  display: inline-flex;
  gap: 24rpx;
  padding: 4rpx 2rpx 12rpx;
}
.card {
  flex: 0 0 264rpx;
}
</style>
