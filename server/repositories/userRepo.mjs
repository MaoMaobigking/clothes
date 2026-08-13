/**
 * 用户仓库层（Repository）
 *
 * 「真用户」的落地点：openid → 查库 → 没有就建 → 返回真 id。
 * 之前这里全是占位（createUser 硬返 { id: 1 }），所以不管谁登录都是 1 号用户，
 * 数据隔离在此处就已经死了 —— 后面路由写得再对也没用。
 */
import { getOne, execute } from '../db/mysql.mjs'

/** 按微信 openid 查用户；没有返回 null */
export async function findByOpenid(openid) {
  return getOne(
    'SELECT id, openid, nickname, avatar_url, created_at FROM users WHERE openid = ?',
    [openid],
  )
}

/** 按主键查用户 */
export async function findById(id) {
  return getOne(
    'SELECT id, openid, nickname, avatar_url, created_at FROM users WHERE id = ?',
    [id],
  )
}

/** 创建用户，返回自增出来的真 id */
export async function createUser(
  openid,
  nickname = '衣橱主人',
  avatarUrl = null,
  role = 'user',
) {
  const result = await execute(
    'INSERT INTO users (openid, nickname, avatar_url, role) VALUES (?, ?, ?, ?)',
    [openid, nickname, avatarUrl, role],
  )
  return { id: result.insertId, openid, nickname, avatar_url: avatarUrl, role }
}

/**
 * 查找或创建（登录的标准动作）。
 * @returns {{user: object, created: boolean}} created=true 表示是新用户，
 *          上层据此决定是否灌种子衣橱。
 */
export async function findOrCreateByOpenid(openid, profile = {}) {
  const existing = await findByOpenid(openid)
  if (existing) return { user: existing, created: false }
  try {
    const user = await createUser(
      openid,
      profile.nickname,
      profile.avatarUrl,
      profile.role || 'user',
    )
    return { user, created: true }
  } catch (err) {
    // 并发下两个请求同时插同一个 openid，唯一索引会拦住后来的那个。
    // 这不是错误，回查一次即可（openid 上有 UNIQUE 约束才敢这么写）。
    if (err.code === 'ER_DUP_ENTRY') {
      return { user: await findByOpenid(openid), created: false }
    }
    throw err
  }
}

export async function setUserRole(id, role) {
  const result = await execute(
    'UPDATE users SET role = ? WHERE id = ?',
    [role, id],
  )
  return result.affectedRows > 0
}
