<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { STEPS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'

const store = useProfileStore()

const isLast = computed(() => store.currentStep === store.totalSteps)
const nextLabel = computed(() => (isLast.value ? '生成风格报告' : '下一步'))
const canSkip = computed(() => [2, 3, 5].includes(store.currentStep))
const skipLabel = computed(() => (store.currentStep === 5 ? '跳过未答题并生成' : '跳过'))

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
    const msg =
      store.currentStep === 1
        ? '风格需选满 3 项'
        : store.currentStep === 4
          ? '请确认性别、视觉体型、身高和体重'
          : '请至少答满 3 道偏好题'
    showHint(msg)
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
  uni.setStorageSync('ai-fashion-pending-report', '1')
  uni.navigateTo({ url: '/pages/result/index' })
}
</script>

<template>
  <view class="page">
    <AppHeader title="开始你的专属穿搭之旅" :current="store.currentStep" :total="store.totalSteps" @back="handleBack" />

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
      :show-skip="canSkip"
      :skip-label="skipLabel"
      @prev="store.goPrev"
      @next="handleNext"
      @skip="handleSkip"
    />

    <AiRecommendModal :visible="showAi" @view="viewReport" @close="showAi = false" />

    <view v-if="hint" class="hint-toast">{{ hint }}</view>
  </view>
</template>

<style scoped>
.slide-enter-active,
.slide-leave-active {
  transition:
    opacity 0.2s ease,
    transform 0.2s ease;
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
  bottom: 192rpx;
  left: 50%;
  z-index: 30;
  padding: 18rpx 32rpx;
  font-size: 26rpx;
  color: #fff;
  white-space: nowrap;
  background: rgb(47 47 58 / 86%);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-float);
  transform: translateX(-50%);
}
</style>
