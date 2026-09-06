/**
 * 账号密码登录与四类预置演示账号（规格 §5.1 §5.2 §5.4）。
 *
 * 密码用 scrypt + 每账号随机 salt，不用裸 sha256 ——
 * 演示账号密码短且可猜，加盐慢哈希才不至于一撞就穿。
 */
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { signToken } from '../../middleware/auth.mjs'
import {
  findByAccount,
  listDemoUsers,
  setAccountCredentials,
  findOrCreateByOpenid,
} from '../../repositories/userRepo.mjs'
import { config, envValue } from '../../config/env.mjs'
import { DEMO_ACCOUNTS } from '../../seeds/demoAccounts.mjs'
/* ============ 规格 §5：账号密码登录与预置演示账号 ============ */

/**
 * 密码哈希：scrypt + 每账号随机 salt，存成 `salt:hash`。
 * 不用裸 sha256 —— 演示账号密码短且可猜，加盐慢哈希才不至于一撞就穿。
 */
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${scryptSync(String(password), salt, 32).toString('hex')}`
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || '').split(':')
  if (!salt || !expected) return false
  const actual = scryptSync(String(password), salt, 32)
  const expectedBuf = Buffer.from(expected, 'hex')
  // 长度不等时 timingSafeEqual 会直接抛，先挡一层
  if (actual.length !== expectedBuf.length) return false
  return timingSafeEqual(actual, expectedBuf)
}

export function demoPasswordOf(entry) {
  // 键名是数据驱动的（写在 seeds/demoAccounts.mjs 的 envKey 里），没法在 config
  // 里静态列出来，所以走 envValue 这个受控入口 —— 全项目只有 config/env.mjs 直接碰 process.env
  return envValue(entry.envKey) || entry.defaultPassword
}

/**
 * 幂等创建四类演示账号并绑定密码。
 * 已存在的账号只覆盖密码哈希和角色，不动它已有的衣橱与报告
 * —— 现场重跑一次不该把演示数据洗掉。
 */
export async function ensureDemoAccounts() {
  const created = []
  for (const entry of DEMO_ACCOUNTS) {
    const { user } = await findOrCreateByOpenid(entry.openid, {
      nickname: entry.nickname,
      role: entry.role,
    })
    await setAccountCredentials(user.id, {
      account: entry.account,
      passwordHash: hashPassword(demoPasswordOf(entry)),
      demoKind: entry.kind,
      nickname: entry.nickname,
      role: entry.role,
    })
    created.push({ ...entry, userId: user.id })
  }
  return created
}

/** 账号密码登录（规格 §5.1） */
export async function passwordLogin(account, password) {
  const name = String(account || '').trim()
  if (!name || !password) {
    const err = new Error('请输入账号和密码')
    err.status = 400
    err.code = 'MISSING_CREDENTIALS'
    throw err
  }
  const user = await findByAccount(name)
  // 账号不存在与密码错误返回同一个提示，不给撞库留信息
  if (!user || !verifyPassword(password, user.password_hash)) {
    const err = new Error('账号或密码不正确')
    err.status = 401
    err.code = 'LOGIN_FAILED'
    throw err
  }
  const role = user.role || 'user'
  return {
    token: signToken({ userId: user.id, openid: user.openid, role }),
    userId: user.id,
    openid: user.openid,
    account: user.account,
    role,
    nickname: user.nickname,
    // 登录时就把头像带回去。不带的话退出再登进来，「我的」页头像会退回默认，
    // 要等下一次 fetchMe 才补上 —— 演示时看着像是设置没保存。
    avatarUrl: user.avatar_url || '',
    demoKind: user.demo_kind || null,
    isNewUser: false,
  }
}

/** H5 兜底演示入口用的账号清单；生产环境不返回密码 */
export async function listDemoAccounts() {
  const rows = await listDemoUsers()
  const meta = new Map(DEMO_ACCOUNTS.map((entry) => [entry.kind, entry]))
  const exposePassword = !config.runtime.isProduction
  return rows.map((row) => {
    const entry = meta.get(row.demo_kind)
    return {
      account: row.account,
      nickname: row.nickname,
      role: row.role,
      kind: row.demo_kind,
      label: entry?.label || row.nickname,
      description: entry?.description || '',
      password: exposePassword && entry ? demoPasswordOf(entry) : undefined,
    }
  })
}
