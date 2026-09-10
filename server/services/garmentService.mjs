/*
 * 衣橱业务逻辑层（Service）
 *
 * 职责：编排 repository、做业务判断（如新用户自动灌种子衣橱）。
 * 不写 SQL，不碰 req/res —— 这样 service 才能被脚本和测试直接调用。
 *
 * 每个方法都要求 userId：service 层不允许存在「不带用户的衣橱操作」，
 * 从签名上就堵死漏传的可能。
 */
import * as repo from '../repositories/garmentRepo.mjs'
import { unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const MAX_GARMENTS = 100
const ALLOWED_CATEGORIES = new Set(['top', 'pants', 'skirt', 'dress', 'shoes', 'bag', 'hat', 'jewelry', 'accessory'])

function badRequest(message, code = 'INVALID_GARMENT') {
  const err = new Error(message)
  err.status = 400
  err.code = code
  return err
}

function toArray(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  return []
}

/**
 * 新增衣物的业务默认值
 *
 * 为什么搬上来：这十条全是产品决策 —— 默认叫什么名字、默认归哪一类、
 * 默认什么配色。换掉数据库它们一个都不用改，所以不该待在 repo：
 * repo 是「换数据库就得整个重写」的那一层，业务规则混在里面，重写时会被
 * 迫跟着誊一遍，抄漏一条就是线上脏数据。
 *
 * 搬上来顺手修掉一个真实 bug：repo 那边的默认分类写的是 '上衣'，而下面
 * ALLOWED_CATEGORIES 只认 'top' —— '上衣' 是前端 WARDROBE_CATEGORIES 里的
 * 显示 label，不是枚举 key。两处隔着一层，没人发现它们对不上，于是不带
 * category 的新增会写进一个既不是 key、也通不过后续 PATCH 校验的值。
 * 现在默认值和校验规则在同一个文件里，看得见彼此。
 *
 * repo 那边只留「存储适配」：boolean→TINYINT(0/1)、数组→JSON 字符串、
 * 空图片→NULL。那些是换数据库就要改的东西，属于它的本职。
 */
function applyGarmentDefaults(userId, input = {}) {
  return {
    ...input,
    id: input.id || `u${userId}_${Date.now().toString(36)}`,
    name: input.name || '未命名单品',
    category: input.category || 'top',
    brand: input.brand || '',
    emoji: input.emoji || '👕',
    from: input.from || '#ffd1e8',
    to: input.to || '#c9b8ff',
    price: Number(input.price) || 0,
    /*
     * season 是功能一之前的老字段（rowToGarment 里叫 legacySeason），
     * 新代码一律用 seasons 数组。这里保持原来的 '四季' 不动：
     * 它和 WARDROBE_SEASONS 的英文 key 同样对不上，但 rowToGarment 会拿它
     * 兜 seasons 的底（seasons 为空时回退成 [season]），改它波及面比
     * category 大得多，不混在这次改动里。
     */
    season: input.season || '四季',
    recognitionStatus: input.recognitionStatus || 'confirmed',
    recognitionSource: input.recognitionSource || 'manual',
  }
}

export function listGarments(userId) {
  return repo.listGarments(userId)
}

export function addGarment(userId, partial) {
  return repo.addGarment(userId, applyGarmentDefaults(userId, partial))
}

export async function deleteGarment(userId, id) {
  const item = await repo.findGarment(userId, id)
  if (!item) return false
  await repo.deleteGarment(userId, id)
  if (item.img?.startsWith('/uploads/')) {
    const target = join(dirname(fileURLToPath(import.meta.url)), '..', item.img.slice(1))
    //如果删除文件时报错了（比如图片文件本来就不存在、或者已经被删了），就什么都不要做、不要让程序崩溃报错
    unlink(target).catch(() => {})
  }
  return true
}

export function toggleFav(userId, id) {
  return repo.toggleFav(userId, id)
}

export function findGarment(userId, id) {
  return repo.findGarment(userId, id)
}

export async function updateGarment(userId, id, input = {}) {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  if (name) {
    if (name.length > 32) throw badRequest('衣物名称不能超过 32 个字')
  }
  if (input.category !== undefined && !ALLOWED_CATEGORIES.has(input.category)) {
    throw badRequest('衣物类型不合法')
  }
  const primaryColor = typeof input.primaryColor === 'string' ? input.primaryColor.trim() : ''
  if (primaryColor && !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
    throw badRequest('主色格式不合法')
  }
  const secondaryColors = toArray(input.secondaryColors).slice(0, 3)
  for (const color of secondaryColors) {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw badRequest('辅助色格式不合法')
  }

  const result = await repo.updateGarment(userId, id, {
    ...input,
    name: name || undefined,
    primaryColor: primaryColor || undefined,
    secondaryColors: secondaryColors.length ? secondaryColors : undefined,
    seasons: toArray(input.seasons),
    occasions: toArray(input.occasions),
    frequentlyWorn: input.frequentlyWorn === undefined ? undefined : Boolean(input.frequentlyWorn),
    recognitionStatus: input.recognitionStatus || 'confirmed',
    recognitionSource: input.recognitionSource || 'manual',
  })
  if (!result) {
    const err = new Error('衣物不存在')
    err.status = 404
    err.code = 'GARMENT_NOT_FOUND'
    throw err
  }
  return result
}

export async function reorderGarments(userId, ids) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw badRequest('请至少选择一件衣物')
  }
  const unique = [...new Set(ids.map(String))]
  if (unique.length !== ids.length) throw badRequest('排序列表存在重复衣物')
  return repo.reorderGarments(userId, unique)
}

