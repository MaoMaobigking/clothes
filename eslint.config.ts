// ESLint 9/10 扁平配置（Flat Config）
// 骨架照搬「个人电商平台」的 eslint.config.ts，差异只在两处：
//   1. 这是 monorepo，miniapp / server / admin 三块的全局变量完全不同，
//      所以按目录分块注入 globals，而不是全局塞一份 browser+node。
//   2. miniapp 是 uni-app，需要 uni / wx / getCurrentPages 这些平台全局。
import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'
import prettierRecommended from 'eslint-plugin-prettier/recommended'
import { defineConfig, globalIgnores } from 'eslint/config'

const isProd = process.env.NODE_ENV === 'production'

/** uni-app 在小程序/H5 运行时注入的全局对象，静态分析看不见，得手工声明 */
const uniGlobals = {
  uni: 'readonly',
  wx: 'readonly',
  plus: 'readonly',
  getCurrentPages: 'readonly',
  getApp: 'readonly',
  UniApp: 'readonly',
  UniNamespace: 'readonly',
  AnyObject: 'readonly',
}

export default defineConfig([
  // 取代 .eslintignore：产物目录、静态素材、工具中间产物一律不检查
  globalIgnores([
    '**/dist/**',
    '**/node_modules/**',
    'miniapp/src/static/**',
    'server/uploads/**',
    'deploy/dist/**',
    '.worktrees/**',
    '.tmp/**',
    '.smoke/**',
    '.uishot/**',
    '.image-backup/**',
    '.handoff/**',
  ]),

  // 检查哪些后缀的文件
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  // js.configs.recommended：JavaScript 标准基础校验规则
  // tseslint.configs.recommended：TypeScript 基础语法校验规则
  // pluginVue.configs['flat/essential']：Vue 3 组件基础语法校验规则
  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/essential'],

  // .vue 单文件组件：<script lang="ts"> 内部交给 TS 解析器
  {
    files: ['**/*.vue'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        ecmaFeatures: { jsx: true },
      },
    },
  },

  // miniapp：浏览器全局 + uni-app 平台全局
  {
    files: ['miniapp/**/*.{ts,vue}'],
    languageOptions: {
      globals: { ...globals.browser, ...uniGlobals },
    },
    rules: {
      // uni-app 条件编译（// #ifdef H5 ... // #endif）在构建期才剥分支，
      // ESLint 只看到普通注释，会把另一分支误判成不可达代码。
      'no-unreachable': 'off',
    },
  },

  // admin：纯浏览器环境
  {
    files: ['admin/**/*.{ts,js,vue}'],
    languageOptions: {
      globals: { ...globals.browser },
    },
  },

  // server / 构建脚本：Node ESM，日志靠 console，不能禁
  {
    files: ['server/**/*.mjs', 'deploy/**/*.mjs', '*.ts'],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // 图片处理脚本在 playwright 的浏览器上下文里执行，用到 document / Image
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
    rules: {
      'no-console': 'off',
    },
  },

  // CommonJS：微信云函数与 .cjs 工具脚本。
  // 这些文件本来就该用 require，no-require-imports 在这里属误报。
  {
    files: ['**/*.cjs', 'cloudfunctions/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
      // const { URL } = require('url') 与 Node 全局 URL 同名，属正常写法
      'no-redeclare': 'off',
      'no-console': 'off',
    },
  },

  // 类型声明文件：`declare module '*.vue'` 的 Vue 官方样板就是 `{}`，属误报
  {
    files: ['**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  // 必须靠后：关闭所有与 Prettier 排版冲突的规则，
  // 实现「ESLint 管代码质量，Prettier 管代码排版」的分工。
  // 放前面会被后续 rules 重新覆盖，导致两边打架。
  prettierRecommended,

  // 自定义规则，与参考项目保持一致
  {
    rules: {
      // eslint
      'no-var': 'error', // 要求使用 let 或 const 而不是 var
      'no-multiple-empty-lines': ['warn', { max: 1 }], // 不允许多个空行
      'no-console': isProd ? 'error' : 'off', // 生产打包时禁止遗留 console
      'no-debugger': isProd ? 'error' : 'off',
      'no-unexpected-multiline': 'error', // 禁止空余的多行
      'no-useless-escape': 'off', // 禁止不必要的转义字符
      // 以下两条是 ESLint 10 新增的默认规则，参考项目的规则表里没有。
      // 存量代码有十来处命中，都属可读性问题而非缺陷，降为 warn：
      // 既保持可见，又不至于让 pre-commit 卡住无关提交。
      'no-useless-assignment': 'warn',
      'preserve-caught-error': 'warn',

      // typescript-eslint (https://typescript-eslint.io/rules)
      // 禁止定义未使用的变量。下划线开头的除外 —— Express 的错误中间件
      // 必须写满 (err, req, res, _next) 四个参数才会被识别为错误处理器，
      // 删掉 _next 会静默弄坏全站错误处理。
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/ban-ts-comment': 'error', // 禁止裸用 @ts-ignore
      '@typescript-eslint/no-explicit-any': 'off', // 允许使用 any 类型
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-namespace': 'off',

      // eslint-plugin-vue (https://eslint.vuejs.org/rules/)
      'vue/multi-word-component-names': 'off', // 组件名不强制多单词
      'vue/no-mutating-props': 'off', // 允许改动组件 prop
      'vue/attribute-hyphenation': 'off', // 不强制模板属性命名风格
    },
  },
])
