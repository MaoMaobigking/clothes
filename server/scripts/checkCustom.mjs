/**
 * 功能五数据层验收：咨询、量体、申请、IM、VIP 和用户隔离。
 *
 * 直调 service，不依赖先起 HTTP 服务，和现有 checkIsolation.mjs 保持同一风格。
 */
import { closeDb, initDb } from '../db/mysql.mjs'
import { wxLogin } from '../services/auth/index.mjs'
import * as customService from '../services/customService.mjs'

let failed = 0
function check(label, ok, extra = '') {
  console.log(`${ok ? '  ✅' : '  ❌'} ${label}${extra ? ' — ' + extra : ''}`)
  if (!ok) failed += 1
}

async function expectFailure(fn, expectedStatus, expectedCode) {
  try {
    await fn()
    return { ok: false, status: null, code: null }
  } catch (err) {
    return {
      ok: err.status === expectedStatus && err.code === expectedCode,
      status: err.status,
      code: err.code,
    }
  }
}

await initDb()
await customService.ensureDesigners()

const stamp = Date.now().toString(36)
const a = await wxLogin(`custom_a_${stamp}`)
const b = await wxLogin(`custom_b_${stamp}`)

console.log('\n【1】四类咨询与量体可真实落库')
const inquiry = await customService.createInquiry(a.userId, {
  serviceType: 'body',
  requirements: '孕妇通勤连衣裙，需要舒适腰头和可调节版型',
  budget: '800-1200',
  sizeNotes: '孕中期，腰围会继续变化',
  referenceImages: ['/uploads/custom/demo-front.png'],
})
check('咨询提交后创建定制申请', inquiry?.status === 'submitted')
check('咨询需求保留', inquiry?.requirements?.requirements?.includes('孕妇通勤'))

const measurement = await customService.createMeasurement(a.userId, {
  serviceType: 'occasion',
  height: 165,
  weight: 55,
  bust: 88,
  waist: 68,
  hips: 92,
  shoulder: 39,
  frontImage: '/uploads/custom/demo-front.png',
  sideImage: '/uploads/custom/demo-side.png',
  notes: '年会礼服，希望兼顾收腰和行动方便',
})
check('量体预约创建申请并关联量体记录', Boolean(measurement?.measurementId))

const aList = await customService.listRequests(a.userId)
const bList = await customService.listRequests(b.userId)
check('A 能看到自己的两条申请', aList.length === 2, `实际 ${aList.length}`)
check('B 看不到 A 的申请', bList.length === 0)

console.log('\n【2】申请详情与设计师 IM')
const detail = await customService.getRequest(a.userId, inquiry.id)
check('申请详情包含六项量体或咨询需求', Boolean(detail.request))
const measurementDetail = measurement.id ? await customService.getRequest(a.userId, measurement.id) : null
check('量体申请返回六项尺寸', Object.keys(measurementDetail?.measurement?.dimensions || {}).length === 6)
const messages = await customService.sendMessage(a.userId, inquiry.id, '希望用更透气、好打理的面料，工期多久？')
check(
  '用户消息已保存',
  messages.some((item) => item.sender === 'user'),
)
check(
  '系统设计师自动回复',
  messages.some((item) => item.sender === 'designer'),
)
check(
  '自动回复结合申请需求',
  messages.some((item) => item.sender === 'designer' && item.content.includes('面料')),
)

const crossRead = await expectFailure(() => customService.getRequest(b.userId, inquiry.id), 404, 'NOT_FOUND')
check('B 读取 A 的申请被拒绝且按 404 处理', crossRead.ok, crossRead.code)

console.log('\n【3】进度推进')
const advanced = await customService.advanceRequest(a.userId, inquiry.id)
check('申请可从已提交推进到设计稿', advanced.status === 'design', advanced.status)

console.log('\n【4】VIP 限制与演示升级')
const vipBlocked = await expectFailure(
  () =>
    customService.createInquiry(b.userId, {
      serviceType: 'taste',
      requirements: '限量面料夹克',
      vipOnly: true,
    }),
  403,
  'VIP_REQUIRED',
)
check('普通会员不能提交 VIP 专属预约', vipBlocked.ok, `${vipBlocked.status}/${vipBlocked.code}`)
const upgraded = await customService.upgradeMembership(b.userId)
check('演示升级后会员等级变为 vip', upgraded.membershipLevel === 'vip')
const vipRequest = await customService.createInquiry(b.userId, {
  serviceType: 'taste',
  requirements: '手工刺绣礼服',
  vipOnly: true,
})
check('VIP 用户可以提交专属申请', vipRequest?.status === 'submitted')

console.log(failed === 0 ? '\n🎉 功能五数据层验收全部通过\n' : `\n❌ ${failed} 项未通过\n`)
process.exitCode = failed === 0 ? 0 : 1
await closeDb()
