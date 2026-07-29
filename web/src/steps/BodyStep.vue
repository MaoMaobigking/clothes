<script setup lang="ts">
import StepShell from '@/components/StepShell.vue'
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
    <div class="fields">
      <div v-for="f in BODY_FIELDS" :key="f.key" class="field">
        <div class="row">
          <span class="name">{{ f.label }}</span>
          <span class="value">
            {{ store.profile.body[f.key] }}
            <em>{{ f.unit }}</em>
          </span>
        </div>
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
      </div>
    </div>

    <!-- BMI 实时反馈 -->
    <div class="bmi-card">
      <div class="bmi-left">
        <span class="bmi-label">你的 BMI</span>
        <span class="bmi-num">{{ store.bmi }}</span>
      </div>
      <span class="bmi-tag">{{ bmiTip(store.bmi) }}</span>
    </div>
  </StepShell>
</template>

<style scoped>
.fields {
  display: flex;
  flex-direction: column;
  gap: 18px;
  background: var(--surface);
  border-radius: var(--radius);
  padding: 18px 16px;
  box-shadow: var(--shadow-card);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-1);
}
.value {
  font-size: 18px;
  font-weight: 800;
  color: var(--purple-deep);
}
.value em {
  font-size: 12px;
  font-weight: 600;
  font-style: normal;
  color: var(--text-3);
  margin-left: 2px;
}

/* 滑块：用 --pct 给已划过的轨道上色 */
.slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 999px;
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
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--pink);
  box-shadow: 0 3px 8px rgba(255, 126, 179, 0.5);
  cursor: pointer;
}
.slider::-moz-range-thumb {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #fff;
  border: 3px solid var(--pink);
  box-shadow: 0 3px 8px rgba(255, 126, 179, 0.5);
  cursor: pointer;
}

.bmi-card {
  margin-top: 16px;
  background: var(--brand-gradient);
  border-radius: var(--radius);
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #fff;
  box-shadow: var(--shadow-float);
}
.bmi-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.bmi-label {
  font-size: 12px;
  opacity: 0.9;
}
.bmi-num {
  font-size: 28px;
  font-weight: 800;
}
.bmi-tag {
  background: rgba(255, 255, 255, 0.25);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 700;
}
</style>
