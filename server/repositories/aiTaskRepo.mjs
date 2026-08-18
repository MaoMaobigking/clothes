/**
 * AI 异步任务仓库层（阿里百炼 / DashScope）
 *
 * 一张表装所有能力（capability = 'tryon' / 后续的换脸、场景生成），
 * 所以这里没有一个方法写死 tryon —— 加能力不改这个文件。
 *
 * JSON 列（input / result）写入前 stringify，读出来走 parseJson：
 * mysql2 对 JSON 列在不同版本里有时回对象有时回字符串，两种都得能吃下。
 */
import { execute, getAll, getOne } from '../db/mysql.mjs'

function parseJson(value, fallback = null) {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const TASK_COLS = `
  id, user_id, capability, provider, model, task_id, status,
  input, result, image_url, error_message, created_at, updated_at
`

function mapRow(row) {
  if (!row) return null
  return {
    id: Number(row.id),
    capability: row.capability,
    provider: row.provider,
    model: row.model,
    taskId: row.task_id,
    status: row.status,
    input: parseJson(row.input, {}),
    result: parseJson(row.result, null),
    imageUrl: row.image_url || '',
    errorMessage: row.error_message || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export async function createTask(userId, { capability, provider = 'bailian', model, taskId, status, input }) {
  await execute(
    `INSERT INTO ai_tasks (user_id, capability, provider, model, task_id, status, input)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, capability, provider, model, taskId, status || 'PENDING', JSON.stringify(input ?? {})],
  )
  return findByTaskId(userId, taskId)
}

/**
 * 回写轮询结果。
 *
 * 带 user_id 条件，不是只按 task_id 更新 —— 这个方法的入参来自 HTTP 路径参数，
 * 少了这个条件，构造别人的 task_id 就能改别人的行。
 */
export async function updateStatus(userId, taskId, { status, imageUrl, errorMessage, result }) {
  await execute(
    `UPDATE ai_tasks
        SET status = ?, image_url = ?, error_message = ?, result = ?
      WHERE task_id = ? AND user_id = ?`,
    [
      status,
      imageUrl || null,
      errorMessage ? String(errorMessage).slice(0, 500) : null,
      result === undefined || result === null ? null : JSON.stringify(result),
      taskId,
      userId,
    ],
  )
  return findByTaskId(userId, taskId)
}

export async function findByTaskId(userId, taskId) {
  const row = await getOne(
    `SELECT ${TASK_COLS} FROM ai_tasks WHERE task_id = ? AND user_id = ?`,
    [taskId, userId],
  )
  return mapRow(row)
}

export async function listByUser(userId, { capability, limit = 20 } = {}) {
  // LIMIT 占位符在预处理语句里各版本行为不一致，clamp 后拼进 SQL（同 diaryRepo）
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100))
  const where = ['user_id = ?']
  const params = [userId]
  if (capability) {
    where.push('capability = ?')
    params.push(capability)
  }
  const rows = await getAll(
    `SELECT ${TASK_COLS} FROM ai_tasks
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC
      LIMIT ${safeLimit}`,
    params,
  )
  return rows.map(mapRow)
}
