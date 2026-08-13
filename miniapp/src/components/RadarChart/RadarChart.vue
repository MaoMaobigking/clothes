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
  const ctx = uni.createCanvasContext('radarCanvas')
  const width = 320
  const height = 260
  const centerX = width / 2
  const centerY = height / 2 + 4
  const radius = 104
  const levels = 4
  const dimensions = props.dimensions.length ? props.dimensions : []

  ctx.clearRect(0, 0, width, height)
  ctx.setLineWidth(1)

  // 同心网格
  for (let level = 1; level <= levels; level += 1) {
    const current = (radius * level) / levels
    ctx.beginPath()
    for (let i = 0; i <= dimensions.length; i += 1) {
      const angle = (Math.PI * 2 * i) / Math.max(dimensions.length, 1) - Math.PI / 2
      const x = centerX + Math.cos(angle) * current
      const y = centerY + Math.sin(angle) * current
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.setStrokeStyle('rgba(154, 107, 255, 0.2)')
    ctx.stroke()
  }

  // 轴和标签
  for (let i = 0; i < dimensions.length; i += 1) {
    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2
    const x = centerX + Math.cos(angle) * radius
    const y = centerY + Math.sin(angle) * radius
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.lineTo(x, y)
    ctx.setStrokeStyle('rgba(154, 107, 255, 0.2)')
    ctx.stroke()

    const label = dimensions[i].incomplete
      ? `${dimensions[i].name}·未完善`
      : dimensions[i].name
    const labelX = centerX + Math.cos(angle) * (radius + 24)
    const labelY = centerY + Math.sin(angle) * (radius + 24) + 4
    ctx.setFontSize(11)
    ctx.setFillStyle('#6b6580')
    ctx.setTextAlign(
      Math.abs(Math.cos(angle)) < 0.25 ? 'center' : Math.cos(angle) > 0 ? 'left' : 'right',
    )
    ctx.fillText(label, labelX, labelY)
  }

  if (dimensions.length) {
    const points = dimensions.map((d, i) => {
      const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2
      const value = Math.max(0, Math.min(100, Number(d.value) || 0))
      const current = (radius * value) / 100
      return {
        x: centerX + Math.cos(angle) * current,
        y: centerY + Math.sin(angle) * current,
        value,
        incomplete: d.incomplete,
      }
    })

    ctx.beginPath()
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    })
    ctx.closePath()
    ctx.setFillStyle('rgba(255, 143, 192, 0.25)')
    ctx.fill()
    ctx.setStrokeStyle('#b18cff')
    ctx.setLineWidth(2)
    ctx.stroke()

    points.forEach((point) => {
      ctx.beginPath()
      ctx.arc(point.x, point.y, 4, 0, Math.PI * 2)
      ctx.setFillStyle(point.incomplete ? '#b7b0c6' : '#ff5c9d')
      ctx.fill()
    })
  }

  ctx.draw()
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
  <div ref="containerRef" class="radar" />
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
