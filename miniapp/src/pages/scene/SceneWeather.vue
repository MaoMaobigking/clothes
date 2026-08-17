<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchSceneWeather, type SceneWeatherInfo } from '@/api/scene'
import { iconForEmoji } from '@/utils/icons'
import { MANUAL_WEATHER } from '@/data/scene'

const props = withDefaults(
  defineProps<{
    modelValue: SceneWeatherInfo
  }>(),
  {
    modelValue: () => ({
      city: '杭州',
      temp: 20,
      condition: '多云',
      icon: '⛅',
      source: 'fallback',
    }),
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: SceneWeatherInfo): void
  (e: 'change', value: SceneWeatherInfo): void
}>()

const weather = ref<SceneWeatherInfo>({ ...props.modelValue })

/** 天气接口和 MANUAL_WEATHER 里存的都还是 emoji，查表换成线性图标 */
const weatherIcon = computed(() => iconForEmoji(weather.value.icon) ?? 'w-cloud')
const locating = ref(false)
const editing = ref(false)
const locationMessage = ref('')
const manualCityIndex = ref(0)
const manualConditionIndex = ref(0)
const manualTemp = ref(String(props.modelValue.temp || 20))

const CONDITIONS = [
  { condition: '晴', icon: '☀️' },
  { condition: '多云', icon: '⛅' },
  { condition: '阴', icon: '☁️' },
  { condition: '小雨', icon: '🌦️' },
  { condition: '大雨', icon: '🌧️' },
]

watch(
  () => props.modelValue,
  (value) => {
    weather.value = { ...value }
    manualTemp.value = String(value.temp || 20)
    const cityIndex = MANUAL_WEATHER.findIndex((item) => item.city === value.city)
    if (cityIndex >= 0) manualCityIndex.value = cityIndex
    const conditionIndex = CONDITIONS.findIndex((item) => item.condition === value.condition)
    if (conditionIndex >= 0) manualConditionIndex.value = conditionIndex
  },
  { deep: true },
)

function publish(value: SceneWeatherInfo) {
  weather.value = { ...value }
  emit('update:modelValue', weather.value)
  emit('change', weather.value)
}

function requestLocation() {
  if (locating.value) return
  locating.value = true
  locationMessage.value = '正在申请定位…'
  uni.getLocation({
    type: 'gcj02',
    success: async (location) => {
      try {
        const located = await fetchSceneWeather({
          latitude: location.latitude,
          longitude: location.longitude,
        })
        publish(located)
        editing.value = false
        locationMessage.value = located.source === 'located'
          ? '已使用实时定位与天气'
          : '天气接口未配置，使用定位城市演示天气'
      } catch {
        publish({ ...weather.value, source: 'manual' })
        editing.value = true
        locationMessage.value = '天气接口失败，请手动选择'
      } finally {
        locating.value = false
      }
    },
    fail: () => {
      locating.value = false
      editing.value = true
      locationMessage.value = '未获得定位权限，可手动选择'
    },
  })
}

function openManual() {
  editing.value = !editing.value
  if (!locationMessage.value) locationMessage.value = '手动选择城市与天气'
}

function onCityChange(event: any) {
  const index = Number(event.detail?.value ?? 0)
  const selected = MANUAL_WEATHER[index] ?? MANUAL_WEATHER[0]
  manualCityIndex.value = index
  manualTemp.value = String(selected.temp)
  const conditionIndex = CONDITIONS.findIndex((item) => item.condition === selected.condition)
  manualConditionIndex.value = Math.max(0, conditionIndex)
  publish({
    ...weather.value,
    city: selected.city,
    temp: selected.temp,
    condition: selected.condition,
    icon: selected.icon,
    source: 'manual',
  })
}

function onConditionChange(event: any) {
  const index = Number(event.detail?.value ?? 0)
  const selected = CONDITIONS[index] ?? CONDITIONS[0]
  manualConditionIndex.value = index
  publish({
    ...weather.value,
    condition: selected.condition,
    icon: selected.icon,
    source: 'manual',
  })
}

function onTempInput(event: any) {
  manualTemp.value = String(event.detail?.value ?? '')
  const temp = Number(manualTemp.value)
  if (Number.isFinite(temp)) {
    publish({ ...weather.value, temp, source: 'manual' })
  }
}

