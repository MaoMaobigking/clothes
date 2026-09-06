/**
 * 认证服务层的统一出口。
 *
 * 原来是单个 379 行的 services/authService.mjs，四件事挤在一起：
 * 微信登录、个人资料、管理员登录、演示账号。拆开后各自成文件，
 * 这里把公开接口原样再导出 —— 对外的 11 个符号与拆分前一致。
 *
 * ⚠️ ESM 不支持目录导入，引用方必须写全 `services/auth/index.mjs`。
 */

export { DEMO_ACCOUNTS } from '../../seeds/demoAccounts.mjs'
export { wxLogin, checkToken, devToken } from './wechat.mjs'
export { getMyProfile, updateMyProfile } from './profile.mjs'
export { adminLogin } from './admin.mjs'
export { demoPasswordOf, ensureDemoAccounts, passwordLogin, listDemoAccounts } from './demo.mjs'
