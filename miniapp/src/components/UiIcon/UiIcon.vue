<script setup lang="ts">
import { computed } from 'vue'
import { ICON_PATHS, type IconName } from '@/utils/icons'

/*
 * 线性图标。
 *
 * 落地方式：运行时把 path 拼成 SVG 字符串 → base64 → 挂到 view 的 background-image。
 * 这样绕开了两个坑：WXML 不支持内联 <svg>；<image> 加载 .svg 在部分安卓机不渲染。
 * background-image 的 base64 在 WXSS 和 H5 里行为一致。
 *
 * 颜色不能用 CSS 变量（变量进不了 SVG 字符串），所以用 tone 枚举映射到字面色值，
 * 色值和 App.vue 里的 --text-* / --pink-deep / --purple-deep 保持同步。
 */

type Tone =
  | 'dark'
  | 'soft'
  | 'muted'
  | 'light'
  | 'brand'
  | 'purple'
  | 'white'
  /*
   * 马卡龙三色，只给 .pill-macaron-* 胶囊里的图标用。
   * 存在的理由：胶囊的字色是 --macaron-*-ink，图标若还是默认的 soft 灰，
   * 一个胶囊里就会出现「灰图标 + 墨绿文字」两种色，看起来像没写完。
   */
  | 'macaron-pink'
  | 'macaron-mint'
  | 'macaron-violet'

const props = withDefaults(
  defineProps<{
    name: IconName
    /** 尺寸，rpx */
    size?: number
    tone?: Tone
    /** 直接指定颜色，优先级高于 tone；必须是字面色值，不能传 CSS 变量 */
    color?: string
    strokeWidth?: number
  }>(),
  { size: 40, tone: 'soft', color: '', strokeWidth: 1.7 },
)

/*
 * 与 styles/tokens.css 的 CSS 变量一一对应，**改这里记得同步改那边**。
 *
 * 为什么必须重复一遍字面值：SVG 串是运行时拼的字符串，CSS 变量进不去
 * （`stroke="var(--text-1)"` 在 data-uri 里解析不出来）。所以这是一处
 * 无法消除的重复，只能靠注释和这条说明维持同步。
 *
 * 2026-08-17 已随第二轮换皮更新成 uv-ui 的冷灰四档。
 * 旧值是紫调灰（dark #2f2a3d / soft #6b6580 / muted #a8a2ba），
 * 全站 92 个图标都在用它们 —— 改这个表等于一次性给所有图标换色。
 */
const TONE_COLORS: Record<Tone, string> = {
  dark: '#303133', // --text-1
  soft: '#606266', // --text-2
  muted: '#909193', // --text-3
  light: '#c0c4cc', // --text-4
  brand: '#ff5c9d', // --pink-deep
  /*
   * purple 已退役：紫色在第二轮里被收敛进主色（tokens.css 的 --purple-deep 同样是别名）。
   * 保留这个 tone 名是因为页面里还有调用点传 tone="purple"，改成主色即可，不用去改调用点。
   */
  purple: '#ff5c9d',
  white: '#ffffff',
  /* 与 tokens.css 的 --macaron-*-ink 三个字色同值，改一边记得改另一边 */
  'macaron-pink': '#b82a5f',
  'macaron-mint': '#0f7a58',
  'macaron-violet': '#5442b5',
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/* 小程序没有 btoa，自带一个。SVG 串全是 ASCII，不需要处理多字节。 */
function toBase64(input: string): string {
  let out = ''
  for (let i = 0; i < input.length; i += 3) {
    const c1 = input.charCodeAt(i)
    const c2 = input.charCodeAt(i + 1)
    const c3 = input.charCodeAt(i + 2)
    const has2 = !Number.isNaN(c2)
    const has3 = !Number.isNaN(c3)
    out += B64[c1 >> 2]
    out += B64[((c1 & 3) << 4) | (has2 ? c2 >> 4 : 0)]
    out += has2 ? B64[((c2 & 15) << 2) | (has3 ? c3 >> 6 : 0)] : '='
    out += has3 ? B64[c3 & 63] : '='
  }
  return out
}

const dataUri = computed(() => {
  const stroke = props.color || TONE_COLORS[props.tone]
  const paths = (ICON_PATHS[props.name] as readonly string[]) ?? []
  const body = paths.map((d) => `<path d="${d}"/>`).join('')
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" ` +
    `fill="none" stroke="${stroke}" stroke-width="${props.strokeWidth}" ` +
    `stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  /*
   * url() 里不要加引号：这个值最终会序列化进 WXML 的 style 属性，
   * 双引号会被转义成 &quot;，小程序端就取不到图了。
   * base64 字母表只有 A-Za-z0-9+/=，本来也不需要引号。
   */
  return `url(data:image/svg+xml;base64,${toBase64(svg)})`
})

const boxStyle = computed(() => ({
  width: `${props.size}rpx`,
  height: `${props.size}rpx`,
  backgroundImage: dataUri.value,
}))
</script>

<template>
  <view class="ui-icon" :style="boxStyle" />
</template>

<style scoped>
.ui-icon {
  /*
   * inline-block 而不是 block：
   * 很多空态容器只写了 text-align: center，块级元素在里面不会居中（emoji 是文字所以原本居中）。
   * inline-block 在这类容器里能被 text-align 居中，在 flex 容器里又会被 blockify，两边都对。
   */
  display: inline-block;
  flex-shrink: 0;
  vertical-align: middle;
  background-repeat: no-repeat;
  background-position: center;
  background-size: 100% 100%;
}
</style>
