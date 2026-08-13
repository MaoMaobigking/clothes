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
    await migrateBodyProfiles(conn)
    await migrateFeatureTwo(conn)
  } finally {
    await conn.end()
  }
}

/**
 * schema.sql 的 CREATE TABLE IF NOT EXISTS 不会改已存在的旧表。
 * 这里补齐功能一新增的体型字段，保证已有开发库也能平滑升级。
 */
async function migrateBodyProfiles(conn) {
  const columns = [
    ['gender', 'VARCHAR(16) NULL'],
    ['styles', 'JSON NULL'],
    ['hips', 'DECIMAL(5,1) NULL'],
    ['shoulder', 'DECIMAL(5,1) NULL'],
    ['updated_at', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'],
  ]
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'body_profiles'`,
    [DB_NAME],
  )
  const existing = new Set(rows.map((row) => row.name))
  for (const [name, ddl] of columns) {
    if (!existing.has(name)) {
      await conn.query(`ALTER TABLE body_profiles ADD COLUMN ${name} ${ddl}`)
    }
  }
}

/** 优雅关闭（测试脚本用，否则进程挂着连接不退出） */
async function ensureColumn(conn, table, name, ddl) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?`,
    [DB_NAME, table],
  )
  if (rows.some((row) => row.name === name)) return false
  await conn.query(`ALTER TABLE ${table} ADD COLUMN ${name} ${ddl}`)
  return true
}

async function migrateFeatureTwo(conn) {
  const garmentColumns = [
    ['primary_color', "VARCHAR(32) DEFAULT ''"],
    ['secondary_colors', 'JSON NULL'],
    ['seasons', 'JSON NULL'],
    ['occasions', 'JSON NULL'],
    ['frequently_worn', 'TINYINT(1) DEFAULT 0'],
    ['sort_order', 'INT DEFAULT 0'],
    ['recognition_status', "VARCHAR(24) DEFAULT 'confirmed'"],
    ['recognition_source', "VARCHAR(24) DEFAULT 'manual'"],
    ['uploaded_at', 'TIMESTAMP NULL'],
  ]
  for (const [name, ddl] of garmentColumns) {
    await ensureColumn(conn, 'garments', name, ddl)
  }

  const outfitColumns = [
    ['batch_id', 'VARCHAR(64) NULL'],
    ['kind', "VARCHAR(24) DEFAULT 'generated'"],
    ['is_saved', 'TINYINT(1) DEFAULT 0'],
    ['season', 'VARCHAR(32) NULL'],
    ['occasion', 'VARCHAR(32) NULL'],
    ['algorithm', 'JSON NULL'],
  ]
  for (const [name, ddl] of outfitColumns) {
    await ensureColumn(conn, 'outfits', name, ddl)
  }
}

export async function closeDb() {
  await pool.end()
}

export { pool, DB_NAME }
