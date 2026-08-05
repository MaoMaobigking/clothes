<script setup lang="ts">
import StepShell from '@/components/StepShell/StepShell.vue'
import OptionCard from '@/components/OptionCard/OptionCard.vue'
import { FACE_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
</script>

<template>
  <StepShell title="你的脸型是？" subtitle="扎起头发对镜自拍，看轮廓最像哪种">
    <scroll-view scroll-x class="rail" :show-scrollbar="false">
      <view class="rail-inner">
        <OptionCard
          v-for="opt in FACE_OPTIONS"
          :key="opt.id"
          class="card"
          :option="opt"
          :selected="store.profile.faceShape === opt.id"
          @select="store.setFace"
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
