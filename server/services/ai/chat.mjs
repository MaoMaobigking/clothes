/**
 * 对话会话编排。
 *
 * 为什么要有这一层：`repositories/aiRepo.mjs` 里会话/消息的六个函数早就写好了，
 * 但全项目零调用 —— chat_sessions / chat_messages 两张表建了却一行数据没有，
 * AI 回答生成完就丢，刷新即无。项目总纲的原话是「存了才是产品，不存只是调 API」。
 *
 * 这一层负责「多步操作 + 越权校验」，路由层只管 HTTP：
 *   - 没有 sessionId 就建一个，标题用首句截断
 *   - 写消息前必须先验会话归属
 *   - 读历史、列会话、删会话同理
 *
 * ⚠️ 归属校验为什么不能省：chat_messages 表上**没有 user_id 列**，
 * 归属靠 session_id → chat_sessions.user_id 传递（见 aiRepo.mjs 的注释）。
 * 少一次 findChatSession，别人就能往你的会话里插话、或读走你的历史 ——
 * 会话 id 是自增整数，是最容易被改 URL 试出来的那种。
 */
import * as aiRepo from '../../repositories/aiRepo.mjs'

/** 标题长度。数据库列是 VARCHAR(120)，这里留点余量 */
const TITLE_MAX = 40

function notFound() {
  const err = new Error('会话不存在或不属于当前用户')
  err.status = 404
  err.code = 'CHAT_SESSION_NOT_FOUND'
  return err
}

function buildTitle(firstMessage) {
  const text = String(firstMessage || '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!text) return '新对话'
  return text.length > TITLE_MAX ? text.slice(0, TITLE_MAX) + '…' : text
}

/**
 * 拿到一个确定属于该用户的 sessionId。
 *
 * 传了 id 就校验归属（不属于自己直接 404，不区分「不存在」和「是别人的」——
 * 区分了等于告诉攻击者哪些 id 是存在的）；没传就新建。
 *
 * @param {number} userId
 * @param {number|string} [sessionId] 前端续聊时带上
 * @param {string} [firstMessage] 新建时用来生成标题
 * @returns {Promise<number>}
 */
export async function ensureSession(userId, sessionId, firstMessage) {
  const id = Number(sessionId)
  if (Number.isInteger(id) && id > 0) {
    const found = await aiRepo.findChatSession(userId, id)
    if (!found) throw notFound()
    return id
  }
  return aiRepo.createChatSession(userId, buildTitle(firstMessage))
}

/**
 * 追加一条消息。会话归属先验后写。
 *
 * 失败不抛给调用方：存历史挂了不该让已经生成好的回答发不出去。
 * 但会打日志 —— 静默丢数据比报错更难查。
 */
export async function appendMessage(userId, sessionId, role, content) {
  try {
    const found = await aiRepo.findChatSession(userId, sessionId)
    if (!found) throw notFound()
    return await aiRepo.saveChatMessage(sessionId, role, content)
  } catch (err) {
    console.warn(`[chatService] 消息落库失败（session=${sessionId}, role=${role}）:`, err.message)
    return null
  }
}

export function listSessions(userId) {
  return aiRepo.listChatSessions(userId)
}

/** 会话详情 + 全部消息。不属于自己抛 404 */
export async function getHistory(userId, sessionId) {
  const session = await aiRepo.findChatSession(userId, sessionId)
  if (!session) throw notFound()
  const messages = await aiRepo.listChatMessages(sessionId)
  return { session, messages }
}

export async function removeSession(userId, sessionId) {
  const ok = await aiRepo.deleteChatSession(userId, sessionId)
  if (!ok) throw notFound()
  return true
}

/* ============ 风格报告（把路由对 repo 的直接调用收进来）============ */

/*
 * 这三个原本是 routes/ai.mjs 直接 import repositories/aiRepo 调的 ——
 * 它是全项目唯一这么干的路由文件，其余一律经 service。
 * 搬到这里只为把那处分层旁路补上，逻辑一行没改。
 */

export function saveReport(userId, answers, result) {
  return aiRepo.saveStyleReport(userId, answers, result)
}

export function listReports(userId) {
  return aiRepo.listStyleReports(userId)
}

export async function getReport(userId, id) {
  const report = await aiRepo.findStyleReport(userId, id)
  if (!report) {
    const err = new Error('报告不存在')
    err.status = 404
    err.code = 'NOT_FOUND'
    throw err
  }
  return report
}
