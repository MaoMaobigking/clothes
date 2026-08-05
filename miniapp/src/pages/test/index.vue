<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import AppHeader from '@/components/AppHeader/AppHeader.vue'
import StepIndicator from '@/components/StepIndicator/StepIndicator.vue'
import StepFooter from '@/components/StepFooter/StepFooter.vue'
import AiRecommendModal from '@/components/AiRecommendModal/AiRecommendModal.vue'
import StyleStep from './StyleStep.vue'
import SkinStep from './SkinStep.vue'
import FaceStep from './FaceStep.vue'
import BodyStep from './BodyStep.vue'
import PrefStep from './PrefStep.vue'
import { STEPS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()

const isLast = computed(() => store.currentStep === store.totalSteps)
const nextLabel = computed(() => (isLast.value ? '生成风格报告' : '下一步'))

const showAi = ref(false)
const hint = ref('')
let hintTimer: number | undefined

function showHint(msg: string) {
  hint.value = msg
  clearTimeout(hintTimer)
  hintTimer = setTimeout(() => {
    hint.value = ''
  }, 1800)
}

onLoad((options) => {
  store.loadPersisted()
  const step = Number(options?.step)
  if (step >= 1 && step <= store.totalSteps) store.goto(step)
})

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
  else uni.navigateBack()
}

// 步骤指示器点击：只允许回到已经走过的步骤
function jumpTo(step: number) {
  if (step <= store.currentStep) store.goto(step)
}

function viewReport() {
  showAi.value = false
  store.persist()
  uni.navigateTo({ url: '/pages/result/index' })
}
</script>

<template>
  <view class="page">
    <AppHeader
      title="开始你的专属穿搭之旅"
      :current="store.currentStep"
      :total="store.totalSteps"
      @back="handleBack"
    />

    <StepIndicator :steps="STEPS" :current="store.currentStep" @select="jumpTo" />

    <!-- 当前步骤内容（条件渲染，兼容小程序） -->
    <transition name="slide" mode="out-in">
      <StyleStep v-if="store.currentStep === 1" :key="1" />
      <SkinStep v-else-if="store.currentStep === 2" :key="2" />
      <FaceStep v-else-if="store.currentStep === 3" :key="3" />
      <BodyStep v-else-if="store.currentStep === 4" :key="4" />
      <PrefStep v-else :key="5" />
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

    <view v-if="hint" class="hint-toast">{{ hint }}</view>
  </view>
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
  transform: translateX(48rpx);
}
.slide-leave-to {
  opacity: 0;
  transform: translateX(-48rpx);
}

.hint-toast {
  position: absolute;
  left: 50%;
  bottom: 192rpx;
  transform: translateX(-50%);
  z-index: 30;
  padding: 18rpx 32rpx;
  border-radius: 999rpx;
  background: rgba(47, 47, 58, 0.86);
  color: #fff;
  font-size: 26rpx;
  white-space: nowrap;
  box-shadow: var(--shadow-float);
}
</style>
