<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import type { RadarDimension } from '@/types'

const props = defineProps<{
  dimensions: RadarDimension[]
}>()

const el = ref<HTMLDivElement>()
let chart: echarts.ECharts | null = null

function buildOption(): echarts.EChartsOption {
  return {
    radar: {
      indicator: props.dimensions.map((d) => ({ name: d.name, max: 100 })),
      radius: '68%',
      center: ['50%', '54%'],
      splitNumber: 4,
      axisName: {
        color: '#6b6580',
        fontSize: 13,
        fontWeight: 600,
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(255,255,255,0.35)', 'rgba(244,240,251,0.35)'],
        },
      },
      axisLine: { lineStyle: { color: 'rgba(154,107,255,0.25)' } },
      splitLine: { lineStyle: { color: 'rgba(154,107,255,0.25)' } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: '#b18cff', width: 2 },
        itemStyle: { color: '#ff5c9d' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 1, [
            { offset: 0, color: 'rgba(255,143,192,0.55)' },
            { offset: 1, color: 'rgba(177,140,255,0.55)' },
          ]),
        },
        data: [
          {
            value: props.dimensions.map((d) => d.value),
            name: '我的画像',
          },
        ],
      },
    ],
  }
}

function render() {
  if (!chart) return
  chart.setOption(buildOption())
}

function resize() {
  chart?.resize()
}

onMounted(() => {
  if (!el.value) return
  chart = echarts.init(el.value)
  render()
  window.addEventListener('resize', resize)
})

watch(() => props.dimensions, render, { deep: true })

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="radar" />
</template>

<style scoped>
.radar {
  width: 100%;
  height: 260px;
}
</style>
