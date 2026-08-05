<script setup lang="ts">
import StepShell from '@/components/StepShell.vue'
import OptionCard from '@/components/OptionCard.vue'
import { FACE_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
</script>

<template>
  <StepShell title="你的脸型是？" subtitle="扎起头发对镜自拍，看轮廓最像哪种">
    <div class="rail hide-scrollbar">
      <OptionCard
        v-for="opt in FACE_OPTIONS"
        :key="opt.id"
        class="card"
        :option="opt"
        :selected="store.profile.faceShape === opt.id"
        @select="store.setFace"
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
