<script setup lang="ts">
/*
 * 看板用的通用 ECharts 容器：柱状 / 环形 / 仪表盘三张图共用这一个组件，
 * 具体画什么由父组件传 option 决定。
 *
 * 平台差异（小程序怎么拿画布、要垫哪些 zrender 依赖）全在 composables/useEChart.ts，
 * 和 RadarChart 是同一份实现 —— 所以这里没有一行 #ifdef 之外的平台代码。
 *
 * ── 为什么不注册 TooltipComponent ──
 * useEChart 把小程序 canvas 节点的 addEventListener 垫成了空函数（微信节点没有这两个方法），
 * 也就是说 zrender 收不到任何指针事件，tooltip 在小程序端永远不会弹。
 * 与其打进包里再让它在一端静默失效，不如把数值直接用 label 画在图上，两端表现一致。
 */
import { watch } from 'vue'
import * as echarts from 'echarts/core'
import { BarChart, GaugeChart, PieChart } from 'echarts/charts'
import { GridComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import { useEChart } from '@/composables/useEChart'

// GridComponent 只有柱状图要，饼图和仪表盘不用；一起注册是因为三种图共用这一个组件
echarts.use([BarChart, PieChart, GaugeChart, GridComponent, CanvasRenderer])

const props = withDefaults(
  defineProps<{
    /** 完整的 ECharts option，由父组件按指标各自拼 */
    option: Record<string, any> | null
    /** 画布高度，rpx。三张图高度不一样，所以做成 prop 而不是写死在样式里 */
    height?: number
  }>(),
  { height: 360 },
)

const { canvasId, containerRef, failMsg, apply } = useEChart(() => props.option || {}, {
  label: '图表',
  canRender: () => !!props.option,
})

watch(() => props.option, apply, { deep: true })
</script>

<template>
  <view class="metric-chart-wrap">
    <!-- #ifdef H5 -->
    <div ref="containerRef" class="metric-chart" :style="{ height: `${height}rpx` }" />
    <!-- #endif -->

    <!-- #ifdef MP-WEIXIN -->
    <!-- type="2d" 是关键：老的 canvas-id 接口只给 CanvasContext，拿不到 ECharts 要的真实节点 -->
    <canvas :id="canvasId" type="2d" class="metric-chart" :style="{ height: `${height}rpx` }" />
    <!-- #endif -->

    <text v-if="failMsg" class="metric-chart-failed">{{ failMsg }}</text>
  </view>
</template>

<style scoped>
.metric-chart-wrap {
  width: 100%;
}

.metric-chart {
  width: 100%;
}

.metric-chart-failed {
  display: block;
  padding: 20rpx 0;
  font-size: 22rpx;
  color: var(--text-3);
  text-align: center;
}
</style>
