<script setup lang="ts">
/*
 * 画像雷达图 —— ECharts 版，H5 和微信小程序共用同一份 option。
 *
 * 上一版是「H5 走 ECharts、小程序走 190 行手绘 Canvas」的双实现：两套代码画同一张图，
 * 网格 / 轴线 / 标签对齐 / 数据多边形全是手算，改一处样式要改两遍还对不齐。
 * 现在只有 buildOption() 一份配置，平台差异（怎么拿到一块画布、小程序要垫哪些东西）
 * 全部收在 composables/useEChart.ts 里 —— 看板那三张图和这张图共用那一份。
 *
 * ── 颜色为什么写字面值 ──
 * canvas 画的是像素，取不到 CSS 变量。这里的色值必须和 tokens.css 手工对齐：
 * #ff5c9d = --brand / $uv-primary，#606266 = --text-2，#c0c4cc = --text-4。
 * 改主题色时这里要一起改（和 BottomNav 里 ACTIVE_COLOR 同样的理由）。
 */
import { watch } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart as RadarSeries } from 'echarts/charts'
import { RadarComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useEChart } from '@/composables/useEChart'
import type { RadarDimension } from '@/types'

echarts.use([RadarSeries, RadarComponent, CanvasRenderer])

const ACCENT = '#ff5c9d'
const ACCENT_FILL = 'rgba(255, 143, 192, 0.25)'
const LABEL = '#606266'
const LABEL_WEAK = '#c0c4cc'
const GRID = 'rgba(0, 0, 0, 0.12)'

const props = defineProps<{
  dimensions: RadarDimension[]
}>()

function buildOption() {
  const dims = props.dimensions
  return {
    // 关掉入场动画：小程序端 requestAnimationFrame 由 zrender 自己驱动，
    // 静态画像图没必要为了 1s 的动画多跑几十帧、多占一次主线程。
    animation: false,
    radar: {
      indicator: dims.map((d) => ({ name: d.name, max: 100 })),
      radius: '62%',
      center: ['50%', '54%'],
      splitNumber: 4,
      axisName: {
        // 「未完善」的维度弱化显示。原来手绘版是在标签文字后面拼「·未完善」，
        // 这里保留同样的信息，但用 rich 分色，而不是让整条标签一起变灰。
        formatter: (name: string) => {
          const dim = dims.find((d) => d.name === name)
          return dim?.incomplete ? `{weak|${name}·未完善}` : `{normal|${name}}`
        },
        rich: {
          normal: { color: LABEL, fontSize: 11, fontWeight: 'bold' as const },
          weak: { color: LABEL_WEAK, fontSize: 11 },
        },
      },
      splitArea: {
        areaStyle: { color: ['rgba(255,255,255,0.35)', 'rgba(244,240,251,0.35)'] },
      },
      axisLine: { lineStyle: { color: GRID } },
      splitLine: { lineStyle: { color: GRID } },
    },
    series: [
      {
        type: 'radar' as const,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: ACCENT, width: 2 },
        itemStyle: { color: ACCENT },
        areaStyle: { color: ACCENT_FILL },
        data: [
          {
            name: '我的画像',
            value: dims.map((d) => Math.max(0, Math.min(100, Number(d.value) || 0))),
          },
        ],
      },
    ],
  }
}

const { canvasId, containerRef, failMsg, apply } = useEChart(buildOption, {
  label: '雷达图',
  // 维度不足 3 个画不成雷达图（会退化成线段），干脆不画
  canRender: () => props.dimensions.length >= 3,
})

watch(() => props.dimensions, apply, { deep: true })
</script>

<template>
  <!--
    包一层单根节点：failed 提示和画布是兄弟节点，不包的话组件有两个根。
    小程序端多根组件的 scoped 样式和外层 flex 布局都会变得不好预测。
  -->
  <view class="radar-wrap">
    <!-- #ifdef H5 -->
    <div ref="containerRef" class="radar" />
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN -->
    <!-- type="2d" 是关键：老的 canvas-id 接口只给 CanvasContext，拿不到 ECharts 要的真实节点 -->
    <canvas :id="canvasId" type="2d" class="radar" />
    <!-- #endif -->

    <text v-if="failMsg" class="radar-failed">{{ failMsg }}</text>
  </view>
</template>

<style scoped>
.radar-wrap {
  width: 100%;
}
.radar {
  width: 100%;
  height: 520rpx;
}
.radar-failed {
  display: block;
  padding: 24rpx 0;
  text-align: center;
  font-size: 24rpx;
  color: var(--text-3);
}
</style>
