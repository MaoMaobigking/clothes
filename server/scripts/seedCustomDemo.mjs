/**
 * 功能五演示数据：预置一个标准会员和一个 VIP 会员，
 * 并各创建一条真实定制申请，方便现场直接演示入口、进度与 VIP 限制。
 */
import { closeDb, initDb } from '../db/mysql.mjs'
import { wxLogin } from '../services/authService.mjs'
import {
  advanceRequest,
  createInquiry,
  ensureDesigners,
  listRequests,
  upgradeMembership,
} from '../services/customService.mjs'

await initDb()
await ensureDesigners()

const standard = await wxLogin('custom_demo_standard', {
  nickname: '标准会员演示号',
})
const vip = await wxLogin('custom_demo_vip', {
  nickname: 'VIP 会员演示号',
})
await upgradeMembership(vip.userId)

const standardRequests = await listRequests(standard.userId)
if (!standardRequests.length) {
  await createInquiry(standard.userId, {
    serviceType: 'body',
    requirements: '孕妇通勤连衣裙，需要可调节腰头和透气面料',
    budget: '800-1200',
    referenceImages: [],
  })
}

const vipRequests = await listRequests(vip.userId)
if (!vipRequests.length) {
  const request = await createInquiry(vip.userId, {
    serviceType: 'taste',
    requirements: '手工刺绣礼服，参考明星同款轮廓',
    vipOnly: true,
    referenceImages: [],
  })
  await advanceRequest(vip.userId, request.id)
}

console.log('✅ 功能五演示账号已就绪')
console.log(`   标准会员 dev-tag: custom_demo_standard`)
console.log(`   VIP 会员 dev-tag: custom_demo_vip`)
console.log('   小程序当前随机 dev-tag 可在本地 storage 中临时替换为上述值。')

await closeDb()
