/*
 * 认证服务（Service）
 *  - 微信小程序登录流程：code → openid → 查/建用户 → JWT
 *
 * 这一版的关键变化：userId 不再写死 1，而是 users 表真实自增出来的 id。
 * 「真用户」是数据隔离的地基 —— 地基假的，上面所有 WHERE user_id = ? 都在演。
 */
import { signToken, verifyToken } from '../middleware/auth.mjs'
import {
  findOrCreateByOpenid,
  findByAccount,
  listDemoUsers,
  setAccountCredentials,
  setUserRole,
} from '../repositories/userRepo.mjs'
import { ensureSeeded } from './garmentService.mjs'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const WX_APPID = process.env.WX_APPID || ''
const WX_SECRET = process.env.WX_SECRET || ''

/**
 * code → openid。
 * 配了 WX_APPID/WX_SECRET 就走微信真接口；没配则用 code 派生一个稳定的假 openid。
 *
 * 为什么假 openid 也要「稳定」（同一个 code 每次都得到同一个 openid）：
 * 否则每次登录都建新用户，衣橱看起来每次都被清空 —— 隔离没问题，是登录在漏。
 */
async function resolveOpenid(code) {
  if (WX_APPID && WX_SECRET) {
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${encodeURIComponent(code)}&grant_type=authorization_code`
    const res = await fetch(url)
    const data = await res.json()
    if (!data.openid) {
      const err = new Error(data.errmsg || '微信登录失败')
      err.status = 401
      err.code = 'WX_LOGIN_FAILED'
      throw err
    }
    return data.openid
  }
  // 开发态：对 code 取 sha256。
  //
  // 这里踩过一个坑，值得记：原来写的是 hex(code).slice(0, 16)，
  // 而 "devcode_" 这 8 个字符 hex 出来正好 16 位 —— 后面真正用来区分用户的部分
  // 全被 slice 截掉了，于是所有开发 token 都映射到同一个 openid、同一个用户。
  // 表面看是「隔离没生效」，实际是登录阶段就把两个人认成了一个人。
  // 教训：派生标识符别用「截断」，用定长哈希，天然不会因为公共前缀撞车。
  return 'mock_' + createHash('sha256').update(String(code)).digest('hex').slice(0, 32)
}

/**
 * 登录：拿到 openid → 查库或建号 → 新用户灌种子衣橱 → 签 token
 * @returns {{token: string, userId: number, openid: string, isNewUser: boolean}}
 */
export async function wxLogin(code, profile = {}) {
  const openid = await resolveOpenid(code)
  const { user, created } = await findOrCreateByOpenid(openid, profile)

  // 新用户给一份初始衣橱，避免进去是白屏。灌种子失败不该挡住登录。
  if (created) {
    try {
      await ensureSeeded(user.id)
    } catch (err) {
      console.warn('[auth] 种子衣橱初始化失败:', err.message)
    }
  }

  const role = user.role || 'user'
  const token = signToken({ userId: user.id, openid, role })
  return {
    token,
    userId: user.id,
    openid,
    role,
    isNewUser: created,
    nickname: user.nickname,
  }
}

/** 验 token 并返回用户信息 */
export function checkToken(token) {
  const payload = verifyToken(token)
  if (!payload) return null
  return { userId: payload.userId, openid: payload.openid, role: payload.role || 'user' }
}

/**
 * 开发用 token。走完整登录流程（真建用户），
 * 而不是直接给 userId=1 签一个指向不存在用户的 token —— 那种 token 一写库就撞外键。
 */
export async function devToken(tag = 'dev') {
  return wxLogin(`devcode_${tag}`, { nickname: `开发用户_${tag}` })
}

/**
 * 轻量管理员登录。演示阶段使用环境变量中的独立密码，
 * 不暴露普通账号选择器，也不接真实管理员系统。
 */
export async function adminLogin(password) {
  const expected = process.env.ADMIN_PASSWORD
  if (process.env.NODE_ENV === 'production' && !expected) {
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
  return { token, userId: user.id, role: 'admin', nickname: user.nickname }
}

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

/**
 * 四类预置演示账号（规格 §5.2）。
 * openid 固定，所以每次启动都是同一批用户，衣橱和报告不会漂。
 * 密码可用环境变量覆盖，默认值只用于本地演示。
 */
export const DEMO_ACCOUNTS = [
  {
    kind: 'female',
    account: 'demo_female',
    openid: 'lingxi_demo_female',
    nickname: '演示用户 · 小灵',
    role: 'user',
    label: '演示女性账号',
    description: '已完成五步测试、真实衣橱、历史搭配、购物车、定制申请',
    envKey: 'DEMO_FEMALE_PASSWORD',
    defaultPassword: 'demo-female-2026',
  },
  {
    kind: 'male',
    account: 'demo_male',
    openid: 'lingxi_demo_male',
    nickname: '演示用户 · 阿犀',
    role: 'user',
    label: '演示男性账号',
    description: '已完成画像、真实衣橱、场景搭配示例',
    envKey: 'DEMO_MALE_PASSWORD',
    defaultPassword: 'demo-male-2026',
  },
  {
    kind: 'blank',
    account: 'demo_blank',
    openid: 'lingxi_demo_blank',
    nickname: '全新用户',
    role: 'user',
    label: '空白新账号',
    description: '无画像、无衣橱，用于演示从零开始的完整流程',
    envKey: 'DEMO_BLANK_PASSWORD',
    defaultPassword: 'demo-blank-2026',
  },
  {
    kind: 'admin',
    account: 'demo_admin',
    openid: 'lingxi_admin',
    nickname: '灵犀管理员',
    role: 'admin',
    label: '管理员账号',
    description: '查看数据看板和演示进度',
    envKey: 'ADMIN_PASSWORD',
    defaultPassword: 'lingxi-admin-demo',
  },
]

export function demoPasswordOf(entry) {
  return process.env[entry.envKey] || entry.defaultPassword
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
    demoKind: user.demo_kind || null,
    isNewUser: false,
  }
}

/** H5 兜底演示入口用的账号清单；生产环境不返回密码 */
export async function listDemoAccounts() {
  const rows = await listDemoUsers()
  const meta = new Map(DEMO_ACCOUNTS.map((entry) => [entry.kind, entry]))
  const exposePassword = process.env.NODE_ENV !== 'production'
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
