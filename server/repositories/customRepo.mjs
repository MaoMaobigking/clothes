/**
 * 定制服务仓库层。
 *
 * 所有用户数据查询都必须带 user_id，和衣橱、画像保持一致。
 * 咨询与量体预约在同一个事务中创建申请，避免页面看到“提交成功”但申请记录不存在。
 */
import { execute, getAll, getOne, withTransaction } from '../db/mysql.mjs'

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function mapRequest(row) {
  if (!row) return null
  return {
    id: row.id,
    serviceType: row.service_type,
    source: row.source,
    status: row.status,
    requirements: parseJson(row.requirements, {}),
    referenceImages: parseJson(row.reference_images, []),
    measurementId: row.measurement_id ?? null,
    designer:
      row.designer_name
        ? {
            id: Number(row.designer_id),
            name: row.designer_name,
            specialty: row.designer_specialty || '',
            avatarUrl: row.designer_avatar || '',
          }
        : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapMeasurement(row) {
  if (!row) return null
  return {
    id: row.id,
    serviceType: row.service_type,
    dimensions: {
      height: Number(row.height),
      weight: Number(row.weight),
      bust: Number(row.bust),
      waist: Number(row.waist),
      hips: Number(row.hips),
      shoulder: Number(row.shoulder),
    },
    frontImage: row.front_image,
    sideImage: row.side_image,
    backImage: row.back_image || '',
    detailImages: parseJson(row.detail_images, []),
    notes: row.notes || '',
    createdAt: row.created_at,
  }
}

function mapMessage(row) {
  return {
    id: row.id,
    sender: row.sender,
    content: row.content,
    designerId: row.designer_id ?? null,
    createdAt: row.created_at,
  }
}

const REQUEST_SELECT = `
  SELECT r.id, r.user_id, r.service_type, r.source, r.requirements,
         r.reference_images, r.measurement_id, r.status,
         r.created_at, r.updated_at,
         d.id AS designer_id, d.name AS designer_name,
         d.specialty AS designer_specialty, d.avatar_url AS designer_avatar
    FROM custom_requests r
    LEFT JOIN designers d ON d.id = r.designer_id`

export async function listRequests(userId) {
  const rows = await getAll(
    `${REQUEST_SELECT}
      WHERE r.user_id = ?
      ORDER BY r.updated_at DESC, r.id DESC`,
    [userId],
  )
  return rows.map(mapRequest)
}

export async function findRequest(userId, id) {
  const row = await getOne(
    `${REQUEST_SELECT}
      WHERE r.id = ? AND r.user_id = ?`,
    [id, userId],
  )
  return mapRequest(row)
}

export async function findMeasurement(userId, id) {
  const row = await getOne(
    `SELECT id, user_id, service_type, height, weight, bust, waist, hips,
            shoulder, front_image, side_image, back_image, detail_images,
            notes, created_at
       FROM custom_measurements
      WHERE id = ? AND user_id = ?`,
    [id, userId],
  )
  return mapMeasurement(row)
}

export async function createInquiryWithRequest(
  userId,
  inquiry,
  request,
) {
  return withTransaction(async (conn) => {
    const [inquiryResult] = await conn.execute(
      `INSERT INTO custom_inquiries
        (user_id, service_type, requirements, budget, size_notes, reference_images)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userId,
        inquiry.serviceType,
        inquiry.requirements,
        inquiry.budget || '',
        inquiry.sizeNotes || '',
        JSON.stringify(inquiry.referenceImages),
      ],
    )
    const [requestResult] = await conn.execute(
      `INSERT INTO custom_requests
        (user_id, service_type, source, requirements, reference_images,
         status, designer_id)
       VALUES (?, ?, 'inquiry', ?, ?, 'submitted', ?)`,
      [
        userId,
        request.serviceType,
        JSON.stringify(request.requirements),
        JSON.stringify(request.referenceImages),
        request.designerId,
      ],
    )
    return {
      inquiryId: inquiryResult.insertId,
      requestId: requestResult.insertId,
    }
  })
}

export async function createMeasurementWithRequest(
  userId,
  measurement,
  request,
) {
  return withTransaction(async (conn) => {
    const [measurementResult] = await conn.execute(
      `INSERT INTO custom_measurements
        (user_id, service_type, height, weight, bust, waist, hips, shoulder,
         front_image, side_image, back_image, detail_images, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        measurement.serviceType,
        measurement.height,
        measurement.weight,
        measurement.bust,
        measurement.waist,
        measurement.hips,
        measurement.shoulder,
        measurement.frontImage,
        measurement.sideImage,
        measurement.backImage || null,
        JSON.stringify(measurement.detailImages),
        measurement.notes || '',
      ],
    )
    const [requestResult] = await conn.execute(
      `INSERT INTO custom_requests
        (user_id, service_type, source, requirements, reference_images,
         measurement_id, status, designer_id)
       VALUES (?, ?, 'measurement', ?, ?, ?, 'submitted', ?)`,
      [
        userId,
        request.serviceType,
        JSON.stringify(request.requirements),
        JSON.stringify(request.referenceImages),
        measurementResult.insertId,
        request.designerId,
      ],
    )
    return {
      measurementId: measurementResult.insertId,
      requestId: requestResult.insertId,
    }
  })
}

export async function listMessages(userId, requestId) {
  const rows = await getAll(
    `SELECT id, sender, content, designer_id, created_at
       FROM custom_messages
      WHERE request_id = ? AND user_id = ?
      ORDER BY id ASC`,
    [requestId, userId],
  )
  return rows.map(mapMessage)
}

export async function insertMessage(
  userId,
  requestId,
  sender,
  content,
  designerId = null,
) {
  const result = await execute(
    `INSERT INTO custom_messages
      (request_id, user_id, sender, designer_id, content)
     VALUES (?, ?, ?, ?, ?)`,
    [requestId, userId, sender, designerId, content],
  )
  return result.insertId
}

export async function updateRequestStatus(userId, id, status) {
  const result = await execute(
    `UPDATE custom_requests
        SET status = ?
      WHERE id = ? AND user_id = ?`,
    [status, id, userId],
  )
  return result.affectedRows > 0
}

export async function getUserMembership(userId) {
  const row = await getOne(
    'SELECT role, membership_level FROM users WHERE id = ?',
    [userId],
  )
  return row
    ? {
        role: row.role || 'user',
        membershipLevel: row.membership_level || 'standard',
      }
    : null
}

export async function upgradeUserMembership(userId) {
  await execute(
    "UPDATE users SET membership_level = 'vip' WHERE id = ?",
    [userId],
  )
  return getUserMembership(userId)
}

export async function countRequests(userId) {
  const row = await getOne(
    'SELECT COUNT(*) AS n FROM custom_requests WHERE user_id = ?',
    [userId],
  )
  return Number(row?.n || 0)
}

export async function findDesignerByKey(designerKey) {
  const row = await getOne(
    `SELECT id, designer_key, name, avatar_url, specialty, bio, active
       FROM designers
      WHERE designer_key = ?`,
    [designerKey],
  )
  return row || null
}

export async function ensureDesigners(designers) {
  let inserted = 0
  for (const designer of designers) {
    const result = await execute(
      `INSERT INTO designers
        (designer_key, name, avatar_url, specialty, bio, active)
       VALUES (?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         avatar_url = VALUES(avatar_url),
         specialty = VALUES(specialty),
         bio = VALUES(bio),
         active = 1`,
      [
        designer.key,
        designer.name,
        designer.avatarUrl || '',
        designer.specialty,
        designer.bio,
      ],
    )
    if (result.affectedRows === 1) inserted += 1
  }
  return inserted
}
