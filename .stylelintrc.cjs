// @see https://stylelint.io/
// 骨架参考「个人电商平台」的 .stylelintrc.cjs。
// 两处必要偏离：
//   1. 去掉 stylelint-config-prettier —— stylelint 15 起格式类规则已全部移除，
//      该包官方标记 deprecated，装上会直接报错。
//   2. extends 只写实际装了的包（参考项目那份 extends 了三个没进 package.json
//      的包，配置本身跑不起来）。
module.exports = {
  extends: [
    'stylelint-config-standard-scss', // scss 标准规则（已含 stylelint-config-standard）
    'stylelint-config-recommended-vue/scss', // vue 单文件组件里的 <style lang="scss">
    'stylelint-config-recess-order', // css 属性书写顺序
  ],
  overrides: [
    {
      files: ['**/*.(scss|css)'],
      customSyntax: 'postcss-scss',
    },
    {
      files: ['**/*.(html|vue)'],
      customSyntax: 'postcss-html',
    },
  ],
  ignoreFiles: ['**/*.js', '**/*.jsx', '**/*.tsx', '**/*.ts', '**/*.json', '**/*.md', '**/*.yaml'],
  /**
   * null  => 关闭该规则
   * always => 必须
   */
  rules: {
    'value-keyword-case': null, // 在 css 中使用 v-bind，不报错
    'no-descending-specificity': null, // 允许低优先级选择器写在高优先级之后
    'function-url-quotes': 'always', // url() 必须加引号
    'no-empty-source': null, // 允许空样式块
    'selector-class-pattern': null, // 不强制类名格式
    'property-no-unknown': null,
    'value-no-vendor-prefix': null, // 允许 -webkit-box 这类值前缀
    'property-no-vendor-prefix': null, // 允许 -webkit-mask 这类属性前缀
    // uni-app 小程序端的专有单位与标签，stylelint 不认识，全部放行
    'unit-no-unknown': [true, { ignoreUnits: ['rpx'] }],
    'selector-type-no-unknown': [
      true,
      {
        ignoreTypes: ['page', 'view', 'text', 'image', 'scroll-view', 'swiper', 'swiper-item', 'button', 'navigator'],
      },
    ],
    'selector-pseudo-class-no-unknown': [
      true,
      {
        ignorePseudoClasses: ['global', 'v-deep', 'deep'],
      },
    ],
  },
}
