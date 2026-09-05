/**
 * AI 数据仓库层（Repository）
 *
 * 「真数据」的落地点：风格报告、会话、消息、AI 调用日志。
 * 之前这些全是 return {} / return [] 的占位 —— AI 出的结果刷新就没了，
 * 所谓「历史记录」在库里一行都没有。
 *
 * 会话相关的查询都带 user_id：会话 id 是自增整数，最容易被改 URL 试别人的。
 */
import { getAll, getOne, execute } from '../db/mysql.mjs'

/* ============ 风格报告 ============ */

/** 保存一份风格报告，返回新 id。answers/result 存 JSON 列 */
export async function saveStyleReport(userId, answers, result) {
  const r = await execute('INSERT INTO style_reports (user_id, answers, result) VALUES (?, ?, ?)', [
    userId,
    JSON.stringify(answers ?? null),
    JSON.stringify(result ?? null),
  ])
  return r.insertId
}

/** 报告列表（不带 result 正文，列表页不需要，省流量） */
export async function listStyleReports(userId, limit = 20) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 20, 100))
  return getAll(
    `SELECT id, created_at FROM style_reports
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ${safeLimit}`,
    [userId],
  )
}

/** 单份报告；不属于该用户返回 null */
export async function findStyleReport(userId, id) {
  return getOne('SELECT id, answers, result, created_at FROM style_reports WHERE id = ? AND user_id = ?', [id, userId])
}

/* ============ 会话 ============ */

export async function createChatSession(userId, title = '新对话') {
  const r = await execute('INSERT INTO chat_sessions (user_id, title) VALUES (?, ?)', [
    userId,
    String(title).slice(0, 120),
  ])
  return r.insertId
}

export async function listChatSessions(userId, limit = 30) {
  return getAll(
    `SELECT s.id, s.title, s.created_at,
            (SELECT COUNT(*) FROM chat_messages m WHERE m.session_id = s.id) AS message_count
       FROM chat_sessions s
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC
      LIMIT ?`,
    [userId, Number(limit)],
  )
}

/** 校验会话归属 —— 写消息前必须过这一关，否则能往别人会话里插话 */
export async function findChatSession(userId, sessionId) {
  return getOne('SELECT id, title, created_at FROM chat_sessions WHERE id = ? AND user_id = ?', [sessionId, userId])
}

export async function deleteChatSession(userId, sessionId) {
  const r = await execute('DELETE FROM chat_sessions WHERE id = ? AND user_id = ?', [sessionId, userId])
  // 消息靠 chat_messages 的 ON DELETE CASCADE 一起清，不用手动删
  return r.affectedRows > 0
}

/* ============ 消息 ============ */

/**
 * 存一条消息。注意 chat_messages 表上没有 user_id 列，
 * 归属靠 session_id → chat_sessions.user_id 传递，
 * 所以调用方必须先用 findChatSession 验过会话是自己的。
 */
export async function saveChatMessage(sessionId, role, content) {
  const r = await execute('INSERT INTO chat_messages (session_id, role, content) VALUES (?, ?, ?)', [
    sessionId,
    role,
    content ?? '',
  ])
  return r.insertId
}

/** 拉一个会话的消息（已验权后调用），顺序正序，直接能喂给模型 */
export async function listChatMessages(sessionId, limit = 100) {
  return getAll(
    `SELECT id, role, content, created_at
       FROM chat_messages WHERE session_id = ?
      ORDER BY id ASC LIMIT ?`,
    [sessionId, Number(limit)],
  )
}

/* ============ AI 调用日志（可观测性，Day6 接线） ============ */

/**
 * 记一次大模型调用。日志失败不能影响主流程 —— 所以这里自己吞异常。
 * 「监控把业务搞挂了」是很常见的线上事故。
 */
export async function logAiCall(entry = {}) {
  try {
    await execute(
      `INSERT INTO ai_logs
         (user_id, scene, provider, model, prompt_tokens, completion_tokens, latency_ms, ok, error_msg)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId ?? null,
        entry.scene || 'unknown',
        entry.provider || null,
        entry.model || null,
        entry.promptTokens || 0,
        entry.completionTokens || 0,
        entry.latencyMs || 0,
        entry.ok === false ? 0 : 1,
        entry.errorMsg ? String(entry.errorMsg).slice(0, 500) : null,
      ],
    )
  } catch (err) {
    console.warn('[ai_logs] 写入失败（已忽略，不影响主流程）:', err.message)
  }
}
