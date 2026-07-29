/**
 * 建库建表脚本（幂等，可反复跑）
 *
 * 用法：cd server && npm run db:init
 *
 * 为什么不用 mysql CLI 灌 schema.sql：
 *   Windows 上大多没装 mysql 客户端，而 `docker exec ... < schema.sql` 的重定向
 *   在不同 shell 里行为不一致。走 mysql2 执行，跨平台且和服务端启动逻辑同一套代码。
 */
import { initDb, getAll, closeDb, DB_NAME } from '../db/mysql.mjs'

try {
  await initDb()
  const tables = await getAll(
    'SELECT TABLE_NAME AS t FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? ORDER BY TABLE_NAME',
    [DB_NAME],
  )
  console.log(`✅ 数据库 ${DB_NAME} 就绪，共 ${tables.length} 张表：`)
  console.log('   ' + tables.map((r) => r.t).join(', '))
} catch (err) {
  console.error('❌ 建表失败:', err.message)
  process.exitCode = 1
} finally {
  await closeDb()
}
