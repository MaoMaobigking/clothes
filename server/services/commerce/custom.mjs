/**
 * 差异化定制服务业务层。
 *
 * 校验、VIP 限制、设计师分配和自动回复都在这里完成；
 * SQL 留在 repository，HTTP 细节留在 routes。
 */
import * as repo from '../../repositories/customRepo.mjs'

export const SERVICE_TYPE_LABELS = {
  body: '身材特殊定制',
  occasion: '特殊场合定制',
  specific: '特定人群定制',
  taste: '独特品味定制',
}

export const REQUEST_STATUS_FLOW = ['submitted', 'design', 'sample', 'production', 'shipped']

const SERVICE_TYPES = new Set(Object.keys(SERVICE_TYPE_LABELS))

const DESIGNER_SEEDS = [
  {
    key: 'atelier-lin',
    name: '林设计',
    avatarUrl: '',
    specialty: '特殊体型 / 高定礼服',
    bio: '专注包容性版型和礼服工艺，擅长孕妇、大码及特殊体型剪裁。',
  },
  {
    key: 'atelier-chen',
    name: '陈设计',
    avatarUrl: '',
    specialty: '演出服 / Cosplay / 团队制服',
    bio: '负责舞台服装、角色服装与团体定制的结构和周期管理。',
  },
  {
    key: 'atelier-yu',
    name: '余设计',
    avatarUrl: '',
    specialty: '设计师款 / 限量面料',
    bio: '关注独特廓形、手工细节和稀缺面料，适合个性化高端定制。',
  },
]

function fail(message, status = 400, code = 'INVALID_CUSTOM_INPUT') {
  const err = new Error(message)
  err.status = status
  err.code = code
  throw err
}

function asText(value, field, maxLength) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) fail(`${field}不能为空`)
  if (text.length > maxLength) fail(`${field}不能超过 ${maxLength} 个字符`)
  return text
}

function asOptionalText(value, maxLength = 512) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > maxLength) fail('补充说明不能超过 512 个字符')
  return text
}

function asNumber(value, field, { min, max }) {
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) {
    fail(`${field}需在 ${min}-${max} 之间`)
  }
  return number
}

function asServiceType(value) {
  const serviceType = typeof value === 'string' ? value.trim() : ''
  if (!SERVICE_TYPES.has(serviceType)) fail('服务类型不合法')
  return serviceType
}

function asImageList(value, max = 6) {
  if (!Array.isArray(value)) return []
  const images = value.filter((item) => typeof item === 'string' && item.trim())
  if (images.length > max) fail(`最多上传 ${max} 张图片`)
  return images
}

function asRequestId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) fail('定制申请不存在', 404, 'NOT_FOUND')
  return id
}

function designerKeyFor(serviceType) {
  if (serviceType === 'body') return DESIGNER_SEEDS[0].key
  if (serviceType === 'occasion' || serviceType === 'specific') {
    return DESIGNER_SEEDS[1].key
  }
  return DESIGNER_SEEDS[2].key
}

async function assertVipAllowed(userId, vipOnly) {
  if (!vipOnly) return
  const membership = await repo.getUserMembership(userId)
  if (membership?.membershipLevel !== 'vip') {
    fail('该服务为 VIP 专属预约，请先完成演示升级', 403, 'VIP_REQUIRED')
  }
}

function createError(message, status, code) {
  const err = new Error(message)
  err.status = status
  err.code = code
  return err
}

export async function ensureDesigners() {
  return repo.ensureDesigners(DESIGNER_SEEDS)
}

export async function getSummary(userId) {
  const membership = await repo.getUserMembership(userId)
  const requestCount = await repo.countRequests(userId)
  return {
    role: membership?.role || 'user',
    membershipLevel: membership?.membershipLevel || 'standard',
    requestCount,
  }
}

export async function upgradeMembership(userId) {
  const membership = await repo.upgradeUserMembership(userId)
  return {
    role: membership?.role || 'user',
    membershipLevel: membership?.membershipLevel || 'standard',
  }
}

export async function listRequests(userId) {
  return repo.listRequests(userId)
}

export async function createInquiry(userId, input = {}) {
  const serviceType = asServiceType(input.serviceType)
  const vipOnly = input.vipOnly === true || input.tier === 'vip'
  await assertVipAllowed(userId, vipOnly)

  const requirements = asText(input.requirements, '需求描述', 1000)
  const referenceImages = asImageList(input.referenceImages)
  const designer = await repo.findDesignerByKey(designerKeyFor(serviceType))
  if (!designer) fail('设计师尚未初始化', 500, 'DESIGNER_NOT_READY')

  const created = await repo.createInquiryWithRequest(
    userId,
    {
      serviceType,
      requirements,
      budget: asOptionalText(input.budget, 64),
      sizeNotes: asOptionalText(input.sizeNotes, 512),
      referenceImages,
    },
    {
      serviceType,
      requirements: {
        requirements,
        budget: asOptionalText(input.budget, 64),
        sizeNotes: asOptionalText(input.sizeNotes, 512),
        tier: vipOnly ? 'vip' : 'standard',
      },
      referenceImages,
      designerId: designer.id,
    },
  )

  return repo.findRequest(userId, created.requestId)
}

