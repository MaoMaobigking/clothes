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
import { config } from '../config/env.mjs'

const here = dirname(fileURLToPath(import.meta.url))

/*
 * 连接参数的读取、归一化和体检已上移到 config/env.mjs 的 resolveDbConfig()
 * （包括「MYSQL_HOST 粘了端口」「MYSQL_PORT 填成服务端口」那两条真实踩坑的纠正）。
 * 这一层只管拿现成的值建池，不再自己读 process.env。
 *
 * 体检结论从 config 导出的 CONFIG_NOTES 走，由 index.mjs 在连库前打印。
 *
 * 注意这里要把 database / target / hostConfigured 三个非连接参数摘干净再展开：
 * mysql2 收到不认识的键会打一行 "Ignoring invalid configuration option" 警告。
 */
const { database: DB_NAME, target: DB_TARGET, hostConfigured: _hostConfigured, ...DB_CONFIG } = config.db

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
    await migrateCustomTables(conn)
    await migrateCommunityRoles(conn)
    await migrateAccounts(conn)
    await migrateCart(conn)
  } finally {
    await conn.end()
  }
  const { seedCommunityIfNeeded } = await import('../services/communitySeedService.mjs')
  await seedCommunityIfNeeded()
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

/**
 * 功能五给 users 表新增角色和会员等级。旧库中的 users 已存在时，
 * CREATE TABLE IF NOT EXISTS 不会自动补列，这里和功能一的体型迁移走同一策略。
 */
async function migrateCustomTables(conn) {
  const columns = [
    ['role', "VARCHAR(32) NOT NULL DEFAULT 'user'"],
    ['membership_level', "VARCHAR(32) NOT NULL DEFAULT 'standard'"],
  ]
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
    [DB_NAME],
  )
  const existing = new Set(rows.map((row) => row.name))
  for (const [name, ddl] of columns) {
    if (!existing.has(name)) {
      await conn.query(`ALTER TABLE users ADD COLUMN ${name} ${ddl}`)
    }
  }
}

/**
 * 功能六需要 users.role 兼容旧开发库。
 * 功能五已经补齐 role 与 membership_level，这里保留旧版本兜底。
 */
async function migrateCommunityRoles(conn) {
  const [rows] = await conn.query(
    `SELECT COLUMN_NAME AS name
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'`,
    [DB_NAME],
  )
  if (!rows.some((row) => row.name === 'role')) {
    await conn.query("ALTER TABLE users ADD COLUMN role VARCHAR(32) NOT NULL DEFAULT 'user'")
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
    ['is_starred', 'TINYINT(1) DEFAULT 0'],
  ]
  for (const [name, ddl] of outfitColumns) {
    await ensureColumn(conn, 'outfits', name, ddl)
  }
}

export async function closeDb() {
  await pool.end()
}

