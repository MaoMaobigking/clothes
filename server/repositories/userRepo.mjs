/**
 * 用户仓库 — 用户查询与创建（当前为 SQLite 占位，待迁移 MySQL）。
 *
 * 注意：db.mjs 当前未导出 `db` 实例，仅导出函数。
 * 拆分后 db.mjs 需增加 `export { db }`。
 */
import { db } from '../db.mjs'

// ---- 占位实现（待 MySQL 后替换） ----

/**
 * 按微信 openid 查找用户。
 * @param {string} openid
 * @returns {object|null} 用户对象，当前始终返回 null（未实现）。
 */
export function findByOpenid(openid) {
  // TODO: MySQL 上线后实现真实查询
  return null
}

/**
 * 创建新用户。
 * @param {string} openid
 * @param {string} nickname
 * @returns {object} 用户对象（当前返回固定占位 id）。
 */
export function createUser(openid, nickname) {
  // TODO: MySQL 上线后实现真实插入
  return { id: 1, openid, nickname }
}