export async function createMeasurement(userId, input = {}) {
  const serviceType = asServiceType(input.serviceType)
  const vipOnly = input.vipOnly === true || input.tier === 'vip'
  await assertVipAllowed(userId, vipOnly)

  const height = asNumber(input.height, '身高', { min: 100, max: 250 })
  const weight = asNumber(input.weight, '体重', { min: 25, max: 250 })
  const bust = asNumber(input.bust, '胸围', { min: 50, max: 180 })
  const waist = asNumber(input.waist, '腰围', { min: 40, max: 180 })
  const hips = asNumber(input.hips, '臀围', { min: 50, max: 200 })
  const shoulder = asNumber(input.shoulder, '肩宽', { min: 20, max: 100 })
  const frontImage = asText(input.frontImage, '正面全身照', 512)
  const sideImage = asText(input.sideImage, '侧面全身照', 512)
  const backImage = asOptionalText(input.backImage, 512)
  const detailImages = asImageList(input.detailImages)
  const notes = asOptionalText(input.notes, 512)
  const designer = await repo.findDesignerByKey(designerKeyFor(serviceType))
  if (!designer) fail('设计师尚未初始化', 500, 'DESIGNER_NOT_READY')

  const created = await repo.createMeasurementWithRequest(
    userId,
    {
      serviceType,
      height,
      weight,
      bust,
      waist,
      hips,
      shoulder,
      frontImage,
      sideImage,
      backImage,
      detailImages,
      notes,
    },
    {
      serviceType,
      requirements: {
        measurement: { height, weight, bust, waist, hips, shoulder },
        notes,
        tier: vipOnly ? 'vip' : 'standard',
      },
      referenceImages: [frontImage, sideImage, backImage, ...detailImages].filter(Boolean),
      designerId: designer.id,
    },
  )

  return repo.findRequest(userId, created.requestId)
}

export async function getRequest(userId, rawId) {
  const id = asRequestId(rawId)
  const request = await repo.findRequest(userId, id)
  if (!request) throw createError('定制申请不存在', 404, 'NOT_FOUND')
  const measurement = request.measurementId ? await repo.findMeasurement(userId, request.measurementId) : null
  const messages = await repo.listMessages(userId, id)
  return { request, measurement, messages }
}

export async function advanceRequest(userId, rawId) {
  const id = asRequestId(rawId)
  const request = await repo.findRequest(userId, id)
  if (!request) throw createError('定制申请不存在', 404, 'NOT_FOUND')
  const currentIndex = REQUEST_STATUS_FLOW.indexOf(request.status)
  if (currentIndex < 0 || currentIndex === REQUEST_STATUS_FLOW.length - 1) {
    return request
  }
  const nextStatus = REQUEST_STATUS_FLOW[currentIndex + 1]
  await repo.updateRequestStatus(userId, id, nextStatus)
  return repo.findRequest(userId, id)
}

export async function listMessages(userId, rawId) {
  const id = asRequestId(rawId)
  const request = await repo.findRequest(userId, id)
  if (!request) throw createError('定制申请不存在', 404, 'NOT_FOUND')
  return repo.listMessages(userId, id)
}

export async function sendMessage(userId, rawId, content = '') {
  const id = asRequestId(rawId)
  const request = await repo.findRequest(userId, id)
  if (!request) throw createError('定制申请不存在', 404, 'NOT_FOUND')

  const text = asText(content, '消息内容', 1000)
  const existingMessages = await repo.listMessages(userId, id)
  await repo.insertMessage(userId, id, 'user', text)

  const reply = buildDesignerReply(request, text, existingMessages.length)
  await repo.insertMessage(userId, id, 'designer', reply, request.designer?.id ?? null)
  return repo.listMessages(userId, id)
}

function buildDesignerReply(request, userContent, existingCount) {
  const designerName = request.designer?.name || '专属设计师'
  const requirements =
    request.requirements?.requirements ||
    request.requirements?.notes ||
    SERVICE_TYPE_LABELS[request.serviceType] ||
    '你的定制需求'

  if (existingCount === 0) {
    return `你好，我是${designerName}。已收到你的「${SERVICE_TYPE_LABELS[request.serviceType] || '定制'}」申请，我会围绕“${requirements}”先确认风格和版型。你也可以继续补充面料、颜色或工期要求。`
  }

  const rules = [
    [
      /面料|材质|布料/,
      '关于面料，我会先给你准备 3 档选择：常规质感、升级质感、限量质感。你告诉我预算和穿着场景，我再缩小范围。',
    ],
    [
      /工期|多久|时间|交付/,
      '常规定制周期约为 14 天：设计稿 2 天、确认后打样 4 天、生产 6 天、发货 2 天。需要加急时我会单独标出风险。',
    ],
    [
      /尺寸|量体|尺码|胸围|腰围|臀围|肩宽/,
      '我会以你提交的六项尺寸为第一版依据，后续还会结合正、侧面照片复核松量和版型。',
    ],
    [/预算|价格|多少钱/, '我会先按你的预算拆分设计、面料和工艺成本。VIP 定制可选择升级面料，但不会隐藏收费项。'],
    [/颜色|色彩|风格|版型/, '我会把颜色控制在你的主风格范围内，并给出版型建议：优先显比例、再处理特殊体型或场合细节。'],
  ]

  for (const [pattern, reply] of rules) {
    if (pattern.test(userContent)) return reply
  }

  return `收到。我会结合你当前的“${requirements}”继续细化方案，建议你补充最关心的优先级：风格、面料、版型还是工期。当前进度可在申请页查看。`
}