const sourceLabel = computed(() => {
  if (weather.value.source === 'located') return '实时定位'
  if (weather.value.source === 'fallback') return '定位城市演示天气'
  return '手动选择'
})

const dateLabel = new Date().toLocaleDateString('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'short',
})

defineExpose({ requestLocation })
</script>

<template>
  <view class="weather-card">
    <view class="wc-top">
      <view class="wc-place">
        <view class="wc-city"><UiIcon name="location" :size="28" tone="soft" /><text>{{ weather.city }}</text></view>
        <text class="wc-date">{{ dateLabel }} · {{ sourceLabel }}</text>
      </view>
      <view class="wc-actions">
        <button class="wc-locate" :class="{ busy: locating }" @tap="requestLocation">
          {{ locating ? '定位中' : '重新定位' }}
        </button>
        <button class="wc-manual" @tap="openManual">手动选择</button>
      </view>
    </view>

    <view class="wc-now">
      <UiIcon class="wc-icon" :name="weatherIcon" :size="72" tone="soft" :stroke-width="1.4" />
      <text class="wc-temp">{{ weather.temp }}°</text>
      <text class="wc-cond">{{ weather.condition }}</text>
    </view>

    <text v-if="locationMessage" class="wc-message">{{ locationMessage }}</text>

    <view v-if="editing" class="manual-panel">
      <view class="manual-row">
        <text class="manual-label">城市</text>
        <picker
          class="manual-picker"
          mode="selector"
          :range="MANUAL_WEATHER.map((item) => item.city)"
          :value="manualCityIndex"
          @change="onCityChange"
        >
          <view class="picker-value">{{ weather.city }} ›</view>
        </picker>
      </view>
      <view class="manual-row">
        <text class="manual-label">天气</text>
        <picker
          class="manual-picker"
          mode="selector"
          :range="CONDITIONS.map((item) => item.condition)"
          :value="manualConditionIndex"
          @change="onConditionChange"
        >
          <view class="picker-value">{{ weather.condition }} ›</view>
        </picker>
      </view>
      <view class="manual-row">
        <text class="manual-label">温度</text>
        <input
          class="manual-input"
          type="number"
          :value="manualTemp"
          placeholder="输入温度"
          @input="onTempInput"
        />
        <text class="manual-unit">℃</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.weather-card {
  background: linear-gradient(150deg, #c9ecff 0%, #b8b0ff 55%, #ffc9e8 100%);
  border-radius: var(--radius-lg);
  padding: 16px;
  color: var(--text-1);
  box-shadow: var(--shadow-float);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wc-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.wc-place {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.wc-city {
  font-size: 14px;
  font-weight: 700;
}
.wc-date {
  font-size: 12px;
  color: var(--text-2);
}
.wc-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.wc-locate,
.wc-manual {
  padding: 5px 10px;
  border-radius: var(--radius-pill);
  background: rgba(255, 255, 255, 0.72);
  color: var(--purple-deep);
  font-size: 12px;
  font-weight: 700;
}
.wc-locate.busy {
  opacity: 0.65;
}

.wc-now {
  display: flex;
  align-items: center;
  gap: 10px;
}
.wc-icon {
  font-size: 40px;
  filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.12));
}
.wc-temp {
  font-size: 52px;
  font-weight: 800;
  line-height: 1;
}
.wc-cond {
  align-self: flex-end;
  margin-bottom: 6px;
  font-size: 15px;
  font-weight: 600;
}
.wc-message {
  font-size: 12px;
  font-weight: 600;
  color: var(--purple-deep);
}

.manual-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: rgba(255, 255, 255, 0.58);
  border-radius: var(--radius);
  padding: 12px;
}
.manual-row {
  display: flex;
  align-items: center;
  min-height: 34px;
}
.manual-label {
  width: 46px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 700;
}
.manual-picker {
  flex: 1;
}
.picker-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}
.manual-input {
  flex: 1;
  height: 34px;
  min-width: 0;
  background: rgba(255, 255, 255, 0.86);
  border-radius: 8px;
  padding: 0 10px;
  font-size: 13px;
}
.manual-unit {
  margin-left: 6px;
  font-size: 13px;
  font-weight: 700;
}
</style>
