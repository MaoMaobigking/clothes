<script setup lang="ts">
/*
 * 画像雷达图 —— ECharts 版，H5 和微信小程序共用同一份 option。
 *
 * 上一版是「H5 走 ECharts、小程序走 190 行手绘 Canvas」的双实现：两套代码画同一张图，
 * 网格 / 轴线 / 标签对齐 / 数据多边形全是手算，改一处样式要改两遍还对不齐。
 * 现在只有 buildOption() 一份配置，平台差异压缩到「怎么拿到一块画布」这一层。
 *
 * ── 小程序端为什么能跑 ECharts ──
 * ECharts 本身不碰 DOM，碰 DOM 的是 zrender。看 zrender/lib/canvas/Painter.js:105：
 *     var singleCanvas = !root.nodeName || root.nodeName.toUpperCase() === 'CANVAS'
 * 传进去的 root 没有 nodeName 时就走 singleCanvas 分支，直接把 root 当画布用
 * （只要求 width/height 可写 + getContext('2d')），不再 createElement、不再 appendChild。
 * 微信 Canvas 2D 的节点正好满足，所以不需要 ec-canvas 那类原生组件，也不用 vendor uni_modules。
 *
 * 还差两块垫片，都是 zrender 无条件调用、而微信节点没有的东西：
 *   1. 事件：zrender/lib/core/event.js 里 addEventListener 是裸 `el.addEventListener(...)`，
 *      没有 typeof 保护。微信 canvas 节点没这两个方法，不垫就是 TypeError。
 *      这张图是只读的，垫成空函数即可（要做 tooltip 再把 touch 事件转成合成事件喂进去）。
 *   2. 文本测量：zrender 默认的 measureText 会 platformApi.createCanvas() 建一块离屏画布量字宽。
 *      浏览器里那是 document.createElement，小程序没有，所以用 wx.createOffscreenCanvas 顶上。
 *      拿不到也不会崩（zrender 有内建字宽表兜底），但标签宽度会略偏，见 patchPlatform()。
 *
 * ── 颜色为什么写字面值 ──
 * canvas 画的是像素，取不到 CSS 变量。这里的色值必须和 tokens.css 手工对齐：
 * #ff5c9d = --brand / $uv-primary，#606266 = --text-2，#c0c4cc = --text-4。
 * 改主题色时这里要一起改（和 BottomNav 里 ACTIVE_COLOR 同样的理由）。
 */
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { RadarChart as RadarSeries } from 'echarts/charts'
import { RadarComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
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

/*
 * 一个页面可能放多张图，canvas 的 id 必须实例唯一 ——
 * 写死 id 时第二个实例的 selector 会选到第一个，表现是「有一张图永远空白」。
 */
let seq = 0
const canvasId = `radar-canvas-${(seq += 1)}-${Math.floor(Math.random() * 1e6)}`

const containerRef = ref<any>(null)
/** init 失败时给一句可见的说明，而不是留一块无声的空白 */
const failed = ref(false)

let chart: echarts.ECharts | null = null

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

function apply() {
  // 维度不足 3 个画不成雷达图（会退化成线段），干脆不画
  if (!chart || props.dimensions.length < 3) return
  chart.setOption(buildOption(), true)
}

// #ifdef H5
function initH5() {
  if (!containerRef.value) return
  chart = echarts.init(containerRef.value)
  apply()
}
function resizeChart() {
  chart?.resize()
}
// #endif

// #ifdef MP-WEIXIN
/** 只需装一次：platformApi 是 zrender 的模块级单例 */
let platformPatched = false

function patchPlatform() {
  if (platformPatched) return
  platformPatched = true
  /*
   * 走 globalThis.wx 而不是裸写 wx：
   * 裸标识符 wx 会被 uni-app 的 Vite 插件改写成「从运行时 vendor 里 import 的那个 wx
   * 包装对象」（产物里长这样：e.wx$1），那个包装层上有没有 createOffscreenCanvas
   * 取决于 uni 的实现，不可靠。globalThis.wx 拿到的一定是微信注入的真全局。
   */
  const wxApi: any = typeof globalThis !== 'undefined' ? (globalThis as any).wx : undefined
  /*
   * 离屏画布只建一块，长期持有 —— 不能返回屏幕上那块 canvas：
   * zrender 的 measureText 会把 ctx 缓存在模块闭包里（platform.js 的 _ctx），
   * 页面销毁后那个引用还在，下次量字就落在一块已被回收的画布上。
   */
  const offscreen =
    typeof wxApi?.createOffscreenCanvas === 'function'
      ? wxApi.createOffscreenCanvas({ type: '2d', width: 1, height: 1 })
      : null
  echarts.setPlatformAPI({
    // 返回 null 是**可接受**的降级，不是失败：zrender 会退到它内建的字宽表
    // （platform.js 的 DEFAULT_TEXT_WIDTH_MAP），表里查不到的字符按 1em 计 ——
    // 我们的轴标签全是中文，中文本来就接近 1em，所以退化后标签宽度依然够准。
    createCanvas: () => offscreen,
  })
}

function initMp() {
  const instance = getCurrentInstance()
  if (!instance) return
  uni
    .createSelectorQuery()
    // .in(实例) 不能省：组件内的 selector 默认在页面作用域找，找不到组件自己的节点
    .in(instance.proxy as any)
    .select(`#${canvasId}`)
    // 回调传给 fields 而不是 exec：@dcloudio/types 把 fields 的 callback 标成必填
    .fields({ node: true, size: true }, (info: any) => {
      const node = info?.node
      if (!node || !info.width || !info.height) {
        failed.value = true
        return
      }
      // zrender 会无条件调 root.addEventListener，微信节点没有 —— 见文件头注释
      if (typeof node.addEventListener !== 'function') node.addEventListener = () => {}
      if (typeof node.removeEventListener !== 'function') node.removeEventListener = () => {}
      try {
        patchPlatform()
        chart = echarts.init(node, undefined, {
          width: info.width,
          height: info.height,
          devicePixelRatio: uni.getSystemInfoSync().pixelRatio || 1,
        })
        apply()
      } catch (err) {
        // 真机 / 基础库差异导致 init 失败时，把话说明白，别留一块空白让人以为数据没来
        console.error('[RadarChart] ECharts init 失败', err)
        failed.value = true
      }
    })
    .exec()
}
// #endif

onMounted(() => {
  nextTick(() => {
    // #ifdef H5
    initH5()
    window.addEventListener('resize', resizeChart)
    // #endif
    // #ifdef MP-WEIXIN
    initMp()
    // #endif
  })
})

watch(() => props.dimensions, apply, { deep: true })

onBeforeUnmount(() => {
  // #ifdef H5
  window.removeEventListener('resize', resizeChart)
  // #endif
  chart?.dispose()
  chart = null
})
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

    <text v-if="failed" class="radar-failed">雷达图渲染失败，请更新微信开发者工具基础库后重试</text>
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
