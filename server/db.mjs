/*
 * 数据库抽象层：根据环境变量 DB_TYPE 选择 SQLite 或 MySQL。
 * 默认使用 SQLite（向后兼容），设置 DB_TYPE=mysql 则切换。
 *
 * 启动方式不变：npm run server（node --experimental-sqlite --env-file=.env server/index.mjs）
 *
 * .env 配置示例（MySQL）：
 *   DB_TYPE=mysql
 *   MYSQL_HOST=localhost
 *   MYSQL_PORT=3306
 *   MYSQL_USER=root
 *   MYSQL_PASSWORD=yourpassword
 *   MYSQL_DATABASE=lingxi
 */
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const DB_TYPE = (process.env.DB_TYPE || 'sqlite').toLowerCase()

/* ============ SQLite 后端 ============ */
let sqliteDb = null

function getSqlite() {
  if (!sqliteDb) {
    sqliteDb = new DatabaseSync(join(here, 'data.db'))
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS garments (
        id       TEXT PRIMARY KEY,
        name     TEXT NOT NULL,
        category TEXT NOT NULL,
        brand    TEXT,
        emoji    TEXT,
        "from"   TEXT,
        "to"     TEXT,
        price    INTEGER,
        season   TEXT,
        img      TEXT,
        fav      INTEGER DEFAULT 0,
        created  INTEGER DEFAULT 0
      )
    `)
    // 种子数据
    const count = sqliteDb.prepare('SELECT COUNT(*) AS c FROM garments').get().c
    if (count === 0) {
      const seed = JSON.parse(readFileSync(join(here, 'seed.json'), 'utf-8'))
      const insert = sqliteDb.prepare(
        `INSERT INTO garments (id,name,category,brand,emoji,"from","to",price,season,img,fav,created)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      seed.forEach((g, i) => {
        insert.run(g.id, g.name, g.category, g.brand, g.emoji, g.from, g.to, g.price, g.season, g.img, g.fav ?? 0, i)
      })
      console.log(`🌱 已灌入 ${seed.length} 条衣物种子数据到 data.db`)
    }
  }
  return sqliteDb
}

/* ============ MySQL 后端（懒加载） ============ */
let mysqlPool = null

async function getMysql() {
  if (!mysqlPool) {
    const { default: mysql } = await import('mysql2/promise')
    mysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'lingxi',
      waitForConnections: true,
      connectionLimit: 10,
      charset: 'utf8mb4',
    })
    console.log('🔌 MySQL 连接池已创建')
  }
  return mysqlPool
}

/* ============ 统一接口（同步/异步自适应） ============ */

function rowToGarment(r) {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    brand: r.brand,
    emoji: r.emoji,
    from: r.from,
    to: r.to,
    price: r.price,
    season: r.season,
    img: r.img || r.image_url,
    fav: !!(r.fav),
  }
}

// SQLite 版本
function sqliteGarmentOps() {
  const db = getSqlite()
  return {
    list: () => db.prepare('SELECT * FROM garments ORDER BY created ASC, id ASC').all().map(rowToGarment),
    add: (g) => {
      const id = g.id || 'u' + Date.now()
      const maxCreated = db.prepare('SELECT COALESCE(MAX(created),0) AS m FROM garments').get().m
      db.prepare(
        `INSERT INTO garments (id,name,category,brand,emoji,"from","to",price,season,img,fav,created)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(id, g.name || '新单品', g.category || 'top', g.brand || 'MINE', g.emoji || '👕',
        g.from || '#ffd1e8', g.to || '#c9b8ff', Number(g.price) || 0, g.season || '四季', g.img || '',
        g.fav ? 1 : 0, maxCreated + 1)
      return rowToGarment(db.prepare('SELECT * FROM garments WHERE id=?').get(id))
    },
    remove: (id) => {
      const info = db.prepare('DELETE FROM garments WHERE id=?').run(id)
      return info.changes > 0
    },
    toggleFav: (id) => {
      const row = db.prepare('SELECT fav FROM garments WHERE id=?').get(id)
      if (!row) return null
      const next = row.fav ? 0 : 1
      db.prepare('UPDATE garments SET fav=? WHERE id=?').run(next, id)
      return !!next
    },
  }
}

// MySQL 版本
function mysqlGarmentOps() {
  return {
    list: async () => {
      const p = await getMysql()
      const [rows] = await p.execute('SELECT * FROM garments ORDER BY created_at ASC, id ASC')
      return rows.map(rowToGarment)
    },
    add: async (g) => {
      const p = await getMysql()
      const id = g.id || 'u' + Date.now()
      await p.execute(
        `INSERT INTO garments (id,name,category,brand,emoji,image_url,price,season,fav)
         VALUES (?,?,?,?,?,?,?,?)`,
        [id, g.name || '新单品', g.category || 'top', g.brand || 'MINE', g.emoji || '👕',
         g.img || '', Number(g.price) || 0, g.season || '四季', g.fav ? 1 : 0],
      )
      const [[row]] = await p.execute('SELECT * FROM garments WHERE id=?', [id])
      return rowToGarment(row)
    },
    remove: async (id) => {
      const p = await getMysql()
      const [r] = await p.execute('DELETE FROM garments WHERE id=?', [id])
      return r.affectedRows > 0
    },
    toggleFav: async (id) => {
      const p = await getMysql()
      const [[row]] = await p.execute('SELECT fav FROM garments WHERE id=?', [id])
      if (!row) return null
      const next = row.fav ? 0 : 1
      await p.execute('UPDATE garments SET fav=? WHERE id=?', [next, id])
      return !!next
    },
  }
}

/* ============ 根据 DB_TYPE 导出对应实现 ============ */

const isMysql = DB_TYPE === 'mysql'
const ops = isMysql ? mysqlGarmentOps() : sqliteGarmentOps()

// 同步接口（SQLite 直接用，MySQL 需要上层 await）
// 为保持向后兼容，导出同步版本；MySQL 模式下由上层处理异步
export function listGarments() {
  if (isMysql) throw new Error('MySQL 模式请使用异步接口，或调用 listGarmentsAsync()')
  return ops.list()
}
export function addGarment(g) {
  if (isMysql) throw new Error('MySQL 模式请使用异步接口')
  return ops.add(g)
}
export function deleteGarment(id) {
  if (isMysql) throw new Error('MySQL 模式请使用异步接口')
  return ops.remove(id)
}
export function toggleFav(id) {
  if (isMysql) throw new Error('MySQL 模式请使用异步接口')
  return ops.toggleFav(id)
}

// 异步接口（MySQL 和 SQLite 均可用）
export async function listGarmentsAsync() { return ops.list() }
export async function addGarmentAsync(g) { return ops.add(g) }
export async function deleteGarmentAsync(id) { return ops.remove(id) }
export async function toggleFavAsync(id) { return ops.toggleFav(id) }

// 导出数据库类型和原始实例（供 repo 使用）
export { isMysql, getSqlite, getMysql }

// 导出 db 实例（向后兼容，server/routes 中可能引用）
export const db = DB_TYPE === 'mysql' ? null : getSqlite()
