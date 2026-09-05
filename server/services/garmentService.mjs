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
const ALLOWED_CATEGORIES = new Set([
  'top',
  'pants',
  'skirt',
  'dress',
  'shoes',
  'bag',
  'hat',
  'jewelry',
  'accessory',
])

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

export function listGarments(userId) {
  return repo.listGarments(userId)
}

export function addGarment(userId, partial) {
  return repo.addGarment(userId, partial)
}

export async function deleteGarment(userId, id) {
  const item = await repo.findGarment(userId, id)
  if (!item) return false
  await repo.deleteGarment(userId, id)
  if (item.img?.startsWith('/uploads/')) {
    const target = join(dirname(fileURLToPath(import.meta.url)), '..', item.img.slice(1))
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

const UPLOAD_CATEGORIES = [
  'top',
  'pants',
  'skirt',
  'dress',
  'shoes',
  'bag',
  'hat',
  'jewelry',
  'accessory',
]
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
  '#4f5668', '#d9e2ee', '#f1e7d8', '#d16f5f', '#b6a6d8',
  '#88c7b5', '#9d5c50', '#f0b7c1', '#c9d2dd', '#6e7c91',
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
    const item = await repo.addGarment(userId, {
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
    })
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
