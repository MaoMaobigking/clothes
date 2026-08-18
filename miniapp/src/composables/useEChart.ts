/*
 * ECharts 在 uni-app 两端的「怎么拿到一块画布」这一层。
 *
 * 这些坑原先全部写在 RadarChart.vue 里。看板要再画柱状 / 环形 / 仪表盘三张图，
 * 把这段复制第二遍就等于把「不能用 vue 的 nextTick」「离屏画布要长期持有」这类
 * 一眼看不出所以然的结论也复制一遍 —— 以后改一处漏一处。所以抽到这里，
 * 组件里只剩「这张图长什么样」（buildOption）和 echarts.use 的按需注册。
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
 *      这些图都是只读的，垫成空函数即可（要做 tooltip 再把 touch 事件转成合成事件喂进去）。
 *   2. 文本测量：zrender 默认的 measureText 会 platformApi.createCanvas() 建一块离屏画布量字宽。
 *      浏览器里那是 document.createElement，小程序没有，所以用 wx.createOffscreenCanvas 顶上。
 *      拿不到也不会崩（zrender 有内建字宽表兜底），但标签宽度会略偏，见 patchPlatform()。
 */
import { getCurrentInstance, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import * as echarts from 'echarts/core'

interface UseEChartOptions {
  /** 出错文案里的图表名，例如「雷达图」。别写「图表」这种看不出是哪张的词。 */
  label: string
  /** 数据不足以成图时返回 false，apply() 直接跳过（雷达图少于 3 个维度会退化成线段） */
  canRender?: () => boolean
}

/** 一个页面可能放多张图，canvas 的 id 必须实例唯一 —— 写死 id 时第二张图永远空白 */
let seq = 0

/** 只需装一次：platformApi 是 zrender 的模块级单例 */
let platformPatched = false

// #ifdef MP-WEIXIN
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
    // 轴标签基本是中文和数字，中文本来就接近 1em，所以退化后标签宽度依然够准。
    createCanvas: () => offscreen,
  })
}
// #endif

/**
 * 在组件里挂一张 ECharts 图。
 *
 * 用法：setup 里调一次，把返回的 canvasId / containerRef 绑到模板上，
 * 数据变了就调 apply()。echarts.use([...]) 的按需注册留在组件里 ——
 * 放到这里就等于每张图都把柱状、雷达、饼图全打进包。
 */
export function useEChart(buildOption: () => any, options: UseEChartOptions) {
  /*
   * 组件实例必须在 setup 的同步阶段取。
   * getCurrentInstance() 只在 setup / 生命周期钩子「正在执行」的那一刻有值
   * （Vue 在钩子外会 unsetCurrentInstance），放到 nextTick 回调里取一定是 null。
   * 早期版本就栽在这：initMp() 第一行 `if (!instance) return` 直接静默退出，
   * 连「渲染失败」那行字都不显示，只留一块无声的空白。
   */
  const instance = getCurrentInstance()
  const canvasId = `ec-canvas-${(seq += 1)}-${Math.floor(Math.random() * 1e6)}`

  const containerRef = ref<any>(null)
  /** init 失败时给一句可见的说明，而不是留一块无声的空白 */
  const failMsg = ref('')

  let chart: echarts.ECharts | null = null
  /** 组件卸载后，重试链和 selector 回调都要停手，别往一块已经销毁的画布上初始化 */
  let disposed = false

  function apply() {
    if (!chart) return
    if (options.canRender && !options.canRender()) return
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
  /** 视图层建节点比 JS 慢半拍，查不到就隔一会儿再问，总共等 10 × 50ms */
  const QUERY_RETRY_MAX = 10
  const QUERY_RETRY_INTERVAL = 50
  let queryRetry = 0

  function initMp() {
    if (disposed) return
    if (!instance) {
      failMsg.value = `${options.label}初始化失败：拿不到组件实例`
      return
    }
    uni
      .createSelectorQuery()
      // .in(实例) 不能省：组件内的 selector 默认在页面作用域找，找不到组件自己的节点
      .in(instance.proxy as any)
      .select(`#${canvasId}`)
      // 回调传给 fields 而不是 exec：@dcloudio/types 把 fields 的 callback 标成必填
      .fields({ node: true, size: true }, (info: any) => {
        if (disposed) return
        const node = info?.node
        if (!node || !info.width || !info.height) {
          /*
           * 视图层还没把 canvas 建出来（或此刻组件不可见、宽高还是 0）。
           * 这不算失败，等一帧再问一次；试满 QUERY_RETRY_MAX 次才认输 ——
           * 一上来就摔失败文案，只会把「时机不对」误报成「基础库不行」。
           */
          if (queryRetry < QUERY_RETRY_MAX) {
            queryRetry += 1
            setTimeout(initMp, QUERY_RETRY_INTERVAL)
            return
          }
          failMsg.value = `${options.label}初始化失败：画布节点未就绪`
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
          console.error(`[useEChart] ${options.label} init 失败`, err)
          failMsg.value = `${options.label}渲染失败，请更新微信开发者工具基础库后重试`
        }
      })
      .exec()
  }
  // #endif

  onMounted(() => {
    // #ifdef H5
    nextTick(() => {
      initH5()
      window.addEventListener('resize', resizeChart)
    })
    // #endif

    // #ifdef MP-WEIXIN
    /*
     * 这里必须用实例代理上的 $nextTick，不能用从 'vue' import 的那个 nextTick。
     *
     * uni-mp-vue 的导出是 `nextTick$1 as nextTick`（见 dist/vue.runtime.esm.js 末尾），
     * 也就是 Vue 内核那个 `currentFlushPromise.then(fn)` —— 一个微任务。而小程序的
     * <canvas> 是 setData 跨线程送到视图层之后才真正存在的（这块画布外面还套着
     * uni 编译出来的 wx:if="{{r0}}"，r0 恰恰是随第一次 setData 一起过去的），
     * 微任务里 createSelectorQuery 必然查不到节点。
     *
     * uni 自己那个「等 setData 回调再执行」的 nextTick(instance, fn) 只挂在
     * appConfig.globalProperties 上，唯一的入口就是实例上的 $nextTick。
     *
     * 拿不到 $nextTick 也不用兜底逻辑：initMp() 自带重试，直接调即可。
     */
    const proxy = instance?.proxy as any
    if (typeof proxy?.$nextTick === 'function') proxy.$nextTick(initMp)
    else initMp()
    // #endif
  })

  onBeforeUnmount(() => {
    disposed = true
    // #ifdef H5
    window.removeEventListener('resize', resizeChart)
    // #endif
    chart?.dispose()
    chart = null
  })

  return { canvasId, containerRef, failMsg, apply }
}
