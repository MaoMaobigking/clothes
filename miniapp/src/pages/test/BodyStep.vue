<script setup lang="ts">
import { iconForEmoji } from '@/utils/icons'
import { reactive } from 'vue'
import { BODY_FIELDS, VISUAL_BODY_OPTIONS } from '@/constants/questions'
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
  <StepShell title="描述你的身形" subtitle="先选视觉体型，再确认性别、身高和体重">
    <view class="section">
      <view class="section-title">视觉体型</view>
      <scroll-view scroll-x class="body-options" :show-scrollbar="false">
        <view class="body-options-row">
          <view
            v-for="opt in VISUAL_BODY_OPTIONS"
            :key="opt.id"
            class="body-option"
            :class="{ on: store.profile.visualBody === opt.id }"
            @tap="store.setVisualBody(opt.id)"
          >
            <view class="body-preview" :style="{ background: opt.color }">
              <image
                v-if="opt.img && !imgFailed[opt.id]"
                class="body-preview-img"
                :src="opt.img"
                mode="aspectFill"
                @error="imgFailed[opt.id] = true"
              />
              <UiIcon
                v-else
                class="body-emoji"
                :name="iconForEmoji(opt.emoji) ?? 'body'"
                :size="64"
                tone="muted"
                :stroke-width="1.4"
              />
            </view>
            <text class="body-label">{{ opt.label }}</text>
            <text class="body-desc">{{ opt.desc }}</text>
            <view v-if="store.profile.visualBody === opt.id" class="check">✓</view>
          </view>
        </view>
      </scroll-view>
    </view>

    <view class="section">
      <view class="section-title">性别</view>
      <view class="gender-options">
        <view class="gender-option" :class="{ on: store.profile.gender === 'female' }" @tap="chooseGender('female')">
          <UiIcon class="gender-emoji" name="me" :size="56" tone="soft" />
          <text>女</text>
        </view>
        <view class="gender-option" :class="{ on: store.profile.gender === 'male' }" @tap="chooseGender('male')">
          <UiIcon class="gender-emoji" name="me" :size="56" tone="soft" />
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
        <view v-for="f in BODY_FIELDS" :key="f.key" class="field" :class="{ optional: !requiredMet(f.key) }">
          <view class="row">
            <text class="name">
              {{ f.label }}
              <text v-if="f.key === 'height' || f.key === 'weight'" class="required-dot">*</text>
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
  display: flex;
  gap: 12rpx;
  align-items: center;
  margin-bottom: 20rpx;
}

.required {
  padding: 4rpx 14rpx;
  font-size: var(--fs-xs);
  color: var(--pink-deep);
  background: rgb(255 92 157 / 12%);
  border-radius: var(--radius-pill);
}

/*
 * 视觉体型改横滑（客户需求原文「选项卡片（横向滑动）」，与前三步统一）。
 * 内层 inline-flex 的理由同 StyleStep：flex 写在 scroll-view 本体上安卓会压扁子项。
 */
.body-options {
  width: 100%;
  white-space: nowrap;
}

.body-options-row {
  display: inline-flex;
  gap: 18rpx;
  padding-bottom: 4rpx;
}

.body-option {
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  flex-direction: column;
  align-items: center;
  width: 208rpx;
  padding: 20rpx 14rpx;
  text-align: center;
  background: var(--surface);
  border: 3rpx solid transparent;
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
  transition:
    transform 0.15s ease,
    border-color 0.15s ease;
}

.body-option:active {
  transform: scale(0.96);
}

.body-option.on {
  border-color: var(--pink);
}

.body-preview {
  display: grid;
  place-items: center;
  width: 88rpx;
  height: 88rpx;
  margin-bottom: 12rpx;
  overflow: hidden;
  border-radius: var(--radius-lg);
}

.body-preview-img {
  width: 100%;
  height: 100%;
}

.body-emoji {
  font-size: 46rpx;
}

.body-label {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--text-1);
}

.body-desc {
  margin-top: 8rpx;
  font-size: var(--fs-xs);
  line-height: 1.35;
  color: var(--text-3);
}

.check {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 34rpx;
  height: 34rpx;
  font-size: var(--fs-sm);
  font-weight: 500;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: 50%;
}

.gender-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20rpx;
}

.gender-option {
  display: flex;
  gap: 12rpx;
  align-items: center;
  justify-content: center;
  height: 108rpx;
  font-size: var(--fs-xl);
  font-weight: 700;
  color: var(--text-2);
  background: var(--surface);
  border: 3rpx solid var(--line);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-card);
}

.gender-option.on {
  color: var(--pink-deep);
  background: var(--pink-soft);
  border-color: var(--pink);
}

.gender-emoji {
  font-size: 40rpx;
}

.fields {
  padding: 8rpx 30rpx 32rpx;
  background: var(--surface);
  border-radius: var(--radius);
  box-shadow: var(--shadow-card);
}

.field {
  padding-top: 26rpx;
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.name {
  font-size: var(--fs-lg);
  font-weight: 700;
  color: var(--text-1);
}

.required-dot {
  margin-left: 4rpx;
  color: var(--pink-deep);
}

.done-dot {
  margin-left: 10rpx;
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--mint-deep);
}

.value {
  font-size: var(--fs-2xl);
  font-weight: 500;
  color: var(--purple-deep);
}

.unit {
  margin-left: 4rpx;
  font-size: var(--fs-sm);
  color: var(--text-3);
}

.slider {
  width: 100%;
  min-height: 48rpx;
  margin-top: 18rpx;
}

.optional-hint {
  margin-top: 18rpx;
  font-size: var(--fs-sm);
  color: var(--text-3);
  text-align: right;
}

.bmi-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 30rpx 34rpx;
  margin-top: 4rpx;
  color: #fff;
  background: var(--brand-gradient);
  border-radius: var(--radius);
  box-shadow: var(--shadow-float);
}

.bmi-left {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}

.bmi-label {
  font-size: var(--fs-base);
  opacity: 0.9;
}

.bmi-num {
  font-size: 52rpx;
  font-weight: 500;
}

.bmi-tag {
  padding: 12rpx 26rpx;
  font-size: var(--fs-lg);
  font-weight: 700;
  background: rgb(255 255 255 / 25%);
  border-radius: var(--radius-pill);
}
</style>
