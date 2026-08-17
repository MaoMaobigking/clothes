<script setup lang="ts">
import { FACE_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
</script>

<template>
  <StepShell title="你的脸型是？" subtitle="扎起头发对镜自拍，看轮廓最像哪种">
    <view class="options">
      <OptionCard
        v-for="opt in FACE_OPTIONS"
        :key="opt.id"
        :option="opt"
        :selected="store.profile.faceShape === opt.id"
        @select="store.setFace"
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
