/// <reference types="@dcloudio/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

/*
 * uv-ui 不带 .d.ts（1.1.20 的包里只有 index.js + components/）。
 * 不声明的话 main.ts 那行 `import uvUI from '@climblee/uv-ui'` 会报
 * TS7016 implicitly has an 'any' type，vue-tsc 直接不过。
 *
 * 组件本身不需要声明：它们靠 easycom 在模板里自动注册，走的是
 * `declare module '*.vue'` 那条通配。
 */
declare module '@climblee/uv-ui'
