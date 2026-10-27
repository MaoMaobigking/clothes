import { findById } from '../repositories/userRepo.mjs'

/** JWT 只证明身份；管理员权限每次从数据库核对，撤权后旧 token 也失效。 */
export function requireAdmin(findUser = findById) {
  return async (req, res, next) => {
    try {
      const user = await findUser(req.userId)
      if (user?.role !== 'admin') return res.status(403).json({ error: 'ADMIN_REQUIRED', message: '需要管理员权限' })
      next()
    } catch (err) {
      next(err)
    }
  }
}
