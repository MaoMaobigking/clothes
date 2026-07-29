<script setup lang="ts">
import StepShell from '@/components/StepShell.vue'
import OptionCard from '@/components/OptionCard.vue'
import { FACE_OPTIONS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()
</script>

<template>
  <StepShell title="你的脸型是？" subtitle="扎起头发对镜自拍，看轮廓最像哪种">
    <div class="grid">
      <OptionCard
        v-for="opt in FACE_OPTIONS"
        :key="opt.id"
        :option="opt"
        :selected="store.profile.faceShape === opt.id"
        @select="store.setFace"
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
