/**
 * MySQL 数据库基础设施层（全项目唯一的数据库出口）
 *
 * 分层里的位置：这一层只管「怎么连、怎么发 SQL」，不含任何业务 SQL。
 * 业务 SQL 一律写在 repositories/ 里。对标 Spring：这里相当于 DataSource + JdbcTemplate。
 *
 * 历史包袱说明（面试可讲的一次重构）：
 *   原来有两套连接代码 —— server/db.mjs 里的 getMysql() 和本文件，
 *   且 db.mjs 在 MySQL 模式下把 `db` 导出成 null，repo 一调就崩（等于 MySQL 根本跑不起来）。
 *   现已收敛成这一套，SQLite 双轨一并删除。
 */
import mysql from 'mysql2/promise'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))

const DB_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  charset: 'utf8mb4',
}
const DB_NAME = process.env.MYSQL_DATABASE || 'lingxi'

const pool = mysql.createPool({
  ...DB_CONFIG,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // 业务池禁用多语句：多语句是 SQL 注入放大器，只在 initDb 的临时连接里开
  multipleStatements: false,
})

/* ============ 基础查询 API ============ */

/** 原始查询，返回 [rows, fields] */
export async function query(sql, params = []) {
  return pool.execute(sql, params)
}

/** 取单行，没有则 null */
export async function getOne(sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows[0] || null
}

/** 取多行 */
export async function getAll(sql, params = []) {
  const [rows] = await pool.execute(sql, params)
  return rows
}

/**
 * 写操作（INSERT/UPDATE/DELETE），返回 ResultSetHeader。
 * 注意 result.affectedRows —— 越权控制就靠它：
 * `WHERE id=? AND user_id=?` 打不中时 affectedRows===0，上层返 404。
 */
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params)
  return result
}

/**
 * 事务。回调里拿到的 conn 要用 conn.execute()，不能用上面那些池方法
 * （否则会跑在池里另一条连接上，根本不在这个事务里 —— 这是经典坑）。
 *
 * 用法：
 *   await withTransaction(async (conn) => {
 *     await conn.execute('INSERT INTO outfits ...', [...])
 *     await conn.execute('INSERT INTO outfit_items ...', [...])
 *   })
 */
export async function withTransaction(fn) {
  const conn = await pool.getConnection()
  try {
    await conn.beginTransaction()
    const result = await fn(conn)
    await conn.commit()
    return result
  } catch (err) {
    await conn.rollback()
    throw err
  } finally {
    conn.release()
  }
}

/** 测试连通性 */
export async function ping() {
  const conn = await pool.getConnection()
  try {
    await conn.ping()
    return true
  } finally {
    conn.release()
  }
}

/* ============ 初始化 ============ */

/**
 * 建库 + 建表（幂等，每次启动都跑，schema.sql 全是 IF NOT EXISTS）。
 *
 * 为什么要单独开一条连接：
 *   1. schema.sql 里有 CREATE DATABASE，此时目标库可能还不存在，
 *      所以这条连接不能指定 database。
 *   2. schema.sql 是多条语句，需要 multipleStatements: true，
 *      而业务池不该开这个开关。
 */
export async function initDb() {
  const sql = readFileSync(join(here, '..', 'schema.sql'), 'utf-8')
  const conn = await mysql.createConnection({
    ...DB_CONFIG,
    multipleStatements: true,
  })
  try {
    await conn.query(sql)
  } finally {
    await conn.end()
  }
}

/** 优雅关闭（测试脚本用，否则进程挂着连接不退出） */
export async function closeDb() {
  await pool.end()
}

export { pool, DB_NAME }
