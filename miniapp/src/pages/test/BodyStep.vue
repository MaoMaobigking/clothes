<script setup lang="ts">
import { reactive } from 'vue'
import StepShell from '@/components/StepShell/StepShell.vue'
import {
  BODY_FIELDS,
  VISUAL_BODY_OPTIONS,
} from '@/data/questions'
import { useProfileStore } from '@/stores/profile'
import type { BodyMetricKey, Gender } from '@/types'

const store = useProfileStore()

/** 体型小图缺素材时回落到色块 + emoji（规格 §7.4） */
const imgFailed = reactive<Record<string, boolean>>({})

function onSliderChange(key: BodyMetricKey, event: any) {
  const value = Number(event?.detail?.value ?? event?.target?.value)
  if (Number.isFinite(value)) store.setBody(key, value)
}

function chooseGender(gender: Gender) {
  store.setGender(gender)
}

function requiredMet(key: BodyMetricKey) {
  if (key === 'height') return store.profile.progress.heightTouched
  if (key === 'weight') return store.profile.progress.weightTouched
  return true
}

const bmiTip = (bmi: number) => {
  if (bmi < 18.5) return '偏瘦'
  if (bmi < 24) return '标准'
  if (bmi < 28) return '偏胖'
  return '超重'
}
</script>

<template>
  <StepShell
    title="描述你的身形"
    subtitle="先选视觉体型，再确认性别、身高和体重"
  >
    <view class="section">
      <view class="section-title">视觉体型</view>
      <view class="body-options">
        <view
          v-for="opt in VISUAL_BODY_OPTIONS"
          :key="opt.id"
          class="body-option"
          :class="{ on: store.profile.visualBody === opt.id }"
          @tap="store.setVisualBody(opt.id)"
        >
          <view
            class="body-preview"
            :style="{ background: opt.color }"
          >
            <image
              v-if="opt.img && !imgFailed[opt.id]"
              class="body-preview-img"
              :src="opt.img"
              mode="aspectFill"
              @error="imgFailed[opt.id] = true"
            />
            <text v-else class="body-emoji">{{ opt.emoji }}</text>
          </view>
          <text class="body-label">{{ opt.label }}</text>
          <text class="body-desc">{{ opt.desc }}</text>
          <view v-if="store.profile.visualBody === opt.id" class="check">✓</view>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">性别</view>
      <view class="gender-options">
        <view
          class="gender-option"
          :class="{ on: store.profile.gender === 'female' }"
          @tap="chooseGender('female')"
        >
          <text class="gender-emoji">👩</text>
          <text>女</text>
        </view>
        <view
          class="gender-option"
          :class="{ on: store.profile.gender === 'male' }"
          @tap="chooseGender('male')"
        >
          <text class="gender-emoji">👨</text>
          <text>男</text>
        </view>
      </view>
    </view>

    <view class="section">
      <view class="section-title">
        身高与体重
        <text class="required">必填</text>
      </view>
      <view class="fields">
        <view
          v-for="f in BODY_FIELDS"
          :key="f.key"
          class="field"
          :class="{ optional: !requiredMet(f.key) }"
        >
          <view class="row">
            <text class="name">
              {{ f.label }}
              <text
                v-if="f.key === 'height' || f.key === 'weight'"
                class="required-dot"
              >
                *
              </text>
              <text v-if="requiredMet(f.key)" class="done-dot">✓</text>
            </text>
            <text class="value">
              {{ store.profile.body[f.key] }}
              <text class="unit">{{ f.unit }}</text>
            </text>
          </view>
          <slider
            class="slider"
            :min="f.min"
            :max="f.max"
            :step="f.step"
            :value="store.profile.body[f.key]"
            :activeColor="f.key === 'height' || f.key === 'weight' ? '#ff5c9d' : '#b892ff'"
            backgroundColor="#ece7f5"
            block-color="#ffffff"
            :block-size="22"
            @change="onSliderChange(f.key, $event)"
          />
        </view>
      </view>
      <view class="optional-hint">胸围、腰围、臀围、肩宽及其他围度为可选项。</view>
    </view>

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
.section {
  margin-bottom: 30rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 800;
  color: var(--text-1);
  margin-bottom: 20rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.required {
  font-size: 20rpx;
  color: var(--pink-deep);
  background: rgba(255, 92, 157, 0.12);
  padding: 4rpx 14rpx;
  border-radius: 999rpx;
}

.body-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18rpx;
}
.body-option {
  position: relative;
  background: var(--surface);
  border: 3rpx solid transparent;
  border-radius: var(--radius-sm);
  padding: 20rpx 14rpx;
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  transition: transform 0.15s ease, border-color 0.15s ease;
}
.body-option:active {
  transform: scale(0.96);
}
.body-option.on {
  border-color: var(--pink);
}
.body-preview {
  width: 88rpx;
  height: 88rpx;
  border-radius: 28rpx;
  display: grid;
  place-items: center;
  margin-bottom: 12rpx;
  overflow: hidden;
}
.body-preview-img {
  width: 100%;
  height: 100%;
}
.body-emoji {
  font-size: 46rpx;
}
.body-label {
  font-size: 26rpx;
  font-weight: 800;
  color: var(--text-1);
}
.body-desc {
  font-size: 20rpx;
  color: var(--text-3);
  margin-top: 8rpx;
  line-height: 1.35;
}
.check {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 34rpx;
  height: 34rpx;
  border-radius: 50%;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 22rpx;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gender-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}
.gender-option {
  height: 108rpx;
  border-radius: var(--radius-sm);
  background: var(--surface);
  border: 3rpx solid var(--line);
  box-shadow: var(--shadow-card);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  color: var(--text-2);
  font-size: 30rpx;
  font-weight: 700;
}
.gender-option.on {
  border-color: var(--pink);
  color: var(--pink-deep);
  background: rgba(255, 126, 179, 0.09);
}
.gender-emoji {
  font-size: 40rpx;
}

.fields {
  background: var(--surface);
  border-radius: var(--radius);
  padding: 8rpx 30rpx 32rpx;
  box-shadow: var(--shadow-card);
}
.field {
  padding-top: 26rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.name {
  font-size: 28rpx;
  font-weight: 700;
  color: var(--text-1);
}
.required-dot {
  color: var(--pink-deep);
  margin-left: 4rpx;
}
.done-dot {
  color: var(--mint-deep);
  margin-left: 10rpx;
  font-size: 24rpx;
  font-weight: 800;
}
.value {
  font-size: 32rpx;
  font-weight: 800;
  color: var(--purple-deep);
}
.unit {
  font-size: 22rpx;
  color: var(--text-3);
  margin-left: 4rpx;
}

.slider {
  width: 100%;
  margin-top: 18rpx;
  min-height: 48rpx;
}

.optional-hint {
  margin-top: 18rpx;
  font-size: 22rpx;
  color: var(--text-3);
  text-align: right;
}

.bmi-card {
  background: var(--brand-gradient);
  border-radius: var(--radius);
  padding: 30rpx 34rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  box-shadow: var(--shadow-float);
  margin-top: 4rpx;
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
  font-size: 52rpx;
  font-weight: 800;
}
.bmi-tag {
  background: rgba(255, 255, 255, 0.25);
  padding: 12rpx 26rpx;
  border-radius: 999rpx;
  font-size: 28rpx;
  font-weight: 700;
}
</style>
