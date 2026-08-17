/**
 * 用户仓库层（Repository）
 *
 * 「真用户」的落地点：openid → 查库 → 没有就建 → 返回真 id。
 * 之前这里全是占位（createUser 硬返 { id: 1 }），所以不管谁登录都是 1 号用户，
 * 数据隔离在此处就已经死了 —— 后面路由写得再对也没用。
 */
import { getOne, getAll, execute } from '../db/mysql.mjs'

/** 按微信 openid 查用户；没有返回 null */
export async function findByOpenid(openid) {
  return getOne(
    `SELECT id, openid, account, password_hash, nickname, avatar_url,
            role, membership_level, demo_kind, created_at
       FROM users WHERE openid = ?`,
    [openid],
  )
}

/** 按登录账号名查用户（规格 §5.2 的预置账号登录）；没有返回 null */
export async function findByAccount(account) {
  return getOne(
    `SELECT id, openid, account, password_hash, nickname, avatar_url,
            role, membership_level, demo_kind, created_at
       FROM users WHERE account = ?`,
    [account],
  )
}

/** 按主键查用户 */
export async function findById(id) {
  return getOne(
    `SELECT id, openid, account, nickname, avatar_url,
            role, membership_level, demo_kind, created_at
       FROM users WHERE id = ?`,
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

/**
 * 给用户绑定登录账号与密码哈希（预置演示账号用）。
 * 幂等：重复调用只是覆盖同样的值。
 */
export async function setAccountCredentials(id, { account, passwordHash, demoKind, nickname, role }) {
  const fields = []
  const params = []
  if (account !== undefined) { fields.push('account = ?'); params.push(account) }
  if (passwordHash !== undefined) { fields.push('password_hash = ?'); params.push(passwordHash) }
  if (demoKind !== undefined) { fields.push('demo_kind = ?'); params.push(demoKind) }
  if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname) }
  if (role !== undefined) { fields.push('role = ?'); params.push(role) }
  if (!fields.length) return false
  params.push(id)
  const result = await execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)
  return result.affectedRows > 0
}

/**
 * 用户自己改昵称 / 头像（规格 §11.2「编辑资料」）。
 *
 * 和上面的 setAccountCredentials 用同一套「只拼传进来的字段」写法，
 * 但**故意只认 nickname 和 avatarUrl** —— 这条 SQL 走的是用户可达的接口，
 * 把 role / account / password_hash 也放进来的话，前端多传一个 role: 'admin'
 * 就能给自己提权。可改字段白名单必须写死在这一层，别交给调用方。
 */
export async function updateUserProfile(id, { nickname, avatarUrl }) {
  const fields = []
  const params = []
  if (nickname !== undefined) { fields.push('nickname = ?'); params.push(nickname) }
  if (avatarUrl !== undefined) { fields.push('avatar_url = ?'); params.push(avatarUrl) }
  if (!fields.length) return false
  params.push(id)
  const result = await execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params)
  return result.affectedRows > 0
}

/** 列出所有预置演示账号（H5 兜底的账号选择器用，不返回密码哈希） */
export async function listDemoUsers() {
  return getAll(
    `SELECT id, account, nickname, role, demo_kind
       FROM users WHERE demo_kind IS NOT NULL ORDER BY id ASC`,
  )
}
