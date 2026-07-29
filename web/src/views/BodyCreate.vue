<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import StepIndicator from '@/components/StepIndicator.vue'
import StepFooter from '@/components/StepFooter.vue'
import AiRecommendModal from '@/components/AiRecommendModal.vue'
import StyleStep from '@/steps/StyleStep.vue'
import SkinStep from '@/steps/SkinStep.vue'
import FaceStep from '@/steps/FaceStep.vue'
import BodyStep from '@/steps/BodyStep.vue'
import PrefStep from '@/steps/PrefStep.vue'
import { STEPS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const router = useRouter()
const store = useProfileStore()

// 第几步 -> 对应的步骤组件
const STEP_COMPONENTS = [StyleStep, SkinStep, FaceStep, BodyStep, PrefStep]
const currentComponent = computed(() => STEP_COMPONENTS[store.currentStep - 1])

const isLast = computed(() => store.currentStep === store.totalSteps)
const nextLabel = computed(() => (isLast.value ? '生成风格报告' : '下一步'))

const showAi = ref(false)

function handleNext() {
  if (isLast.value) {
    // 最后一步 -> 弹出 AI 推荐
    showAi.value = true
  } else {
    store.goNext()
  }
}

function handleSkip() {
  if (isLast.value) showAi.value = true
  else store.goNext()
}

function handleBack() {
  if (store.currentStep > 1) store.goPrev()
  else router.push('/home')
}

// 步骤指示器点击：只允许回到已经走过的步骤
function jumpTo(step: number) {
  if (step <= store.currentStep) store.goto(step)
}

function viewReport() {
  showAi.value = false
  router.push('/result')
}
</script>

<template>
  <div class="page">
    <AppHeader
      title="开始你的专属穿搭之旅"
      :current="store.currentStep"
      :total="store.totalSteps"
      @back="handleBack"
    />

    <StepIndicator :steps="STEPS" :current="store.currentStep" @select="jumpTo" />

    <!-- 当前步骤内容（带左右滑动切换） -->
    <transition name="slide" mode="out-in">
      <component :is="currentComponent" :key="store.currentStep" />
    </transition>

    <StepFooter
      :current="store.currentStep"
      :total="store.totalSteps"
      :can-next="store.canProceed"
      :next-label="nextLabel"
      @prev="store.goPrev"
      @next="handleNext"
      @skip="handleSkip"
    />

    <AiRecommendModal
      :visible="showAi"
      @view="viewReport"
      @close="showAi = false"
    />
  </div>
</template>

<style scoped>
.page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.slide-enter-active,
.slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.slide-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.slide-leave-to {
  opacity: 0;
  transform: translateX(-24px);
}
</style>
