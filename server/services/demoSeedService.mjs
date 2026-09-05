/**
 * 预置演示账号数据（规格 §5.2、§15）
 *
 * 四类账号里只有「演示女性」「演示男性」需要预置业务数据；
 * 「空白新账号」必须保持空，它就是用来演示从零开始的完整流程的；
 * 「管理员账号」只要角色，不灌衣橱。
 *
 * 所有写入都是幂等的：已经有画像/衣橱/搭配就跳过，不覆盖现场演示时的手动改动。
 * 需要彻底重置时用 `npm run seed:demo -- --reset`，它先清空再灌。
 */
import { execute, getOne } from '../db/mysql.mjs'
import { DEMO_ACCOUNTS, ensureDemoAccounts } from './authService.mjs'
import * as garmentService from './garmentService.mjs'
import * as profileService from './profileService.mjs'
import * as outfitService from './outfitService.mjs'
import * as cartService from './cartService.mjs'
import * as aiRepo from '../repositories/aiRepo.mjs'
import * as profileRepo from '../repositories/profileRepo.mjs'
import * as customRepo from '../repositories/customRepo.mjs'

/** 演示女性：完成五步测试的真实答案 */
const FEMALE_PROFILE = {
  gender: 'female',
  styles: ['french', 'commute', 'korean'],
  skin: 'cool-fair',
  face: 'oval',
  visualBody: 'hourglass',
  height: 165,
  weight: 52,
  bust: 84,
  waist: 66,
  hips: 90,
  shoulder: 39,
  preferences: {
    priority: 'fashion',
    scene: 'work',
    color: 'morandi',
    budget: 'mid',
    fit: 'slim',
  },
}

/** 演示男性：完成画像但偏好只答了 3 题，正好演示「部分维度未完善」 */
const MALE_PROFILE = {
  gender: 'male',
  styles: ['street', 'sport', 'commute'],
  skin: 'natural',
  face: 'square',
  visualBody: 'inverted-triangle',
  height: 178,
  weight: 70,
  shoulder: 46,
  preferences: {
    priority: 'comfort',
    scene: 'sport',
    fit: 'loose',
  },
}

/**
 * 规则版风格报告，结构与 aiService.buildRuleStyleReport 的输出保持一致。
 * 这里不调大模型：演示账号的预置数据必须离线可重建，
 * 不能因为比赛现场没网就变成空报告。
 */
function buildDemoReport(profile, styleLabels) {
  return {
    source: 'rule',
    summary: `${styleLabels[0]}为主、${styleLabels.slice(1).join('与')}为辅的${profile.gender === 'male' ? '男性' : '女性'}穿搭画像`,
    palette:
      profile.gender === 'male'
        ? ['#2f3542', '#5f6b7a', '#a8b3c0', '#d8dee6', '#f2f4f7']
        : ['#f3d9e0', '#d9c2d6', '#b9a7c9', '#8d7fa8', '#efe7f3'],
    recommendations: [
      {
        title: `${styleLabels[0]}日常`,
        scene: '通勤',
        pieces: ['基础上衣', '直筒下装', '简约鞋履'],
        reason: `按你选择的「${styleLabels[0]}」风格与 ${profile.height}cm / ${profile.weight}kg 的身形比例给出的基础组合。`,
      },
      {
        title: `${styleLabels[1]}周末`,
        scene: '休闲',
        pieces: ['轻薄外套', '舒适下装', '百搭配饰'],
        reason: `结合你的视觉体型「${profile.visualBody}」，用外套拉长纵向线条。`,
      },
    ],
    tips: [
      '这是预置演示账号的基础规则版报告，重新生成会调用真实大模型。',
      `身高体重按 BMI ${Math.round((profile.weight / (profile.height / 100) ** 2) * 10) / 10} 计算，未填维度不参与评分。`,
    ],
  }
}

const STYLE_LABELS = {
  street: '休闲街头',
  commute: '简约通勤',
  french: '法式浪漫',
  korean: '韩系甜美',
  vintage: '复古优雅',
  sport: '运动机能',
}

async function seedProfileAndReport(userId, profile) {
  const existing = await profileRepo.findLatestProfile(userId)
  if (!existing) await profileService.saveProfile(userId, profile)

  const reports = await aiRepo.listStyleReports(userId, 1)
  if (reports.length) return
  const labels = profile.styles.map((id) => STYLE_LABELS[id] || id)
  await aiRepo.saveStyleReport(
    userId,
    { styles: labels, skin: profile.skin, face: profile.face, preferences: profile.preferences },
    buildDemoReport(profile, labels),
  )
}

async function seedOutfits(userId, { saveFirst }) {
  const existing = await outfitService.listOutfits(userId, {})
  if (existing.length) return existing
  const batch = await outfitService.generateOutfits(userId)
  if (saveFirst && batch.outfits?.[0]) {
    await outfitService.saveOutfit(userId, batch.outfits[0].id)
  }
  return batch.outfits || []
}

