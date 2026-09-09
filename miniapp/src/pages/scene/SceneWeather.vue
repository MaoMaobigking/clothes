<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { fetchSceneWeather, type SceneWeatherInfo } from '@/api/scene'
import { iconForEmoji } from '@/utils/icons'
import { MANUAL_WEATHER } from '@/constants/scene'

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
        locationMessage.value =
          located.source === 'located' ? '已使用实时定位与天气' : '天气接口未配置，使用定位城市演示天气'
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
  <view class="weather-card card-glass">
    <view class="wc-top">
      <view class="wc-place">
        <view class="wc-city">
          <UiIcon name="location" :size="28" tone="soft" />
          <text>{{ weather.city }}</text>
        </view>
        <text class="wc-date">{{ dateLabel }} · {{ sourceLabel }}</text>
      </view>
      <view class="wc-actions">
        <button class="wc-locate pill-macaron pill-macaron-violet" :class="{ busy: locating }" @tap="requestLocation">
          {{ locating ? '定位中' : '重新定位' }}
        </button>
        <button class="wc-manual pill-macaron pill-macaron-pink" @tap="openManual">手动选择</button>
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
        <input class="manual-input" type="number" :value="manualTemp" placeholder="输入温度" @input="onTempInput" />
        <text class="manual-unit">℃</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
/*
 * ⚠️ 这里原来把粉紫渐变**写死**在页面里：
 *   linear-gradient(150deg, #c9ecff 0%, #b8b0ff 55%, #ffc9e8 100%)
 * 是第二轮去渐变时漏掉的硬编码点（全局 --brand-gradient 早就改成纯色了，
 * 但写死的这条不受影响，所以这块一直还是老的粉紫）。
 *
 * 现在换成 --glass-* 那套：半透明白 + 粉/薄荷双光晕 + 高光描边。
 * 面 / 边 / 影 / 圆角走全局 .card-glass，这里只留这个组件自己的排布。
 */
.weather-card {
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  padding: 32rpx;
  color: var(--text-1);
}

.wc-top {
  display: flex;
  gap: 16rpx;
  align-items: flex-start;
  justify-content: space-between;
}

.wc-place {
  display: flex;
  flex-direction: column;
  gap: 4rpx;
  min-width: 0;
}

.wc-city {
  font-size: var(--fs-lg);
  font-weight: 700;
}

.wc-date {
  font-size: var(--fs-base);
  color: var(--text-2);
}

.wc-actions {
  display: flex;
  flex-shrink: 0;
  gap: 16rpx;
}

/*
 * 两个按钮的尺寸 / 圆角 / 底色 / 字色 / 果冻投影全部来自
 * .pill-macaron + .pill-macaron-violet|pink，这里一条都不要重复写 ——
 * scoped 规则特异性比全局单类高，写了就是把全局类盖掉。
 * .busy 的压扁效果也在全局类里（.pill-macaron.busy），不用在这写。
 *
 * 两个按钮用不同色是因为它们是**并列**的两个动作（自动定位 / 手动选择），
 * 不是主次关系；用同色深浅区分反而要让人猜哪个是主。
 */
.wc-locate,
.wc-manual {
  flex-shrink: 0;
}

.wc-now {
  display: flex;
  gap: 20rpx;
  align-items: center;
}

.wc-icon {
  font-size: 80rpx;
  filter: drop-shadow(0 6rpx 12rpx rgb(0 0 0 / 12%));
}

.wc-temp {
  font-size: 104rpx;
  font-weight: 500;
  line-height: 1;
}

.wc-cond {
  align-self: flex-end;
  margin-bottom: 12rpx;
  font-size: var(--fs-xl);
  font-weight: 500;
}

.wc-message {
  font-size: var(--fs-base);
  font-weight: 500;
  color: var(--purple-deep);
}

/*
 * 手动面板嵌在玻璃卡里，所以底色不能再用半透明白（叠两层白就浑了），
 * 用 --surface-tint 的浅灰实底，跟玻璃面拉开一档。
 * 原值是 rgba(255,255,255,0.58) —— 又一处写死的半透明。
 */
.manual-panel {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  padding: 24rpx;
  background: var(--surface-tint);
  border-radius: var(--radius);
}

.manual-row {
  display: flex;
  align-items: center;
  min-height: 68rpx;
}

.manual-label {
  flex-shrink: 0;
  width: 92rpx;
  font-size: var(--fs-md);
  font-weight: 700;
}

.manual-picker {
  flex: 1;
}

.picker-value {
  font-size: var(--fs-md);
  font-weight: 500;
  color: var(--text-1);
}

/* 原值 rgba(255,255,255,0.86)，同上，改实底白 + 发丝边才看得出这是个输入框 */
.manual-input {
  flex: 1;
  min-width: 0;
  height: 68rpx;
  padding: 0 20rpx;
  font-size: var(--fs-md);
  background: var(--surface);
  border: var(--hairline);
  border-radius: var(--radius);
}

.manual-unit {
  margin-left: 12rpx;
  font-size: var(--fs-md);
  font-weight: 700;
}
</style>
