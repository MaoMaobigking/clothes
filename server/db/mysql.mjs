/**
 * MySQL 数据库连接管理
 * 使用 mysql2/promise 提供异步 API
 */
import mysql from 'mysql2/promise'

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'lingxi',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
})

/**
 * 执行 SQL 查询（自动参数化）
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<[any[], any[]]>}
 */
export async function query(sql, params = []) {
  const [rows, fields] = await pool.execute(sql, params)
  return [rows, fields]
}

/** 获取单行 */
export async function getOne(sql, params = []) {
  const [rows] = await query(sql, params)
  return rows[0] || null
}

/** 获取多行 */
export async function getAll(sql, params = []) {
  const [rows] = await query(sql, params)
  return rows
}

/** 执行写操作（INSERT/UPDATE/DELETE），返回 affectedRows */
export async function execute(sql, params = []) {
  const [result] = await pool.execute(sql, params)
  return result
}

/** 测试连接 */
export async function ping() {
  const conn = await pool.getConnection()
  await conn.ping()
  conn.release()
  return true
}

export { pool }
