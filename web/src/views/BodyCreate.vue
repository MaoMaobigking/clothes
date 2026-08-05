<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
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
const route = useRoute()
const store = useProfileStore()

// 第几步 -> 对应的步骤组件
const STEP_COMPONENTS = [StyleStep, SkinStep, FaceStep, BodyStep, PrefStep]
const currentComponent = computed(() => STEP_COMPONENTS[store.currentStep - 1])

const isLast = computed(() => store.currentStep === store.totalSteps)
const nextLabel = computed(() => (isLast.value ? '生成风格报告' : '下一步'))

const showAi = ref(false)
const hint = ref('')
let hintTimer: number | undefined

function showHint(msg: string) {
  hint.value = msg
  window.clearTimeout(hintTimer)
  hintTimer = window.setTimeout(() => {
    hint.value = ''
  }, 1800)
}

function handleNext() {
  if (isLast.value) finishOrWarn()
  else store.goNext()
}

function handleSkip() {
  if (isLast.value) finishOrWarn()
  else store.goNext()
}

function finishOrWarn() {
  if (store.isComplete) {
    store.persist()
    showAi.value = true
  } else {
    showHint(`还剩 ${store.missingCount} 项未完成`)
  }
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
  store.persist()
  router.push('/result')
}

onMounted(() => {
  store.loadPersisted()
  const step = Number(route.query.step)
  if (step >= 1 && step <= store.totalSteps) store.goto(step)
})
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

    <transition name="toast">
      <div v-if="hint" class="hint-toast">{{ hint }}</div>
    </transition>
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

.hint-toast {
  position: absolute;
  left: 50%;
  bottom: 96px;
  transform: translateX(-50%);
  z-index: 30;
  padding: 9px 16px;
  border-radius: 999px;
  background: rgba(47, 47, 58, 0.86);
  color: #fff;
  font-size: 13px;
  white-space: nowrap;
  box-shadow: var(--shadow-float);
}
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, 6px);
}
</style>