export async function toggleFrequentlyWorn(userId, id) {
  const item = await repo.toggleFrequentlyWorn(userId, id)
  if (!item) {
    const err = new Error('衣物不存在')
    err.status = 404
    err.code = 'GARMENT_NOT_FOUND'
    throw err
  }
  return item
}

/** 只改图片地址，云开发模式下把 /uploads/ 路径改写成云存储 fileID 用 */
export function updateGarmentImage(userId, id, img) {
  return repo.updateGarmentImage(userId, id, img)
}

const UPLOAD_CATEGORIES = ['top', 'pants', 'skirt', 'dress', 'shoes', 'bag', 'hat', 'jewelry', 'accessory']
const CATEGORY_EMOJI = {
  top: '馃憰',
  pants: '馃憱',
  skirt: '馃憲',
  dress: '馃セ',
  shoes: '馃憻',
  bag: '馃憸',
  hat: '馃Б',
  jewelry: '馃拲',
  accessory: '馃В',
}
const COLOR_PALETTE = [
  '#4f5668',
  '#d9e2ee',
  '#f1e7d8',
  '#d16f5f',
  '#b6a6d8',
  '#88c7b5',
  '#9d5c50',
  '#f0b7c1',
  '#c9d2dd',
  '#6e7c91',
]

function currentSeasonKey() {
  const month = new Date().getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

function fileStem(filename) {
  return String(filename || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[^.]+$/, '')
    .replace(/[^\p{L}\p{N}_-]+/gu, ' ')
    .trim()
    .slice(0, 18)
}

export function buildUploadSuggestion(file, index = 0) {
  const category = UPLOAD_CATEGORIES[index % UPLOAD_CATEGORIES.length]
  const primaryColor = COLOR_PALETTE[index % COLOR_PALETTE.length]
  const secondaryColors = [
    COLOR_PALETTE[(index + 3) % COLOR_PALETTE.length],
    COLOR_PALETTE[(index + 6) % COLOR_PALETTE.length],
  ]
  const season = currentSeasonKey()
  const occasion = index % 2 === 0 ? 'daily' : index % 3 === 0 ? 'date' : 'work'
  return {
    name: fileStem(file.originalname) || `旧衣 ${String(index + 1).padStart(2, '0')}`,
    category,
    emoji: CATEGORY_EMOJI[category],
    primaryColor,
    secondaryColors,
    seasons: [season],
    occasions: [occasion],
  }
}

export async function uploadGarments(userId, files) {
  if (!Array.isArray(files) || files.length === 0) {
    throw badRequest('请先选择要上传的衣物照片', 'EMPTY_UPLOAD')
  }
  if (files.length > 20) {
    throw badRequest('单次最多上传 20 件衣物', 'UPLOAD_BATCH_LIMIT')
  }
  const current = await repo.countGarments(userId)
  if (current >= MAX_GARMENTS) {
    throw badRequest('衣橱最多保存 100 件，请先删除或整理', 'WARDROBE_LIMIT')
  }
  if (current + files.length > MAX_GARMENTS) {
    throw badRequest(`衣橱还剩 ${MAX_GARMENTS - current} 件空间`, 'WARDROBE_LIMIT')
  }

  const timestamp = Date.now().toString(36)
  const now = new Date()
  const uploadedAt = now.toISOString().slice(0, 19).replace('T', ' ')
  const items = []
  for (let index = 0; index < files.length; index += 1) {
    const file = files[index]
    const suggestion = buildUploadSuggestion(file, index)
    /*
     * 也走 applyGarmentDefaults：这里没给的 brand / price / season / fav
     * 由它补上，补出来的值和以前 repo 兜的完全一样，所以上传行为不变。
     * 两个入口共用同一份默认值，才不会出现「手动新增」和「上传」两套默认。
     */
    const item = await repo.addGarment(
      userId,
      applyGarmentDefaults(userId, {
        id: `u${userId}_upload_${timestamp}_${index}`,
        name: suggestion.name,
        category: suggestion.category,
        emoji: suggestion.emoji,
        from: suggestion.primaryColor,
        to: suggestion.secondaryColors[0],
        primaryColor: suggestion.primaryColor,
        secondaryColors: suggestion.secondaryColors,
        seasons: suggestion.seasons,
        occasions: suggestion.occasions,
        img: `/uploads/garments/${file.filename}`,
        sortOrder: current + index + 1,
        recognitionStatus: 'suggested',
        recognitionSource: 'demo',
        uploadedAt,
      }),
    )
    items.push(item)
  }
  return items
}

/** 新用户首次登录：衣橱空则灌一份种子数据，保证进去不是白屏 */
export async function ensureSeeded(userId) {
  const n = await repo.countGarments(userId)
  if (n > 0) return 0
  return repo.seedGarmentsForUser(userId)
}
