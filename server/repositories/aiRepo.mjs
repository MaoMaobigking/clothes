/**
 * AI 仓库 — AI 穿搭报告、聊天会话与消息（当前为 SQLite 占位，待迁移 MySQL）。
 *
 * 注意：db.mjs 当前未导出 `db` 实例，仅导出函数。
 * 拆分后 db.mjs 需增加 `export { db }`。
 */
import { db } from '../db.mjs'

// ---- 占位实现（待 MySQL 后替换） ----

/**
 * 保存 AI 穿搭报告。
 * @param {number|string} userId
 * @param {object} report
 * @returns {object} 空对象（占位）。
 */
export function saveStyleReport(userId, report) {
  // TODO: MySQL 上线后实现真实插入
  return {}
}

/**
 * 保存聊天消息。
 * @param {number|string} sessionId
 * @param {string} role - 'user' | 'assistant'
 * @param {string} content
 * @returns {object} 空对象（占位）。
 */
export function saveChatMessage(sessionId, role, content) {
  // TODO: MySQL 上线后实现真实插入
  return {}
}

/**
 * 创建聊天会话。
 * @param {number|string} userId
 * @param {string} title
 * @returns {object} 空对象（占位）。
 */
export function createChatSession(userId, title) {
  // TODO: MySQL 上线后实现真实插入
  return {}
}

/**
 * 列出用户的所有聊天会话。
 * @param {number|string} userId
 * @returns {Array} 空数组（占位）。
 */
export function listChatSessions(userId) {
  // TODO: MySQL 上线后实现真实查询
  return []
}

/**
 * 列出会话的所有聊天消息。
 * @param {number|string} sessionId
 * @returns {Array} 空数组（占位）。
 */
export function listChatMessages(sessionId) {
  // TODO: MySQL 上线后实现真实查询
  return []
}
