/**
 * 赛前一键重置（规格 §15「演示账号数据提前准备并可在比赛前重置」）
 *
 *   npm run seed:all             幂等补齐，不动已有数据
 *   npm run seed:all -- --reset  先清空演示账号的业务数据再重灌
 *
 * 以前重置要记住四条命令的顺序（db:init → seed:demo → custom:seed，
 * 场景模板和社区互动还没人灌），漏一步就是「演示到一半发现某页是空的」。
 * 这里把顺序固化下来，一条命令跑完六个功能的演示数据。
 *
 * 顺序是有依赖的，别调换：
 *   1. initDb  建表 + 迁移，顺带 seedCommunityIfNeeded()（功能六内容与互动）
 *   2. 三份全局目录：配饰 / 场景商城 / 设计师 —— 演示账号的车和申请要引用它们
 *   3. 演示账号（含衣橱、画像、搭配）
 *   4. 场景模板：要先有衣橱才生成得出方案
 *   5. 功能五演示申请：独立的 dev-tag 账号，和上面互不影响
 */
import { closeDb, initDb } from '../db/mysql.mjs'
import { ensureAccessories } from '../services/accessoryService.mjs'
import {
  ensureSceneCatalog,
  generateScenePlans,
  listSceneOutfits,
  saveOutfit,
} from '../services/sceneService.mjs'
import {
  advanceRequest,
  createInquiry,
  ensureDesigners,
  listRequests,
  upgradeMembership,
} from '../services/customService.mjs'
import { ensureDemoData } from '../services/demoSeedService.mjs'
import { seedCommunityIfNeeded } from '../services/communitySeedService.mjs'
import { DEMO_ACCOUNTS, demoPasswordOf, wxLogin } from '../services/authService.mjs'

const reset = process.argv.includes('--reset')

function seasonNow(month = new Date().getMonth() + 1) {
  if (month >= 3 && month <= 5) return '春季'
  if (month >= 6 && month <= 8) return '夏季'
  if (month >= 9 && month <= 11) return '秋季'
  return '冬季'
}

/** 每个演示账号预置两套场景模板，让「我的搭配」一进去就有东西（§8.11 §10.10） */
const SCENE_TEMPLATES = [
  { sceneKey: 'daily', filterKey: 'day', mode: 'mixed' },
  { sceneKey: 'business', filterKey: 'indoor', mode: 'pure' },
]

async function seedSceneOutfits(userId, label) {
  const existing = await listSceneOutfits(userId)
  if (existing.length) return { skipped: true, count: existing.length }

  const season = seasonNow()
  let saved = 0
  for (const template of SCENE_TEMPLATES) {
    const result = await generateScenePlans({
      userId,
      sceneKey: template.sceneKey,
      season,
      weather: { city: '杭州', temp: 22, condition: '多云', icon: '⛅', source: 'fallback' },
    })
    const plan = result.plans[template.mode]?.[0]
    // 衣橱不够时纯旧衣方案可能凑不出一套，跳过而不是让整条种子失败
    if (!plan?.items?.length) continue
    await saveOutfit(userId, {
      sceneKey: template.sceneKey,
      title: `${result.scene.label} · ${season}`,
      season,
      mode: plan.mode,
      filterKey: template.filterKey,
      weather: result.weather,
      composition: plan.items,
    })
    saved += 1
  }
  if (!saved) console.warn(`   ⚠️ ${label} 衣橱不足，未生成场景模板`)
  return { skipped: false, count: saved }
}

/** 功能五：一个标准会员 + 一个 VIP，各带一条真实申请 */
async function seedCustomDemo() {
  const standard = await wxLogin('custom_demo_standard', { nickname: '标准会员演示号' })
  const vip = await wxLogin('custom_demo_vip', { nickname: 'VIP 会员演示号' })
  await upgradeMembership(vip.userId)

  if (!(await listRequests(standard.userId)).length) {
    await createInquiry(standard.userId, {
      serviceType: 'body',
      requirements: '孕妇通勤连衣裙，需要可调节腰头和透气面料',
      budget: '800-1200',
      referenceImages: [],
    })
  }
  if (!(await listRequests(vip.userId)).length) {
    const request = await createInquiry(vip.userId, {
      serviceType: 'taste',
      requirements: '手工刺绣礼服，参考明星同款轮廓',
      vipOnly: true,
      referenceImages: [],
    })
    // 推一档，好演示「进度不是一直停在已提交」
    await advanceRequest(vip.userId, request.id)
  }
  return { standard: standard.userId, vip: vip.userId }
}

async function main() {
  console.log(`\n=== 演示数据重置${reset ? '（--reset：先清空演示账号业务数据）' : ''} ===\n`)

  await initDb()
  console.log('✅ 建表与迁移完成')

  const communityCount = await seedCommunityIfNeeded()
  console.log(`✅ 功能六社区内容与互动：${communityCount} 条已发布内容`)

  const accessorySeed = await ensureAccessories()
  console.log(`✅ 配饰目录：新增 ${accessorySeed.inserted} 件`)
  await ensureSceneCatalog()
  console.log('✅ 场景商城目录已就绪（商城页读的也是这张表）')
  const designerSeed = await ensureDesigners()
  console.log(`✅ 定制设计师：新增 ${designerSeed.inserted} 位`)

  const summary = await ensureDemoData({ reset })
  console.log('\n演示账号：')
  for (const entry of summary) {
    const meta = DEMO_ACCOUNTS.find((item) => item.kind === entry.kind)
    const status = entry.ok ? '✅' : `❌ ${entry.error}`
    console.log(
      `  ${status} ${meta?.label ?? entry.kind}  账号 ${entry.account}  密码 ${demoPasswordOf(meta)}  userId=${entry.userId}`,
    )
  }

  console.log('\n场景模板（我的搭配 · 场景那一组）：')
  for (const entry of summary) {
    // blank 账号要保持「从零开始」，admin 不演示业务数据
    if (!entry.ok || entry.kind === 'blank' || entry.kind === 'admin') continue
    const label = DEMO_ACCOUNTS.find((item) => item.kind === entry.kind)?.label ?? entry.kind
    const result = await seedSceneOutfits(entry.userId, label)
    console.log(
      `  ✅ ${label}  ${result.skipped ? `已有 ${result.count} 套，跳过` : `新增 ${result.count} 套`}`,
    )
  }

  const custom = await seedCustomDemo()
  console.log('\n功能五演示账号（dev-tag 登录）：')
  console.log(`  ✅ 标准会员  dev-tag custom_demo_standard  userId=${custom.standard}`)
  console.log(`  ✅ VIP 会员  dev-tag custom_demo_vip       userId=${custom.vip}`)

  console.log('\n密码可用环境变量覆盖：DEMO_FEMALE_PASSWORD / DEMO_MALE_PASSWORD / DEMO_BLANK_PASSWORD / ADMIN_PASSWORD')
  console.log('\n🎉 演示数据已就绪\n')
}

main()
  .catch((error) => {
    console.error('\n❌ 演示数据重置失败:', error)
    process.exitCode = 1
  })
  .finally(() => closeDb())
