import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

/*
 * 测试专用配置，**刻意不复用 vite.config.ts**。
 *
 * 为什么不用 mergeConfig 继承它：
 * 那份配置里挂着 `@dcloudio/vite-plugin-uni`，它会拉起整条 uni-app 编译链
 * （平台判定、pages.json 解析、easycom 注册、SFC 转换）。跑纯函数测试时
 * 这条链既用不上，还会因为拿不到 UNI_PLATFORM 之类的环境直接报
 * `Failed to resolve vue/compiler-sfc` 起不来。
 *
 * vitest 发现同目录有 vitest.config.ts 就不会去读 vite.config.ts，
 * 所以这里只留测试真正需要的东西：一个 `@` 别名。
 *
 * ⚠️ 等以后要测 .vue 组件时，需要在这里单独加 @vitejs/plugin-vue + happy-dom，
 * 仍然不要引 uni 插件 —— 组件测试要的是 Vue 的编译能力，不是小程序的构建链。
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // 纯函数不需要 DOM。等测组件时再换成 'happy-dom'
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    // 产物目录和依赖不参与
    exclude: ['node_modules/**', 'dist/**'],
  },
})
