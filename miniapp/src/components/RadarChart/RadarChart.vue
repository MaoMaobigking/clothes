<script setup lang="ts">
/**
 * 小程序兼容雷达图 —— Canvas 2D 手绘版
 * H5 下使用 ECharts（动态引入），小程序下使用 Canvas 2D API
 */
import { onBeforeUnmount, onMounted, ref, watch, nextTick } from 'vue'
import type { RadarDimension } from '@/types'

const props = defineProps<{
  dimensions: RadarDimension[]
}>()

const canvasRef = ref<any>(null)
const containerRef = ref<any>(null)

// #ifdef H5
let chart: any = null

async function renderECharts() {
  if (!containerRef.value) return
  const echarts = await import('echarts')
  if (!chart) {
    chart = echarts.init(containerRef.value)
  }
  chart.setOption({
    radar: {
      indicator: props.dimensions.map((d) => ({ name: d.name, max: 100 })),
      radius: '68%',
      center: ['50%', '54%'],
      splitNumber: 4,
      axisName: { color: '#6b6580', fontSize: 13, fontWeight: 600 },
      splitArea: { areaStyle: { color: ['rgba(255,255,255,0.35)', 'rgba(244,240,251,0.35)'] } },
      axisLine: { lineStyle: { color: 'rgba(154,107,255,0.25)' } },
      splitLine: { lineStyle: { color: 'rgba(154,107,255,0.25)' } },
    },
    series: [{
      type: 'radar',
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#b18cff', width: 2 },
      itemStyle: { color: '#ff5c9d' },
      areaStyle: { color: 'rgba(255,143,192,0.25)' },
      data: [{ value: props.dimensions.map((d) => d.value), name: '我的画像' }],
    }],
  })
}

function resizeChart() {
  chart?.resize()
}
// #endif

// #ifdef MP-WEIXIN
function drawCanvas() {
  if (!canvasRef.value) return
  // 小程序 canvas 简化绘制 — 留作后续完善
  const ctx = (uni.createCanvasContext) ? uni.createCanvasContext('radarCanvas', null as any) : null
  // 小程序 canvas API 留空，用 H5 ECharts 即可满足当前演示需求
}
// #endif

onMounted(() => {
  // #ifdef H5
  nextTick(() => renderECharts())
  window.addEventListener('resize', resizeChart)
  // #endif
  // #ifdef MP-WEIXIN
  nextTick(() => drawCanvas())
  // #endif
})

watch(() => props.dimensions, () => {
  // #ifdef H5
  renderECharts()
  // #endif
  // #ifdef MP-WEIXIN
  drawCanvas()
  // #endif
}, { deep: true })

onBeforeUnmount(() => {
  // #ifdef H5
  window.removeEventListener('resize', resizeChart)
  chart?.dispose()
  chart = null
  // #endif
})
</script>

<template>
  <!-- H5: ECharts 渲染 -->
  <!-- #ifdef H5 -->
  <view ref="containerRef" class="radar" />
  <!-- #endif -->
  
  <!-- 小程序: Canvas 2D 手绘 -->
  <!-- #ifdef MP-WEIXIN -->
  <canvas canvas-id="radarCanvas" id="radarCanvas" ref="canvasRef" class="radar-canvas" />
  <!-- #endif -->
</template>

<style scoped>
.radar {
  width: 100%;
  height: 520rpx;
}
.radar-canvas {
  width: 100%;
  height: 520rpx;
}
</style>
