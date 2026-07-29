<script setup lang="ts">
import { WEATHER } from '@/data/mock'
</script>

<template>
  <section class="weather-card">
    <div class="wc-top">
      <div class="wc-place">
        <span class="wc-city">{{ WEATHER.city }}</span>
        <span class="wc-date">{{ WEATHER.date }} · {{ WEATHER.weekday }}</span>
      </div>
      <span v-if="WEATHER.alert" class="wc-alert">⚠️ {{ WEATHER.alert }}</span>
    </div>

    <div class="wc-now">
      <span class="wc-icon">{{ WEATHER.icon }}</span>
      <span class="wc-temp">{{ WEATHER.temp }}°</span>
      <span class="wc-cond">{{ WEATHER.condition }}</span>
    </div>

    <div class="wc-forecast">
      <div v-for="d in WEATHER.forecast" :key="d.day" class="wc-day">
        <span class="wc-day-name">{{ d.day }}</span>
        <span class="wc-day-icon">{{ d.icon }}</span>
        <span class="wc-day-temp">{{ d.high }}° / {{ d.low }}°</span>
      </div>
    </div>
  </section>
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
}
.wc-city {
  font-size: 14px;
  font-weight: 700;
}
.wc-date {
  font-size: 12px;
  color: var(--text-2);
}
.wc-alert {
  flex-shrink: 0;
  background: linear-gradient(135deg, #ff7a90, #e0504f);
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  padding: 5px 12px;
  border-radius: var(--radius-pill);
  box-shadow: 0 4px 10px rgba(224, 80, 79, 0.4);
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
  color: var(--text-1);
}

.wc-forecast {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
.wc-day {
  background: rgba(255, 255, 255, 0.55);
  border-radius: var(--radius);
  padding: 10px 4px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.wc-day-name {
  font-size: 12px;
  color: var(--text-2);
}
.wc-day-icon {
  font-size: 22px;
}
.wc-day-temp {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-1);
}
</style>
