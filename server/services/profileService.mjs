/**
 * 个人身形档案业务层
 *
 * 校验规则与需求清单第 7.5 节一致：性别、身高、体重、视觉体型必填，
 * 风格必须刚好选择 3 项；其他维度可为空。
 */
import * as repo from '../repositories/profileRepo.mjs'

const GENDERS = new Set(['female', 'male'])

function required(profile, key, label) {
  const value = profile[key]
  if (value === undefined || value === null || value === '') {
    const err = new Error(`${label}不能为空`)
    err.status = 400
    err.code = 'INVALID_BODY_PROFILE'
    throw err
  }
  return value
}

function numberOrNull(value, label, { min, max }) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    const err = new Error(`${label}需在 ${min}-${max} 之间`)
    err.status = 400
    err.code = 'INVALID_BODY_PROFILE'
    throw err
  }
  return number
}

function buildBmi(height, weight) {
  if (!height || !weight) return null
  return Math.round((weight / (height / 100) ** 2) * 10) / 10
}

export function getLatestProfile(userId) {
  return repo.findLatestProfile(userId)
}

export async function saveProfile(userId, input = {}) {
  const styles = required(input, 'styles', '风格')
  if (!Array.isArray(styles) || styles.length !== 3) {
    const err = new Error('风格需选满 3 项')
    err.status = 400
    err.code = 'INVALID_BODY_PROFILE'
    throw err
  }

  const gender = required(input, 'gender', '性别')
  if (!GENDERS.has(gender)) {
    const err = new Error('性别参数不合法')
    err.status = 400
    err.code = 'INVALID_BODY_PROFILE'
    throw err
  }

  const visualBody = required(input, 'visualBody', '视觉体型')
  const height = numberOrNull(input.height, '身高', { min: 100, max: 250 })
  const weight = numberOrNull(input.weight, '体重', { min: 25, max: 250 })
  if (height === null) {
    const err = new Error('身高不能为空')
    err.status = 400
    err.code = 'INVALID_BODY_PROFILE'
    throw err
  }
  if (weight === null) {
    const err = new Error('体重不能为空')
    err.status = 400
    err.code = 'INVALID_BODY_PROFILE'
    throw err
  }

  const profile = {
    gender,
    styles: styles.map(String),
    skin: typeof input.skin === 'string' ? input.skin : '',
    face: typeof input.face === 'string' ? input.face : '',
    visualBody: String(visualBody),
    height,
    weight,
    bmi: buildBmi(height, weight),
    bust: numberOrNull(input.bust, '胸围', { min: 50, max: 180 }),
    waist: numberOrNull(input.waist, '腰围', { min: 40, max: 180 }),
    hips: numberOrNull(input.hips, '臀围', { min: 50, max: 200 }),
    shoulder: numberOrNull(input.shoulder, '肩宽', { min: 20, max: 100 }),
    thigh: numberOrNull(input.thigh, '大腿围', { min: 25, max: 120 }),
    calf: numberOrNull(input.calf, '小腿围', { min: 20, max: 100 }),
    preferences: input.preferences && typeof input.preferences === 'object' ? input.preferences : {},
  }

  return repo.upsertProfile(userId, profile)
}

/* ============ AI 可写的偏好记忆（跨会话） ============ */

/** 偏好最多存几条。满了淘汰最早写入的那条（JS 对象保插入顺序） */
const PREFERENCE_MAX_KEYS = 20
const PREFERENCE_KEY_MAX = 32
const PREFERENCE_VALUE_MAX = 200

/**
 * 记一条用户偏好。给 AI 工具 `remember_preference` 用。
 *
 * ⚠️ **这是模型能触发的写操作，所以每一条约束都是必要的，不是防御性洁癖**：
 *
 *   - 只写 `preferences` 一列（走 repo.updatePreferences，不走 saveProfile）——
 *     模型碰不到身形数据，也没有能力整行覆盖。
 *   - key / value 都强制转字符串并截断 —— 否则一次 prompt injection 就能往这行里
 *     塞任意大的内容，把 JSON 列撑爆。
 *   - 只存扁平的 string → string，不接受嵌套对象。
 *   - 条数封顶，满了淘汰最早的 —— 记忆是有限容量的，无上限增长等于没有淘汰策略。
 *
 * userId 由调用方（HTTP 侧的 JWT / MCP 侧的启动配置）给定，**不从模型参数取**，
 * 理由同 MCP 那条：模型填的身份不可信。
 *
 * @returns {Promise<{ ok: boolean, reason?: string, key?: string, value?: string, total?: number }>}
 */
export async function rememberPreference(userId, key, value) {
  const k = String(key ?? '')
    .trim()
    .slice(0, PREFERENCE_KEY_MAX)
  const v = String(value ?? '')
    .trim()
    .slice(0, PREFERENCE_VALUE_MAX)
  if (!k || !v) return { ok: false, reason: 'EMPTY' }

  const profile = await repo.findLatestProfile(userId)
  // 没做过风格测试就没有画像行。不隐式建行，理由见 repo.updatePreferences 的注释
  if (!profile) return { ok: false, reason: 'NO_PROFILE' }

  const next = { ...(profile.preferences || {}) }
  if (!(k in next) && Object.keys(next).length >= PREFERENCE_MAX_KEYS) {
    delete next[Object.keys(next)[0]] // 淘汰最早写入的
  }
  next[k] = v

  const saved = await repo.updatePreferences(userId, next)
  if (!saved) return { ok: false, reason: 'NO_PROFILE' }
  return { ok: true, key: k, value: v, total: Object.keys(next).length }
}
