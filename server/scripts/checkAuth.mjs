/**
 * 登录与预置演示账号验收（规格 §5）
 *
 * 用法：cd server && npm run check:auth
 *
 * 验证点：
 *   1. 四类预置演示账号都存在，角色正确
 *   2. 账号密码登录成功，密码错误返回 401
 *   3. 空白新账号确实是空的（无衣橱、无画像），演示账号确实有数据
 *   4. 微信一键注册：首次建号 isNewUser=true，同 code 再登还是同一个人
 *   5. 管理员密码登录返回 admin 角色
 *   6. 跨用户隔离：A 读不到 B 的画像、衣橱、报告
 */
import { closeDb, initDb } from '../db/mysql.mjs'
import {
  DEMO_ACCOUNTS,
  adminLogin,
  demoPasswordOf,
  listDemoAccounts,
  passwordLogin,
  wxLogin,
} from '../services/authService.mjs'
import { ensureDemoData } from '../services/demoSeedService.mjs'
import { ensureAccessories } from '../services/accessoryService.mjs'
import * as garmentService from '../services/garmentService.mjs'
import * as profileService from '../services/profileService.mjs'
import * as outfitService from '../services/outfitService.mjs'
import * as aiRepo from '../repositories/aiRepo.mjs'

let failed = 0
function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed += 1
}

async function expectReject(label, fn, expectedCode) {
  try {
    await fn()
    check(label, false, '本应失败却成功了')
  } catch (error) {
    check(label, error.code === expectedCode, `code=${error.code}`)
  }
}

await initDb()

try {
  await ensureAccessories()
  await ensureDemoData()

  console.log('\n【1】四类预置演示账号')
  const accounts = await listDemoAccounts()
  for (const meta of DEMO_ACCOUNTS) {
    const row = accounts.find((item) => item.kind === meta.kind)
    check(`${meta.label} 存在`, Boolean(row), row ? `账号 ${row.account}` : '缺失')
  }
  check(
    '管理员账号角色为 admin',
    accounts.find((item) => item.kind === 'admin')?.role === 'admin',
  )

  console.log('\n【2】账号密码登录')
  const female = DEMO_ACCOUNTS.find((item) => item.kind === 'female')
  const femaleLogin = await passwordLogin(female.account, demoPasswordOf(female))
  check('演示女性账号登录成功', Boolean(femaleLogin.token && femaleLogin.userId))
  check('登录返回 demoKind', femaleLogin.demoKind === 'female')
  await expectReject('密码错误被拒绝', () => passwordLogin(female.account, 'wrong-password'), 'LOGIN_FAILED')
  await expectReject('账号不存在被拒绝', () => passwordLogin('no_such_account', 'x'), 'LOGIN_FAILED')
  await expectReject('空密码被拒绝', () => passwordLogin(female.account, ''), 'MISSING_CREDENTIALS')

  console.log('\n【3】演示数据与空白账号')
  const femaleGarments = await garmentService.listGarments(femaleLogin.userId)
  const femaleProfile = await profileService.getLatestProfile(femaleLogin.userId)
  const femaleReports = await aiRepo.listStyleReports(femaleLogin.userId, 5)
  const femaleOutfits = await outfitService.listOutfits(femaleLogin.userId, {})
  check('演示女性有真实衣橱', femaleGarments.length > 0, `${femaleGarments.length} 件`)
  check('演示女性有五步测试画像', Boolean(femaleProfile?.gender === 'female'))
  check('演示女性有历史风格报告', femaleReports.length > 0)
  check('演示女性有历史搭配', femaleOutfits.length > 0, `${femaleOutfits.length} 套`)

  const male = DEMO_ACCOUNTS.find((item) => item.kind === 'male')
  const maleLogin = await passwordLogin(male.account, demoPasswordOf(male))
  const maleProfile = await profileService.getLatestProfile(maleLogin.userId)
  check('演示男性画像性别为 male', maleProfile?.gender === 'male')
  check('演示男性有真实衣橱', (await garmentService.listGarments(maleLogin.userId)).length > 0)

  const blank = DEMO_ACCOUNTS.find((item) => item.kind === 'blank')
  const blankLogin = await passwordLogin(blank.account, demoPasswordOf(blank))
  check('空白账号无画像', (await profileService.getLatestProfile(blankLogin.userId)) === null)
  check('空白账号无历史搭配', (await outfitService.listOutfits(blankLogin.userId, {})).length === 0)

  console.log('\n【4】微信一键注册与再次登录')
  const code = `auth_check_${Date.now().toString(36)}`
  const first = await wxLogin(code)
  const second = await wxLogin(code)
  check('首次登录标记为新用户', first.isNewUser === true)
  check('再次登录回到同一账号', second.isNewUser === false && second.userId === first.userId)

  console.log('\n【5】管理员登录')
  const admin = await adminLogin(process.env.ADMIN_PASSWORD || 'lingxi-admin-demo')
  check('管理员登录返回 admin 角色', admin.role === 'admin')
  await expectReject('管理员错误密码被拒绝', () => adminLogin('nope'), 'ADMIN_LOGIN_FAILED')

  console.log('\n【6】跨用户隔离')
  const other = await wxLogin(`auth_check_other_${Date.now().toString(36)}`)
  const otherGarmentIds = new Set(
    (await garmentService.listGarments(other.userId)).map((item) => item.id),
  )
  check(
    '读不到演示女性的衣物',
    femaleGarments.every((item) => !otherGarmentIds.has(item.id)),
  )
  check(
    '读不到演示女性的搭配',
    (await outfitService.getOutfit(other.userId, femaleOutfits[0]?.id)) === null ||
      (await outfitService.getOutfit(other.userId, femaleOutfits[0]?.id)) === undefined,
  )
  check(
    '读不到演示女性的风格报告',
    (await aiRepo.findStyleReport(other.userId, femaleReports[0].id)) === null,
  )

  console.log(
    failed === 0
      ? '\n🎉 登录与演示账号全部通过\n'
      : `\n❌ ${failed} 项未通过\n`,
  )
  process.exitCode = failed === 0 ? 0 : 1
} finally {
  await closeDb()
}