/**
 * 购物车预置（规格 §5.4 演示女性账号「真实衣橱、历史搭配、购物车」）。
 *
 * 购物车已统一到单张 cart_items（规格 §4.5 §13），这里只剩一条写入路径。
 * 灌两类数据，正好覆盖两个演示点：
 *   - 整套搭配拆成的旧衣单品 → 演示「来源搭配」标记
 *   - 一件全局配饰           → 演示配饰购物车与搭配优惠价
 *
 * 先查再写：现场手动改过的购物车不会被下次启动覆盖。
 */
async function seedCart(userId, outfits) {
  const existing = await cartService.listCart(userId)
  if (existing.items.length) return

  const first = outfits[0]
  if (first?.id) {
    await cartService.addOutfitToCart(userId, first.id)
  }

  // 配饰目录是全局的，加一件方便直接演示搭配优惠价
  const accessory = await getOne('SELECT id FROM accessories ORDER BY id ASC LIMIT 1')
  if (accessory) {
    await cartService.addItem(userId, { itemType: 'accessory', itemId: accessory.id })
  }
}

async function seedCustomRequest(userId) {
  const existing = await customRepo.listRequests(userId)
  if (existing.length) return
  const designer = await customRepo.findDesignerByKey('lin')
  await customRepo.createInquiryWithRequest(
    userId,
    {
      serviceType: 'special-occasion',
      requirements: '想要一条适合公司年会的定制小礼裙，偏法式、莫兰迪色系。',
      budget: '1500-3000',
      sizeNotes: '身高 165，腰围 66，肩宽偏窄',
      referenceImages: [],
    },
    {
      serviceType: 'special-occasion',
      requirements: { note: '预置演示定制申请', budget: '1500-3000' },
      referenceImages: [],
      designerId: designer?.id ?? null,
    },
  )
}

/** 演示女性账号：五步测试、真实衣橱、历史搭配、购物车、定制申请 */
async function seedFemale(userId) {
  await garmentService.ensureSeeded(userId)
  await seedProfileAndReport(userId, FEMALE_PROFILE)
  const outfits = await seedOutfits(userId, { saveFirst: true })
  await seedCart(userId, outfits)
  await seedCustomRequest(userId)
}

/** 演示男性账号：画像、真实衣橱、场景搭配示例 */
async function seedMale(userId) {
  await garmentService.ensureSeeded(userId)
  await seedProfileAndReport(userId, MALE_PROFILE)
  await seedOutfits(userId, { saveFirst: true })
}

/**
 * 清空某个演示账号的业务数据（比赛前重置用），不删用户本身。
 *
 * 这里必须覆盖「所有按 user_id 存的东西」，漏一张表就意味着重置之后
 * 上一场演示的痕迹还留在页面上 —— 场景模板会出现在「我的搭配」里，
 * 社区点赞和积分会让看板统计对不上（规格 §15）。
 */
async function resetUserData(userId) {
  await execute('DELETE FROM cart_items WHERE user_id = ?', [userId])
  await execute('DELETE oi FROM outfit_items oi JOIN outfits o ON o.id = oi.outfit_id WHERE o.user_id = ?', [userId])
  await execute('DELETE FROM outfits WHERE user_id = ?', [userId])
  await execute('DELETE FROM garments WHERE user_id = ?', [userId])
  await execute('DELETE FROM style_reports WHERE user_id = ?', [userId])
  await execute('DELETE FROM body_profiles WHERE user_id = ?', [userId])
  // 功能四：场景模板（「我的搭配」里的场景那一组）
  await execute('DELETE FROM scene_outfits WHERE user_id = ?', [userId])
  // 功能五：量体数据要排在申请之后删，外键指向 custom_requests
  await execute('DELETE FROM custom_messages WHERE user_id = ?', [userId])
  await execute('DELETE FROM custom_requests WHERE user_id = ?', [userId])
  await execute('DELETE FROM custom_measurements WHERE user_id = ?', [userId])
  await execute('DELETE FROM custom_inquiries WHERE user_id = ?', [userId])
  // 功能六：互动、评论、书签、积分徽章
  await execute('DELETE FROM community_interactions WHERE user_id = ?', [userId])
  await execute('DELETE FROM community_comments WHERE user_id = ?', [userId])
  await execute('DELETE FROM community_bookmarks WHERE user_id = ?', [userId])
  await execute('DELETE FROM user_achievements WHERE user_id = ?', [userId])
}

/**
 * 建号 + 灌数据。启动时调用（幂等），也可以通过 npm run seed:demo 手动重置。
 * @param {{reset?: boolean}} options reset=true 时先清空演示账号的业务数据
 */
export async function ensureDemoData(options = {}) {
  const accounts = await ensureDemoAccounts()
  const summary = []
  for (const entry of accounts) {
    if (options.reset && entry.kind !== 'admin') {
      await resetUserData(entry.userId)
    }
    try {
      if (entry.kind === 'female') await seedFemale(entry.userId)
      else if (entry.kind === 'male') await seedMale(entry.userId)
      // blank 与 admin 不灌任何业务数据
      summary.push({ kind: entry.kind, account: entry.account, userId: entry.userId, ok: true })
    } catch (error) {
      console.warn(`[demo-seed] ${entry.account} 预置失败:`, error.message)
      summary.push({ kind: entry.kind, account: entry.account, userId: entry.userId, ok: false, error: error.message })
    }
  }
  return summary
}

export { DEMO_ACCOUNTS }
