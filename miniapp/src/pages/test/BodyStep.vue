<script setup lang="ts">
import StepShell from '@/components/StepShell/StepShell.vue'
import { BODY_FIELDS } from '@/data/questions'
import { useProfileStore } from '@/stores/profile'
import type { BodyMetricKey } from '@/types'

const store = useProfileStore()

function onInput(key: BodyMetricKey, e: Event) {
  store.setBody(key, Number((e.target as HTMLInputElement).value))
}

/** 滑块已拖到的百分比，用来给轨道上色 */
function percent(key: BodyMetricKey, min: number, max: number) {
  return ((store.profile.body[key] - min) / (max - min)) * 100
}

const bmiTip = (bmi: number) => {
  if (bmi < 18.5) return '偏瘦'
  if (bmi < 24) return '标准'
  if (bmi < 28) return '偏胖'
  return '超重'
}
</script>

<template>
  <StepShell title="填写你的身形数据" subtitle="拖动滑块即可，用于精准推荐版型尺码">
    <view class="fields">
      <view v-for="f in BODY_FIELDS" :key="f.key" class="field">
        <view class="row">
          <text class="name">{{ f.label }}</text>
          <text class="value">
            {{ store.profile.body[f.key] }}
            <text class="unit">{{ f.unit }}</text>
          </text>
        </view>
        <input
          class="slider"
          type="range"
          :min="f.min"
          :max="f.max"
          :step="f.step"
          :value="store.profile.body[f.key]"
          :style="{
            '--pct': percent(f.key, f.min, f.max) + '%',
          }"
          @input="onInput(f.key, $event)"
        />
      </view>
    </view>

    <!-- BMI 实时反馈 -->
    <view class="bmi-card">
      <view class="bmi-left">
        <text class="bmi-label">你的 BMI</text>
        <text class="bmi-num">{{ store.bmi }}</text>
      </view>
      <text class="bmi-tag">{{ bmiTip(store.bmi) }}</text>
    </view>
  </StepShell>
</template>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: 36rpx;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 36rpx 32rpx;
  box-shadow: var(--shadow-card);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
  color: var(--text-1);
}
.value {
  font-size: 36rpx;
  font-weight: 800;
  color: var(--purple-deep);
}
.unit {
  font-size: 24rpx;
  font-weight: 600;
  font-style: normal;
  color: var(--text-3);
  margin-left: 4rpx;
}

/* 滑块：用 --pct 给已划过的轨道上色 */
.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 16rpx;
  border-radius: 999rpx;
  background: linear-gradient(
    to right,
    var(--pink) 0%,
    var(--purple) var(--pct),
    #ece7f5 var(--pct),
    #ece7f5 100%
  );
  outline: none;
}
.slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #fff;
  border: 6rpx solid var(--pink);
  box-shadow: 0 6rpx 16rpx rgba(255, 126, 179, 0.5);
  cursor: pointer;
}
.slider::-moz-range-thumb {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #fff;
  border: 6rpx solid var(--pink);
  box-shadow: 0 6rpx 16rpx rgba(255, 126, 179, 0.5);
  cursor: pointer;
}

.bmi-card {
  margin-top: 32rpx;
  background: var(--brand-gradient);
  border-radius: var(--radius);
  padding: 32rpx 36rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  box-shadow: var(--shadow-float);
}
.bmi-left {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.bmi-label {
  font-size: 24rpx;
  opacity: 0.9;
}
.bmi-num {
  font-size: 56rpx;
  font-weight: 800;
}
.bmi-tag {
  background: rgba(255, 255, 255, 0.25);
  padding: 12rpx 28rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
