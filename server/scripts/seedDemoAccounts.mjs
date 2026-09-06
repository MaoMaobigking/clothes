/**
 * 预置演示账号种子脚本（规格 §15「演示账号数据提前准备并可在比赛前重置」）
 *
 *   npm run seed:demo           幂等补齐，不动已有数据
 *   npm run seed:demo -- --reset 先清空演示账号的业务数据再重灌
 */
import { initDb, closeDb } from '../db/mysql.mjs'
import { ensureDemoData } from '../services/demoSeedService.mjs'
import { DEMO_ACCOUNTS, demoPasswordOf } from '../services/auth/index.mjs'
import { ensureAccessories } from '../services/accessoryService.mjs'

const reset = process.argv.includes('--reset')

async function main() {
  await initDb()
  // 演示账号购物车里要放一件配饰，先保证配饰目录存在
  await ensureAccessories()
  const summary = await ensureDemoData({ reset })

  console.log(`\n演示账号${reset ? '（已重置）' : ''}：`)
  for (const entry of summary) {
    const meta = DEMO_ACCOUNTS.find((item) => item.kind === entry.kind)
    const status = entry.ok ? '✅' : `❌ ${entry.error}`
    console.log(
      `  ${status} ${meta?.label ?? entry.kind}  账号 ${entry.account}  密码 ${demoPasswordOf(meta)}  userId=${entry.userId}`,
    )
  }
  console.log(
    '\n密码可用环境变量覆盖：DEMO_FEMALE_PASSWORD / DEMO_MALE_PASSWORD / DEMO_BLANK_PASSWORD / ADMIN_PASSWORD\n',
  )
}

main()
  .catch((error) => {
    console.error('演示账号初始化失败:', error)
    process.exitCode = 1
  })
  .finally(() => closeDb())
