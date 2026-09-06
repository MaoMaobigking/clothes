/**
 * 轻量管理员登录（规格 §5.3）。演示阶段用独立密码，不接真实管理员系统。
 */
import { signToken } from '../../middleware/auth.mjs'
import { findOrCreateByOpenid, setUserRole } from '../../repositories/userRepo.mjs'
import { config } from '../../config/env.mjs'
/**
 * 轻量管理员登录。演示阶段使用环境变量中的独立密码，
 * 不暴露普通账号选择器，也不接真实管理员系统。
 */
export async function adminLogin(password) {
  const expected = config.auth.adminPassword
  if (config.runtime.isProduction && !expected) {
    const err = new Error('生产环境未配置 ADMIN_PASSWORD')
    err.status = 503
    err.code = 'ADMIN_NOT_CONFIGURED'
    throw err
  }
  const expectedPassword = expected || 'lingxi-admin-demo'
  if (!password || password !== expectedPassword) {
    const err = new Error('管理员密码不正确')
    err.status = 401
    err.code = 'ADMIN_LOGIN_FAILED'
    throw err
  }

  const openid = 'lingxi_admin'
  const { user } = await findOrCreateByOpenid(openid, {
    nickname: '灵犀管理员',
    role: 'admin',
  })
  if (user.role !== 'admin') await setUserRole(user.id, 'admin')
  const token = signToken({ userId: user.id, openid, role: 'admin' })
  return {
    token,
    userId: user.id,
    role: 'admin',
    nickname: user.nickname,
    avatarUrl: user.avatar_url || '',
  }
}
