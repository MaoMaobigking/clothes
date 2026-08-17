import { createSSRApp } from 'vue'
import * as Pinia from 'pinia'
import uvUI from '@climblee/uv-ui'
import App from './App.vue'

export function createApp() {
  const app = createSSRApp(App)
  app.use(Pinia.createPinia())

  /*
   * uv-ui 组件库。
   *
   * app.use 干的事：混入一个全局 mixin（提供 customStyle / customClass 的合并逻辑），
   * 并把 $uv 工具集挂到 globalProperties。组件本身靠 pages.json 的 easycom 规则
   * 自动注册，不需要在这里逐个 import。
   */
  app.use(uvUI)

  /*
   * ⚠️ 这里**故意不改** uv-ui 的单位配置，别再「优化」成 rpx。
   *
   * uv-ui 有个全局开关 uni.$uv.config.unit（默认 'px'，见 libs/config/config.js），
   * 改成 'rpx' 能让它内部所有尺寸走 rpx，看起来正好能和本项目 2194 处 rpx 对齐。
   * 试过，是个陷阱：
   *
   * 它内部尺寸走 libs/function/index.js 的 addUnit()，而 addUnit **也作用于
   * prop 的默认值**。全库有 179 个数字型默认值（uv-tabbar 的 iconSize: 20、
   * uv-icon 的 size 等等），全部是按 px 写的。开关一切，这 179 个默认值统统减半 ——
   * 图标、间距、行高集体缩成一半，而且不报错。
   *
   * 所以维持 px：uv-ui 内部自洽，本项目的 rpx 也不用迁移那 2194 处。
   * 代价是在 375px 基准屏之外两套单位会漂移（rpx 随屏宽缩放，px 不缩放）——
   * 这是 uni-app 混用 uView 系组件库的常态，可接受，不要试图消除它。
   */

  return { app, Pinia }
}