/** 索引是否存在（唯一索引不能用 ADD 重复执行，先查 information_schema） */
async function hasIndex(conn, table, indexName) {
  const [rows] = await conn.query(
    `SELECT INDEX_NAME AS name
       FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [DB_NAME, table, indexName],
  )
  return rows.length > 0
}

/**
 * 规格 §5：账号密码登录与四类预置演示账号。
 * 旧开发库的 users 已存在，CREATE TABLE IF NOT EXISTS 不会补列，这里增量补。
 *
 * account 上的唯一索引单独建：多个普通微信用户的 account 都是 NULL，
 * MySQL 的唯一索引允许多个 NULL，所以不会互相撞车。
 */
async function migrateAccounts(conn) {
  const columns = [
    ['account', 'VARCHAR(64) NULL'],
    ['password_hash', 'VARCHAR(160) NULL'],
    ['demo_kind', 'VARCHAR(32) NULL'],
  ]
  for (const [name, ddl] of columns) {
    await ensureColumn(conn, 'users', name, ddl)
  }
  if (!(await hasIndex(conn, 'users', 'uq_users_account'))) {
    await conn.query('ALTER TABLE users ADD UNIQUE KEY uq_users_account (account)')
  }
}

/**
 * 规格 §4.5 §13：购物车统一到单张 cart_items。
 *
 * 三件事，都必须幂等（每次启动都会跑）：
 *   1. item_type 枚举加 'catalog'，用来装 scene_catalog 的场景新品。
 *   2. 把功能二旧表 feature2_cart_items 的存量搬进来，然后 DROP 掉旧表。
 *      幂等靠「表没了」本身保证：下次启动查不到表，整段直接跳过，
 *      不会把数量重复累加。schema.sql 里也已删掉这张表的 CREATE，
 *      否则会变成「建表→搬空→删表」每次启动空转一轮。
 *   3. 修历史脏数据：功能四曾把 scene_catalog 的 id 以 item_type='garment'
 *      写进来，而功能三按 garment 去 garments 查明细查不到，这些行会被
 *      静默丢掉。这里按 id 是否命中 scene_catalog 改判成 'catalog'。
 *
 * 第 3 步必须排在第 1 步之后 —— 'catalog' 不在旧枚举里，先改数据会被 MySQL
 * 截断成空串。
 */
async function migrateCart(conn) {
  const [typeRows] = await conn.query(
    `SELECT COLUMN_TYPE AS type
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'cart_items' AND COLUMN_NAME = 'item_type'`,
    [DB_NAME],
  )
  if (!typeRows.length) return
  if (!typeRows[0].type.includes("'catalog'")) {
    await conn.query(
      `ALTER TABLE cart_items
        MODIFY COLUMN item_type ENUM('garment','accessory','catalog') NOT NULL`,
    )
  }

  const [legacy] = await conn.query(
    `SELECT TABLE_NAME AS name
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'feature2_cart_items'`,
    [DB_NAME],
  )
  if (legacy.length) {
    // 旧表允许同一件衣物按 source_outfit_id 存多行，新表 (user,type,item) 唯一，
    // 所以先按新表主键聚合再插入，避免同一批 INSERT 内部自撞。
    await conn.query(
      `INSERT INTO cart_items (user_id, item_type, item_id, quantity, source_outfit_id)
       SELECT f.user_id, 'garment', f.garment_id,
              LEAST(99, SUM(f.quantity)),
              CAST(MIN(f.source_outfit_id) AS CHAR)
         FROM feature2_cart_items f
         JOIN garments g ON g.id = f.garment_id AND g.user_id = f.user_id
        GROUP BY f.user_id, f.garment_id
       ON DUPLICATE KEY UPDATE
         quantity = LEAST(99, cart_items.quantity + VALUES(quantity)),
         source_outfit_id = COALESCE(cart_items.source_outfit_id, VALUES(source_outfit_id))`,
    )
    await conn.query('DROP TABLE feature2_cart_items')
  }

  // 只改「在 scene_catalog 里、且不是该用户真实衣物」的行。
  // 多一道 garments 的 LEFT JOIN 是防御性的：万一两张目录 id 撞车，
  // 真实衣物优先，不能被误判成场景新品。
  await conn.query(
    `UPDATE cart_items c
       JOIN scene_catalog sc ON sc.id = c.item_id
       LEFT JOIN garments g ON g.id = c.item_id AND g.user_id = c.user_id
        SET c.item_type = 'catalog'
      WHERE c.item_type = 'garment' AND g.id IS NULL`,
  )
}

/**
 * 只给 scripts/checkCart.mjs 用：单独跑一次购物车迁移，验证幂等性。
 * 业务代码不要调用 —— 迁移的正常入口是 initDb()。
 */
export async function migrateCartForCheck() {
  const conn = await mysql.createConnection({ ...DB_CONFIG, database: DB_NAME })
  try {
    await migrateCart(conn)
  } finally {
    await conn.end()
  }
}

export { pool, DB_NAME, DB_TARGET }
