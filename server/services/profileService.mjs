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
