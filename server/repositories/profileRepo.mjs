/**
 * 个人身形档案仓库层
 *
 * 只负责 body_profiles 的读写。每个查询都必须带 user_id，
 * 与衣橱、风格报告使用同一套数据隔离规则。
 */
import { execute, getOne } from '../db/mysql.mjs'

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapProfile(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    gender: row.gender || '',
    styles: parseJson(row.styles, []),
    skin: row.skin || '',
    face: row.face || '',
    visualBody: row.body_type || '',
    height: row.height === null ? null : Number(row.height),
    weight: row.weight === null ? null : Number(row.weight),
    bmi: row.bmi === null ? null : Number(row.bmi),
    bust: row.bust === null ? null : Number(row.bust),
    waist: row.waist === null ? null : Number(row.waist),
    hips: row.hips === null ? null : Number(row.hips),
    shoulder: row.shoulder === null ? null : Number(row.shoulder),
    thigh: row.thigh === null ? null : Number(row.thigh),
    calf: row.calf === null ? null : Number(row.calf),
    preferences: parseJson(row.preferences, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function findLatestProfile(userId) {
  const row = await getOne(
    `SELECT id, user_id, gender, styles, skin, face, body_type,
            height, weight, bmi, bust, waist, hips, shoulder, thigh, calf,
            preferences, created_at, updated_at
       FROM body_profiles
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [userId],
  )
  return mapProfile(row)
}

export async function findProfileById(userId, id) {
  const row = await getOne(
    `SELECT id, user_id, gender, styles, skin, face, body_type,
            height, weight, bmi, bust, waist, hips, shoulder, thigh, calf,
            preferences, created_at, updated_at
       FROM body_profiles
      WHERE id = ? AND user_id = ?`,
    [id, userId],
  )
  return mapProfile(row)
}

export async function upsertProfile(userId, profile) {
  const existing = await getOne('SELECT id FROM body_profiles WHERE user_id = ? ORDER BY id DESC LIMIT 1', [userId])
  const values = [
    profile.gender,
    JSON.stringify(profile.styles),
    profile.skin,
    profile.face,
    profile.visualBody,
    profile.height,
    profile.weight,
    profile.bmi,
    profile.bust,
    profile.waist,
    profile.hips,
    profile.shoulder,
    profile.thigh,
    profile.calf,
    JSON.stringify(profile.preferences),
  ]

  if (existing) {
    await execute(
      `UPDATE body_profiles
          SET gender = ?, styles = ?, skin = ?, face = ?, body_type = ?,
              height = ?, weight = ?, bmi = ?, bust = ?, waist = ?,
              hips = ?, shoulder = ?, thigh = ?, calf = ?, preferences = ?
        WHERE id = ? AND user_id = ?`,
      [...values, existing.id, userId],
    )
    return findProfileById(userId, existing.id)
  }

  const result = await execute(
    `INSERT INTO body_profiles
      (user_id, gender, styles, skin, face, body_type,
       height, weight, bmi, bust, waist, hips, shoulder, thigh, calf, preferences)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, ...values],
  )
  return findProfileById(userId, result.insertId)
}
